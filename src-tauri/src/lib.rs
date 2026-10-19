pub mod cli;
pub mod core;
pub mod features;
pub mod ui;

#[cfg(feature = "gui")]
mod gui_app {
    use std::sync::Arc;
    use serde_json::Value;
    use tauri::{AppHandle, Manager, State, WindowEvent};

    use crate::ui::backend::{Api, FrontendBridge, PathsInput, RunResult};

    struct TauriWindowBridge {
        app: AppHandle,
    }

    impl FrontendBridge for TauriWindowBridge {
    fn append_terminal(&self, text: &str) {
        if let Some(win) = self.app.get_webview_window("main") {
            if let Ok(encoded) = serde_json::to_string(text) {
                let script = format!(
                    "if(window.frontend_api && window.frontend_api.append_terminal) window.frontend_api.append_terminal({});",
                    encoded
                );
                let _ = win.eval(&script);
            }
        }
    }

    fn ask_input(&self, payload: &Value, callback_id: &str) -> bool {
        if let Some(win) = self.app.get_webview_window("main") {
            if let (Ok(payload_json), Ok(id_json)) = (
                serde_json::to_string(payload),
                serde_json::to_string(callback_id),
            ) {
                let script = format!(
                    "if(window.frontend_api && window.frontend_api.ask_input) window.frontend_api.ask_input({}, {});",
                    payload_json, id_json
                );
                return win.eval(&script).is_ok();
            }
        }
        false
    }

    fn ask_matcher(&self, targets: &[String], sources: &[String], callback_id: &str) -> bool {
        if let Some(win) = self.app.get_webview_window("main") {
            if let (Ok(t_json), Ok(s_json), Ok(id_json)) = (
                serde_json::to_string(targets),
                serde_json::to_string(sources),
                serde_json::to_string(callback_id),
            ) {
                let script = format!(
                    "if(window.frontend_api && window.frontend_api.ask_matcher) window.frontend_api.ask_matcher({}, {}, {});",
                    t_json, s_json, id_json
                );
                return win.eval(&script).is_ok();
            }
        }
        false
    }

    fn cancel_requests(&self) {
        if let Some(win) = self.app.get_webview_window("main") {
            let script =
                "if(window.frontend_api && window.frontend_api.cancel_requests) window.frontend_api.cancel_requests();";
            let _ = win.eval(script);
        }
    }

    fn pick_folder(&self) -> String {
        self.pick_folder_with_default(None)
    }

    fn pick_folder_with_default(&self, default_dir: Option<&str>) -> String {
        let mut dlg = rfd::FileDialog::new();
        if let Some(dir) = default_dir {
            let p = std::path::Path::new(dir);
            if p.is_dir() {
                dlg = dlg.set_directory(p);
            }
        }
        dlg.pick_folder()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    }

    fn pick_file(&self, label: &str, extensions: &[&str]) -> String {
        self.pick_file_with_default(label, extensions, None)
    }

    fn pick_file_with_default(
        &self,
        label: &str,
        extensions: &[&str],
        default_dir: Option<&str>,
    ) -> String {
        let clean_exts: Vec<String> = extensions
            .iter()
            .map(|e| e.trim_start_matches('.').to_string())
            .collect();
        let ext_refs: Vec<&str> = clean_exts.iter().map(|s| s.as_str()).collect();
        let mut dlg = rfd::FileDialog::new().add_filter(label, &ext_refs);
        if let Some(dir) = default_dir {
            let p = std::path::Path::new(dir);
            if p.is_dir() {
                dlg = dlg.set_directory(p);
            }
        }
        dlg.pick_file()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    }

    fn update_progress(
        &self,
        current_file: &str,
        file_index: usize,
        total_files: usize,
        file_percent: f64,
    ) {
        if let Some(win) = self.app.get_webview_window("main") {
            let overall_pct = if total_files > 0 {
                let completed = file_index.saturating_sub(1) as f64;
                let file_part = (file_percent.clamp(0.0, 100.0)) / 100.0;
                (((completed + file_part) / (total_files as f64)) * 100.0)
                    .round()
                    .clamp(0.0, 100.0) as u64
            } else {
                0
            };
            let _ = win.set_progress_bar(tauri::window::ProgressBarState {
                status: Some(if total_files > 0 {
                    tauri::window::ProgressBarStatus::Normal
                } else {
                    tauri::window::ProgressBarStatus::Indeterminate
                }),
                progress: Some(overall_pct),
            });

            let payload = serde_json::json!({
                "currentFile": current_file,
                "fileIndex": file_index,
                "totalFiles": total_files,
                "filePercent": file_percent,
            });
            if let Ok(json_str) = serde_json::to_string(&payload) {
                let script = format!(
                    "if(window.frontend_api && window.frontend_api.update_progress) window.frontend_api.update_progress({});",
                    json_str
                );
                let _ = win.eval(&script);
            }
        }
    }

