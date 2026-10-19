use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Condvar, Mutex, RwLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::core::config::{set_config, RuntimeConfig, SUB_EXT, VIDEO_EXT};
use crate::core::notifications::notify_task_finished;
use crate::core::tasks::{check_cancelled, with_task, TaskError, TaskProgress};
use crate::core::utils::{
    log_raw, normalize_path, reset_file_progress, set_ask_directory_callback,
    set_ask_input_callback, set_ask_matcher_callback, set_log_callback, set_progress_callback,
    AskOptions,
};
use crate::features::custom_merge::run_custom_merge;
use crate::features::injection::run_injection;
use crate::features::stream_manager::{run_set_default_tracks, run_stream_manager};
use crate::features::sub_sync::{run_sync_subs, run_sync_subs_from_mkv};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PathsInput {
    #[serde(default)]
    pub video: String,
    #[serde(default)]
    pub sub: String,
    #[serde(default)]
    pub output: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunResult {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_dir: Option<String>,
}

pub trait FrontendBridge: Send + Sync {
    fn append_terminal(&self, text: &str);
    fn ask_input(&self, payload: &Value, callback_id: &str) -> bool;
    fn ask_matcher(&self, targets: &[String], sources: &[String], callback_id: &str) -> bool;
    fn cancel_requests(&self);
    fn pick_folder(&self) -> String;
    fn pick_folder_with_default(&self, _default_dir: Option<&str>) -> String {
        self.pick_folder()
    }
    fn pick_file(&self, label: &str, extensions: &[&str]) -> String;
    fn pick_file_with_default(
        &self,
        label: &str,
        extensions: &[&str],
        _default_dir: Option<&str>,
    ) -> String {
        self.pick_file(label, extensions)
    }
    fn update_progress(
        &self,
        _current_file: &str,
        _file_index: usize,
        _total_files: usize,
        _file_percent: f64,
    ) {
    }
    fn clear_progress(&self) {}
}

#[derive(Debug, Default)]
pub struct RepeatState {
    pub last_run_module: Option<String>,
    pub last_directory_choices: Vec<String>,
    pub is_repeating: bool,
    pub current_directory_index: usize,
    pub matcher_orders: Vec<Vec<String>>,
    pub matcher_index: usize,
    pub repeat_matcher_order: bool,
}

type WaitEvent = Arc<(Mutex<bool>, Condvar)>;
pub type ModuleOverride = Arc<dyn Fn() -> Result<(), TaskError> + Send + Sync>;

pub struct ApiInner {
    pub run_lock: Mutex<bool>,
    pub active_task: Mutex<Option<Arc<TaskProgress>>>,
    pub repeat_state: Mutex<RepeatState>,
    pub last_browsed_dir: Mutex<Option<String>>,
    pub input_events: Mutex<HashMap<String, WaitEvent>>,
    pub input_results: Mutex<HashMap<String, Option<String>>>,
    pub matcher_events: Mutex<HashMap<String, WaitEvent>>,
    pub matcher_results: Mutex<HashMap<String, Vec<(String, String)>>>,
    pub matcher_orders_pending: Mutex<HashMap<String, Vec<String>>>,
    pub bridge: RwLock<Option<Arc<dyn FrontendBridge>>>,
    pub module_overrides: RwLock<HashMap<String, ModuleOverride>>,
}

#[derive(Clone)]
pub struct Api {
    pub inner: Arc<ApiInner>,
}

impl Default for Api {
    fn default() -> Self {
        Self::new()
    }
}

impl Api {
    pub fn new() -> Self {
        let api = Self {
            inner: Arc::new(ApiInner {
                run_lock: Mutex::new(false),
                active_task: Mutex::new(None),
                repeat_state: Mutex::new(RepeatState::default()),
                last_browsed_dir: Mutex::new(None),
                input_events: Mutex::new(HashMap::new()),
                input_results: Mutex::new(HashMap::new()),
                matcher_events: Mutex::new(HashMap::new()),
                matcher_results: Mutex::new(HashMap::new()),
                matcher_orders_pending: Mutex::new(HashMap::new()),
                bridge: RwLock::new(None),
                module_overrides: RwLock::new(HashMap::new()),
            }),
        };
        api.install_callbacks();
        api
    }

    pub fn install_callbacks(&self) {
        let api_dir = self.clone();
        set_ask_directory_callback(Some(Arc::new(move |caption| {
            api_dir.choose_directory(caption)
        })));

        let api_match = self.clone();
        set_ask_matcher_callback(Some(Arc::new(move |targets, sources| {
            api_match.match_files_internal(targets, sources)
        })));

        let api_input = self.clone();
        set_ask_input_callback(Some(Arc::new(move |prompt, options| {
            api_input.request_input(prompt, options)
        })));

        let api_log = self.clone();
        set_log_callback(Some(Arc::new(move |text| {
            api_log.append_terminal(text);
        })));

        let api_prog = self.clone();
        set_progress_callback(Some(Arc::new(move |cur, idx, total, pct| {
            api_prog.update_progress(cur, idx, total, pct);
        })));
    }

    pub fn set_bridge(&self, bridge: Option<Arc<dyn FrontendBridge>>) {
        *self.inner.bridge.write().unwrap() = bridge;
    }

    pub fn set_module_override(&self, name: &str, func: Option<ModuleOverride>) {
        let mut map = self.inner.module_overrides.write().unwrap();
        if let Some(f) = func {
            map.insert(name.to_string(), f);
        } else {
            map.remove(name);
        }
    }

    pub fn append_terminal(&self, text: &str) {
        if let Some(bridge) = self.inner.bridge.read().unwrap().clone() {
            bridge.append_terminal(text);
        }
    }

    pub fn update_progress(
        &self,
        current_file: &str,
        file_index: usize,
        total_files: usize,
        file_percent: f64,
    ) {
        if let Some(bridge) = self.inner.bridge.read().unwrap().clone() {
            bridge.update_progress(current_file, file_index, total_files, file_percent);
        }
    }

    pub fn cancel_pending_matchers(&self) {
        let _ = self.stop_task();
        for evt in self.inner.matcher_events.lock().unwrap().values() {
            let (lock, cvar) = &**evt;
            *lock.lock().unwrap() = true;
            cvar.notify_all();
        }
        for evt in self.inner.input_events.lock().unwrap().values() {
            let (lock, cvar) = &**evt;
            *lock.lock().unwrap() = true;
            cvar.notify_all();
        }
    }

    pub fn choose_directory(&self, caption: &str) -> Result<String, TaskError> {
        {
            let mut st = self.inner.repeat_state.lock().unwrap();
            if st.is_repeating {
                if st.current_directory_index < st.last_directory_choices.len() {
                    let res = st.last_directory_choices[st.current_directory_index].clone();
                    st.current_directory_index += 1;
                    drop(st);
                    self.append_terminal(&format!("[{}] Auto-selected: {}\n", caption, res));
                    if res.is_empty() {
                        return Err(TaskError::Cancelled);
                    }
                    let norm = normalize_path(Path::new(&res));
                    let norm_str = norm.to_string_lossy().to_string();
                    if caption.to_uppercase().contains("OUTPUT") {
                        fs::create_dir_all(&norm)
                            .map_err(|e| TaskError::Message(e.to_string()))?;
                    } else if !(norm.is_dir() || norm.is_file()) {
                        return Err(TaskError::Message(format!(
                            "File or folder does not exist: {}",
                            norm_str
                        )));
                    }
                    return Ok(norm_str);
                } else {
                    st.is_repeating = false;
                }
            }
        }

        let res = if let Some(bridge) = self.inner.bridge.read().unwrap().clone() {
            bridge.pick_folder()
        } else {
            String::new()
        };

        let final_res = if !res.is_empty() {
            let norm = Path::new(&res).to_path_buf().to_string_lossy().to_string();
            self.inner
                .repeat_state
                .lock()
                .unwrap()
                .last_directory_choices
                .push(norm.clone());
            norm
        } else {
            String::new()
        };

        self.append_terminal(&format!("[{}] Selected: {}\n", caption, final_res));
        Ok(final_res)
    }

    pub fn request_input(&self, prompt: &str, options: AskOptions) -> Result<String, TaskError> {
        check_cancelled()?;
        let Some(bridge) = self.inner.bridge.read().unwrap().clone() else {
            return Err(TaskError::Cancelled);
        };

        let callback_id = Uuid::new_v4().to_string();
        let event: WaitEvent = Arc::new((Mutex::new(false), Condvar::new()));
        self.inner
            .input_events
            .lock()
            .unwrap()
            .insert(callback_id.clone(), event.clone());

        let payload = json!({
            "prompt": prompt,
            "tracks": options.tracks,
            "kind": options.kind,
            "allow_empty": options.allow_empty,
            "allow_skip": options.allow_skip,
            "context": options.context,
            "files": options.files,
        });

        let result = (|| {
            if !bridge.ask_input(&payload, &callback_id) {
                return Err(TaskError::Cancelled);
            }

            let (lock, cvar) = &*event;
            loop {
                let guard = lock.lock().unwrap();
                if *guard {
                    break;
                }
                let (guard, _) = cvar
                    .wait_timeout(guard, Duration::from_millis(50))
                    .unwrap();
                if *guard {
                    break;
                }
                drop(guard);
                check_cancelled()?;
            }
            check_cancelled()?;

            let res = self
                .inner
                .input_results
                .lock()
                .unwrap()
                .get(&callback_id)
                .cloned()
                .flatten();
            match res {
                Some(val) => Ok(val),
                None => Err(TaskError::Cancelled),
            }
        })();

        self.inner.input_events.lock().unwrap().remove(&callback_id);
        self.inner
            .input_results
            .lock()
            .unwrap()
            .remove(&callback_id);
        result
    }

    pub fn request_matcher<F>(
        &self,
        target_list: Vec<String>,
        source_list: Vec<String>,
        on_order: Option<F>,
    ) -> Result<Vec<(String, String)>, TaskError>
    where
        F: FnOnce(Vec<String>),
    {
        let Some(bridge) = self.inner.bridge.read().unwrap().clone() else {
            return Ok(Vec::new());
        };

        let callback_id = Uuid::new_v4().to_string();
        let event: WaitEvent = Arc::new((Mutex::new(false), Condvar::new()));
        self.inner
            .matcher_events
            .lock()
            .unwrap()
            .insert(callback_id.clone(), event.clone());

        let result = (|| {
            if !bridge.ask_matcher(&target_list, &source_list, &callback_id) {
                return Ok(Vec::new());
            }

            let (lock, cvar) = &*event;
            loop {
                let guard = lock.lock().unwrap();
                if *guard {
                    break;
                }
                let (guard, _) = cvar
                    .wait_timeout(guard, Duration::from_millis(50))
                    .unwrap();
                if *guard {
                    break;
                }
                drop(guard);
                check_cancelled()?;
            }
            check_cancelled()?;

            let res = self
                .inner
                .matcher_results
                .lock()
                .unwrap()
                .get(&callback_id)
                .cloned()
                .unwrap_or_default();

            if !res.is_empty() {
                if let Some(save) = on_order {
                    let order = self
                        .inner
                        .matcher_orders_pending
                        .lock()
                        .unwrap()
                        .get(&callback_id)
                        .cloned()
                        .unwrap_or_else(|| res.iter().map(|pair| pair.1.clone()).collect());
                    let mut full_order = order.clone();
                    for source in &source_list {
                        if !full_order.contains(source) {
                            full_order.push(source.clone());
                        }
                    }
                    save(full_order);
                }
            }

            Ok(res)
        })();

        self.inner
            .matcher_events
            .lock()
            .unwrap()
            .remove(&callback_id);
        self.inner
            .matcher_results
            .lock()
            .unwrap()
            .remove(&callback_id);
        self.inner
            .matcher_orders_pending
            .lock()
            .unwrap()
            .remove(&callback_id);

        result
    }

    pub fn match_files_internal(
        &self,
        targets: Vec<String>,
        mut sources: Vec<String>,
    ) -> Result<Vec<(String, String)>, TaskError> {
        let index = {
            let mut st = self.inner.repeat_state.lock().unwrap();
            let idx = st.matcher_index;
            st.matcher_index += 1;
            if st.repeat_matcher_order && idx < st.matcher_orders.len() {
                let previous = st.matcher_orders[idx].clone();
                let mut reordered: Vec<String> = previous
                    .iter()
                    .filter(|s| sources.contains(s))
                    .cloned()
                    .collect();
                for s in &sources {
                    if !previous.contains(s) {
                        reordered.push(s.clone());
                    }
                }
                sources = reordered;
            }
            idx
        };

        let api_clone = self.clone();
        self.request_matcher(
            targets,
            sources,
            Some(move |order: Vec<String>| {
                let mut st = api_clone.inner.repeat_state.lock().unwrap();
                while st.matcher_orders.len() <= index {
                    st.matcher_orders.push(Vec::new());
                }
                st.matcher_orders[index] = order;
            }),
        )
    }

    pub fn resolve_input(&self, callback_id: &str, result: Option<String>) {
        let evt_opt = self
            .inner
            .input_events
            .lock()
            .unwrap()
            .get(callback_id)
            .cloned();
        if let Some(evt) = evt_opt {
            self.inner
                .input_results
                .lock()
                .unwrap()
                .insert(callback_id.to_string(), result);
            let (lock, cvar) = &*evt;
            *lock.lock().unwrap() = true;
            cvar.notify_all();
        }
    }

    pub fn resolve_matcher(
        &self,
        callback_id: &str,
        res: Vec<(String, String)>,
        source_order: Option<Vec<String>>,
    ) {
        let evt_opt = self
            .inner
            .matcher_events
            .lock()
            .unwrap()
            .get(callback_id)
            .cloned();
        if let Some(evt) = evt_opt {
            self.inner
                .matcher_results
                .lock()
                .unwrap()
                .insert(callback_id.to_string(), res);
            if let Some(order) = source_order {
                self.inner
                    .matcher_orders_pending
                    .lock()
                    .unwrap()
                    .insert(callback_id.to_string(), order);
            }
            let (lock, cvar) = &*evt;
            *lock.lock().unwrap() = true;
            cvar.notify_all();
        }
    }

    pub fn stop_task(&self) -> Value {
        {
            let guard = self.inner.active_task.lock().unwrap();
            let Some(ref task) = *guard else {
                return json!({ "status": "idle" });
            };
            task.cancel();
        }
        for evt in self.inner.input_events.lock().unwrap().values() {
            let (lock, cvar) = &**evt;
            *lock.lock().unwrap() = true;
            cvar.notify_all();
        }
        for evt in self.inner.matcher_events.lock().unwrap().values() {
            let (lock, cvar) = &**evt;
            *lock.lock().unwrap() = true;
            cvar.notify_all();
        }
        if let Some(bridge) = self.inner.bridge.read().unwrap().clone() {
            bridge.cancel_requests();
        }
        json!({ "status": "stopping" })
    }

    fn resolve_initial_dir(&self, hint: Option<&str>) -> Option<String> {
        if let Some(h) = hint {
            let trimmed = h.trim();
            if !trimmed.is_empty() {
                let p = Path::new(trimmed);
                if p.is_dir() {
                    return Some(p.to_string_lossy().to_string());
                }
                if let Some(parent) = p.parent() {
                    if !parent.as_os_str().is_empty() && parent.is_dir() {
                        return Some(parent.to_string_lossy().to_string());
                    }
                }
            }
        }
        self.inner.last_browsed_dir.lock().unwrap().clone()
    }

    fn remember_browsed_path(&self, chosen: &str) {
        let trimmed = chosen.trim();
        if trimmed.is_empty() {
            return;
        }
        let p = Path::new(trimmed);
        if p.is_dir() {
            *self.inner.last_browsed_dir.lock().unwrap() = Some(p.to_string_lossy().to_string());
        } else if let Some(parent) = p.parent() {
            if !parent.as_os_str().is_empty() {
                *self.inner.last_browsed_dir.lock().unwrap() =
                    Some(parent.to_string_lossy().to_string());
            }
        }
    }

    pub fn pick_folder(&self) -> String {
        self.pick_folder_with_default(None)
    }

    pub fn pick_folder_with_default(&self, default_path: Option<&str>) -> String {
        if let Some(bridge) = self.inner.bridge.read().unwrap().clone() {
            let initial_dir = self.resolve_initial_dir(default_path);
            let chosen = bridge.pick_folder_with_default(initial_dir.as_deref());
            if !chosen.is_empty() {
                self.remember_browsed_path(&chosen);
            }
            return chosen;
        }
        String::new()
    }

    pub fn pick_file(&self, media_type: &str) -> String {
        self.pick_file_with_default(media_type, None)
    }

    pub fn pick_file_with_default(&self, media_type: &str, default_path: Option<&str>) -> String {
        let (label, extensions) = if media_type == "subtitles" {
            ("Subtitle files", SUB_EXT)
        } else {
            ("Video files", VIDEO_EXT)
        };
        if let Some(bridge) = self.inner.bridge.read().unwrap().clone() {
            let initial_dir = self.resolve_initial_dir(default_path);
            let chosen =
                bridge.pick_file_with_default(label, extensions, initial_dir.as_deref());
            if !chosen.is_empty() {
                let norm = Path::new(&chosen).to_path_buf().to_string_lossy().to_string();
                self.remember_browsed_path(&norm);
                return norm;
            }
        }
        String::new()
    }

    pub fn show_in_folder(&self, path: &str) -> Result<(), String> {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Err("Path is empty.".to_string());
        }
        let target = Path::new(trimmed);
        let dir_to_open = if target.is_dir() {
            target.to_path_buf()
        } else if let Some(parent) = target.parent() {
            if !parent.as_os_str().is_empty() && parent.is_dir() {
                parent.to_path_buf()
            } else {
                return Err(format!("Folder does not exist: {}", trimmed));
            }
        } else {
            return Err(format!("Folder does not exist: {}", trimmed));
        };

        #[cfg(target_os = "windows")]
        let cmd_res = std::process::Command::new("explorer")
            .arg(&dir_to_open)
            .spawn();

        #[cfg(target_os = "macos")]
        let cmd_res = std::process::Command::new("open")
            .arg(&dir_to_open)
            .spawn();

        #[cfg(all(unix, not(target_os = "macos")))]
        let cmd_res = std::process::Command::new("xdg-open")
            .arg(&dir_to_open)
            .spawn();

        cmd_res
            .map(|_| ())
            .map_err(|e| format!("Failed to open folder: {}", e))
    }

    pub fn get_version(&self) -> String {
        VERSION.to_string()
    }

    pub fn preview_sync_mpv(
        &self,
        target: &str,
        audio_file: Option<&str>,
        audio_delay_ms: Option<i64>,
        sub_file: Option<&str>,
        sub_delay_ms: Option<i64>,
        start_time: Option<&str>,
    ) -> Result<Value, String> {
        let cmd = crate::core::processes::preview_sync_mpv(
            target,
            audio_file,
            audio_delay_ms,
            sub_file,
            sub_delay_ms,
            start_time,
        )?;
        self.append_terminal(&format!("[mpv] Preview launched: {}\n", cmd.join(" ")));
        Ok(json!({
            "status": "ok",
            "cmd": cmd,
        }))
    }

    pub fn inspect_media(&self, path: &str) -> Result<Value, String> {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Ok(json!(null));
        }
        let target = Path::new(trimmed);
        if !target.exists() {
            return Ok(json!(null));
        }
        if target.is_dir() {
            let videos = crate::core::utils::get_files_recursive(trimmed, VIDEO_EXT)
                .unwrap_or_default();
            let subs = crate::core::utils::get_files_recursive(trimmed, SUB_EXT)
                .unwrap_or_default();
            let sample_tracks = if let Some(first_mkv) = videos
                .iter()
                .find(|f| f.to_lowercase().ends_with(".mkv"))
            {
                crate::core::mkv_tools::get_tracks_info(first_mkv).unwrap_or_default()
            } else {
                Vec::new()
            };
            let folder_name = target
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| trimmed.to_string());
            return Ok(json!({
                "kind": "folder",
                "name": folder_name,
                "video_count": videos.len(),
                "sub_count": subs.len(),
                "tracks": sample_tracks,
            }));
        }
        if target.is_file() {
            let file_name = target
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| trimmed.to_string());
            let ext = target
                .extension()
                .map(|e| e.to_string_lossy().to_uppercase())
                .unwrap_or_default();
            let size_bytes = fs::metadata(target).map(|m| m.len()).unwrap_or(0);
            let tracks = if ext == "MKV" {
                crate::core::mkv_tools::get_tracks_info(trimmed).unwrap_or_default()
            } else {
                Vec::new()
            };
            let has_attach = if ext == "MKV" {
                crate::core::mkv_tools::has_attachments(trimmed).unwrap_or(false)
            } else {
                false
            };
            return Ok(json!({
                "kind": "file",
                "name": file_name,
                "container": ext,
                "size_bytes": size_bytes,
                "tracks": tracks,
                "has_attachments": has_attach,
            }));
        }
        Ok(json!(null))
    }

    pub fn run_module(
        &self,
        module_name: &str,
        settings: &Value,
        paths: Option<PathsInput>,
        repeat: bool,
    ) -> RunResult {
        {
            let mut busy = self.inner.run_lock.lock().unwrap();
            if *busy {
                return RunResult {
                    status: "busy".to_string(),
                    message: Some("A task is already running.".to_string()),
                    output_dir: None,
                };
            }
            *busy = true;
        }

        let progress = TaskProgress::new();
        *self.inner.active_task.lock().unwrap() = Some(progress.clone());

        let result = self.run_module_inner(module_name, settings, paths, repeat, progress);

        *self.inner.active_task.lock().unwrap() = None;
        *self.inner.run_lock.lock().unwrap() = false;
        result
    }

    fn parse_max_offset(settings: &Value, enable_offset: bool) -> Result<i64, ()> {
        if !enable_offset {
            return Ok(1);
        }
        let Some(raw) = settings.get("max_offset") else {
            return Ok(1);
        };
        let parsed = match raw {
            Value::Number(n) => n.as_i64().ok_or(())?,
            Value::String(s) => {
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    return Err(());
                }
                trimmed.parse::<i64>().map_err(|_| ())?
            }
            _ => return Err(()),
        };
        if parsed <= 0 {
            return Err(());
        }
        Ok(parsed)
    }

    fn run_module_inner(
        &self,
        requested_module: &str,
        settings: &Value,
        paths: Option<PathsInput>,
        repeat: bool,
        progress: Arc<TaskProgress>,
    ) -> RunResult {
        self.install_callbacks();
        reset_file_progress();

        let valid_modules = [
            ("stream_manager", "Remove & Filter Tracks"),
            ("set_default", "Set Default & Forced Flags"),
            ("sync_subs", "Sync Subtitle Files to Audio"),
            ("sync_subs_mkv", "Extract & Sync Subs from MKV"),
            ("injection", "Waveform Audio Sync & Merge"),
            ("custom_merge", "Direct Track Merge (No Sync)"),
        ];

        let mut module_name = requested_module.to_string();
        let mut resolved_output_dir: Option<String> = None;
        if repeat {
            let st = self.inner.repeat_state.lock().unwrap();
            match &st.last_run_module {
                Some(prev) => module_name = prev.clone(),
                None => {
                    return RunResult {
                        status: "error".to_string(),
                        message: Some("There is no previous task to repeat.".to_string()),
                        output_dir: None,
                    }
                }
            }
        }

        let Some((_, module_label)) = valid_modules.iter().find(|(id, _)| *id == module_name)
        else {
            return RunResult {
                status: "error".to_string(),
                message: Some("Unknown module.".to_string()),
                output_dir: None,
            };
        };

        let enable_offset = settings
            .get("enable_max_offset")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let Ok(max_offset) = Self::parse_max_offset(settings, enable_offset) else {
            return RunResult {
                status: "error".to_string(),
                message: Some("Max offset must be a positive whole number.".to_string()),
                output_dir: None,
            };
        };

        let auto_audio = settings
            .get("auto_audio")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        let auto_subs = settings
            .get("auto_subs")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        let notify_on_finish = settings
            .get("notify_on_finish")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let opus_mode = settings
            .get("opus_mode")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                if settings.get("convert_opus").and_then(|v| v.as_bool()).unwrap_or(false) {
                    "always".to_string()
                } else {
                    "off".to_string()
                }
            });

        let opus_bitrate = settings
            .get("opus_bitrate")
            .and_then(|v| {
                v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok()))
            })
            .map(|v| v as u32)
            .unwrap_or(128);

        let opus_downmix = settings
            .get("opus_downmix")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let default_output_dir = settings
            .get("default_output_dir")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let preview_mpv = settings
            .get("preview_mpv")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        set_config(RuntimeConfig {
            max_offset_seconds: max_offset,
            enable_max_offset: enable_offset,
            auto_sync_audio: auto_audio,
            auto_sync_subs: auto_subs,
            opus_mode,
            opus_bitrate,
            opus_downmix,
            default_output_dir: default_output_dir.clone(),
            preview_mpv,
        });

        {
            let mut st = self.inner.repeat_state.lock().unwrap();
            st.repeat_matcher_order = repeat;
            st.matcher_index = 0;
            if !repeat {
                st.matcher_orders.clear();
            }

            if repeat && st.last_run_module.is_some() {
                st.is_repeating = true;
                st.current_directory_index = 0;
                if let Some(last_dir) = st.last_directory_choices.last() {
                    resolved_output_dir = Some(last_dir.clone());
                }
            } else {
                st.last_run_module = Some(module_name.clone());
                st.is_repeating = true;
                st.current_directory_index = 0;
                st.last_directory_choices.clear();

                if let Some(p) = paths {
                    let p_vid = p.video;
                    let p_sub = p.sub;
                    let mut p_out = p.output;
                    if p_out.is_empty() {
                        if let Some(ref def_out) = default_output_dir {
                            let norm_def = normalize_path(Path::new(def_out));
                            if norm_def.is_dir() {
                                p_out = norm_def.to_string_lossy().to_string();
                            }
                        }
                    }
                    if p_out.is_empty() && !p_vid.is_empty() {
                        let norm_vid = normalize_path(Path::new(&p_vid));
                        if norm_vid.is_file() {
                            if let Some(parent) = norm_vid.parent() {
                                p_out = parent.to_string_lossy().to_string();
                            }
                        } else {
                            p_out = p_vid.clone();
                        }
                    }

                    if !p_out.is_empty() {
                        resolved_output_dir = Some(p_out.clone());
                    }

                    if module_name == "set_default" {
                        st.last_directory_choices = vec![p_vid];
                    } else if module_name == "stream_manager" {
                        st.last_directory_choices = vec![p_vid, p_out];
                    } else {
                        st.last_directory_choices = vec![p_vid, p_sub, p_out];
                    }
                }
            }
        }

        let mod_name_clone = module_name.clone();
        let override_fn = self
            .inner
            .module_overrides
            .read()
            .unwrap()
            .get(&module_name)
            .cloned();

        let exec_outcome = with_task(progress.clone(), || -> Result<(), TaskError> {
            log_raw(&format!("\n--- Launching {} ---\n", mod_name_clone));
            if let Some(custom) = override_fn {
                custom()?;
            } else {
                match mod_name_clone.as_str() {
                    "stream_manager" => run_stream_manager()?,
                    "set_default" => run_set_default_tracks()?,
                    "sync_subs" => run_sync_subs()?,
                    "sync_subs_mkv" => run_sync_subs_from_mkv()?,
                    "injection" => run_injection()?,
                    "custom_merge" => run_custom_merge()?,
                    _ => return Err(TaskError::Message("Unknown module.".to_string())),
                }
            }
            check_cancelled()?;
            Ok(())
        });

        self.inner.repeat_state.lock().unwrap().is_repeating = false;
        if let Some(bridge) = self.inner.bridge.read().unwrap().clone() {
            bridge.cancel_requests();
            bridge.clear_progress();
        }
        reset_file_progress();

        let outputs = progress.outputs();
        let warnings = progress.warnings();

        let result = match exec_outcome {
            Ok(()) => {
                if outputs == 0 {
                    RunResult {
                        status: "cancelled".to_string(),
                        message: Some("No files were processed.".to_string()),
                        output_dir: resolved_output_dir.clone(),
                    }
                } else if warnings > 0 {
                    RunResult {
                        status: "warning".to_string(),
                        message: Some(format!(
                            "Task completed with {} warning(s). Check the terminal.",
                            warnings
                        )),
                        output_dir: resolved_output_dir.clone(),
                    }
                } else {
                    RunResult {
                        status: "ok".to_string(),
                        message: Some(format!("Task completed. {} file(s) processed.", outputs)),
                        output_dir: resolved_output_dir.clone(),
                    }
                }
            }
            Err(TaskError::Cancelled) => RunResult {
                status: "cancelled".to_string(),
                message: Some(format!(
                    "Task stopped. {} completed file(s) kept; partial output removed.",
                    outputs
                )),
                output_dir: resolved_output_dir.clone(),
            },
            Err(TaskError::Message(msg)) => RunResult {
                status: "error".to_string(),
                message: Some(msg),
                output_dir: resolved_output_dir.clone(),
            },
        };

        if let Some(ref msg) = result.message {
            self.append_terminal(&format!("\n--- {} ---\n", msg));
        }

        if notify_on_finish {
            notify_task_finished(module_label, &result.status);
        }

        result
    }
}