    fn clear_progress(&self) {
        if let Some(win) = self.app.get_webview_window("main") {
            let _ = win.set_progress_bar(tauri::window::ProgressBarState {
                status: Some(tauri::window::ProgressBarStatus::None),
                progress: None,
            });
        }
    }
}

#[tauri::command]
async fn run_module(
    state: State<'_, Api>,
    module_name: String,
    settings: Value,
    paths: Option<PathsInput>,
    repeat: Option<bool>,
) -> Result<RunResult, String> {
    let api = state.inner().clone();
    let is_repeat = repeat.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || {
        api.run_module(&module_name, &settings, paths, is_repeat)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_task(state: State<'_, Api>) -> Value {
    state.stop_task()
}

#[tauri::command]
fn resolve_input(state: State<'_, Api>, callback_id: String, result: Option<String>) {
    state.resolve_input(&callback_id, result);
}

#[tauri::command]
fn resolve_matcher(
    state: State<'_, Api>,
    callback_id: String,
    res: Vec<(String, String)>,
    source_order: Option<Vec<String>>,
) {
    state.resolve_matcher(&callback_id, res, source_order);
}

#[tauri::command]
async fn pick_folder(
    state: State<'_, Api>,
    default_path: Option<String>,
) -> Result<String, String> {
    let api = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        api.pick_folder_with_default(default_path.as_deref())
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_file(
    state: State<'_, Api>,
    media_type: Option<String>,
    default_path: Option<String>,
) -> Result<String, String> {
    let api = state.inner().clone();
    let kind = media_type.unwrap_or_else(|| "video".to_string());
    tauri::async_runtime::spawn_blocking(move || {
        api.pick_file_with_default(&kind, default_path.as_deref())
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn show_in_folder(state: State<'_, Api>, path: String) -> Result<(), String> {
    state.show_in_folder(&path)
}

#[tauri::command]
fn get_version(state: State<'_, Api>) -> String {
    state.get_version()
}

#[tauri::command]
async fn inspect_media(state: State<'_, Api>, path: String) -> Result<Value, String> {
    let api = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || api.inspect_media(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn preview_sync_mpv(
    state: State<'_, Api>,
    target: String,
    audio_file: Option<String>,
    audio_delay_ms: Option<i64>,
    sub_file: Option<String>,
    sub_delay_ms: Option<i64>,
    start_time: Option<String>,
) -> Result<Value, String> {
    let api = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        api.preview_sync_mpv(
            &target,
            audio_file.as_deref(),
            audio_delay_ms,
            sub_file.as_deref(),
            sub_delay_ms,
            start_time.as_deref(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn save_settings(settings: Value) -> Result<(), String> {
    crate::core::config::save_user_config(&settings)
}

#[tauri::command]
fn load_settings() -> Value {
    crate::core::config::load_user_config()
}

#[tauri::command]
fn check_external_tools() -> std::collections::HashMap<String, crate::core::processes::ToolStatus> {
    crate::core::processes::check_all_tools()
}

pub fn run() {
    crate::core::processes::setup_environment();
    let api = Api::new();
    let api_for_setup = api.clone();
    let api_for_events = api.clone();

    tauri::Builder::default()
        .manage(api)
        .setup(move |app| {
            let bridge = Arc::new(TauriWindowBridge {
                app: app.handle().clone(),
            });
            api_for_setup.set_bridge(Some(bridge));
            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let WindowEvent::Destroyed = event {
                api_for_events.cancel_pending_matchers();
            }
        })
        .invoke_handler(tauri::generate_handler![
            run_module,
            stop_task,
            resolve_input,
            resolve_matcher,
            pick_folder,
            pick_file,
            show_in_folder,
            get_version,
            inspect_media,
            preview_sync_mpv,
            save_settings,
            load_settings,
            check_external_tools
        ])
        .run(tauri::generate_context!())
        .expect("error while running SyncForge Tauri application");
}
}

#[cfg(feature = "gui")]
pub use gui_app::run;

