use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;
use uuid::Uuid;

use crate::core::mkv_tools::Track;
use crate::core::processes::{start_process, stop_process_tree};
use crate::core::tasks::{check_cancelled, current_task, TaskError};

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct AskOptions {
    #[serde(default)]
    pub tracks: Vec<Track>,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default)]
    pub allow_empty: bool,
    #[serde(default)]
    pub allow_skip: bool,
    #[serde(default)]
    pub context: Option<String>,
    #[serde(default)]
    pub files: Vec<String>,
}

fn default_kind() -> String {
    "text".to_string()
}

pub type AskInputCallback = Arc<dyn Fn(&str, AskOptions) -> Result<String, TaskError> + Send + Sync>;
pub type AskDirectoryCallback = Arc<dyn Fn(&str) -> Result<String, TaskError> + Send + Sync>;
pub type AskMatcherCallback =
    Arc<dyn Fn(Vec<String>, Vec<String>) -> Result<Vec<(String, String)>, TaskError> + Send + Sync>;
pub type LogCallback = Arc<dyn Fn(&str) + Send + Sync>;
pub type SubprocessHook = Arc<dyn Fn(&[String], Option<&Path>) -> Result<i32, TaskError> + Send + Sync>;

pub type ProgressCallback = Arc<dyn Fn(&str, usize, usize, f64) + Send + Sync>;

#[derive(Debug, Clone, Default)]
pub struct ProgressState {
    pub current_file: String,
    pub file_index: usize,
    pub total_files: usize,
    pub file_percent: f64,
}

static ASK_INPUT_CB: RwLock<Option<AskInputCallback>> = RwLock::new(None);
static ASK_DIR_CB: RwLock<Option<AskDirectoryCallback>> = RwLock::new(None);
static ASK_MATCHER_CB: RwLock<Option<AskMatcherCallback>> = RwLock::new(None);
static LOG_CB: RwLock<Option<LogCallback>> = RwLock::new(None);
static PROGRESS_CB: RwLock<Option<ProgressCallback>> = RwLock::new(None);
static PROGRESS_STATE: RwLock<ProgressState> = RwLock::new(ProgressState {
    current_file: String::new(),
    file_index: 0,
    total_files: 0,
    file_percent: 0.0,
});
static SUBPROCESS_HOOK: RwLock<Option<SubprocessHook>> = RwLock::new(None);

pub fn set_ask_input_callback(cb: Option<AskInputCallback>) {
    *ASK_INPUT_CB.write().unwrap() = cb;
}

pub fn set_ask_directory_callback(cb: Option<AskDirectoryCallback>) {
    *ASK_DIR_CB.write().unwrap() = cb;
}

pub fn set_ask_matcher_callback(cb: Option<AskMatcherCallback>) {
    *ASK_MATCHER_CB.write().unwrap() = cb;
}

pub fn set_log_callback(cb: Option<LogCallback>) {
    *LOG_CB.write().unwrap() = cb;
}

pub fn set_progress_callback(cb: Option<ProgressCallback>) {
    *PROGRESS_CB.write().unwrap() = cb;
}

pub fn set_file_progress(current_file: &str, file_index: usize, total_files: usize) {
    {
        let mut state = PROGRESS_STATE.write().unwrap();
        state.current_file = current_file.to_string();
        state.file_index = file_index;
        state.total_files = total_files;
        state.file_percent = 0.0;
    }
    if let Some(cb) = PROGRESS_CB.read().unwrap().clone() {
        cb(current_file, file_index, total_files, 0.0);
    }
}

pub fn report_file_percent(file_percent: f64) {
    let (cur_file, idx, total) = {
        let mut state = PROGRESS_STATE.write().unwrap();
        state.file_percent = file_percent;
        (state.current_file.clone(), state.file_index, state.total_files)
    };
    if let Some(cb) = PROGRESS_CB.read().unwrap().clone() {
        cb(&cur_file, idx, total, file_percent);
    }
}

pub fn reset_file_progress() {
    {
        let mut state = PROGRESS_STATE.write().unwrap();
        state.current_file.clear();
        state.file_index = 0;
        state.total_files = 0;
        state.file_percent = 0.0;
    }
    if let Some(cb) = PROGRESS_CB.read().unwrap().clone() {
        cb("", 0, 0, 0.0);
    }
}

pub fn parse_progress_percent(line: &str) -> Option<f64> {
    let lower = line.to_lowercase();
    if let Some(pos) = lower.find("progress:") {
        let slice = lower[pos + 9..].trim_start();
        let num_str: String = slice.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(val) = num_str.parse::<f64>() {
            return Some(val.clamp(0.0, 100.0));
        }
    }
    // Also support tqdm progress format like " 45%|" or "100%|" from ffsubsync
    if let Some(pct_pos) = line.find('%') {
        let before = line[..pct_pos].trim();
        let digits: String = before
            .chars()
            .rev()
            .take_while(|c| c.is_ascii_digit())
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        if !digits.is_empty() {
            if let Ok(val) = digits.parse::<f64>() {
                let after = line[pct_pos + 1..].trim_start();
                if after.starts_with('|') || lower.contains("sync") {
                    return Some(val.clamp(0.0, 100.0));
                }
            }
        }
    }
    None
}

pub fn set_subprocess_hook(hook: Option<SubprocessHook>) {
    *SUBPROCESS_HOOK.write().unwrap() = hook;
}

pub fn log_line(text: &str) {
    let formatted = format!("{}\n", text);
    log_raw(&formatted);
}

pub fn log_raw(text: &str) {
    print!("{}", text);
    if let Some(cb) = LOG_CB.read().unwrap().clone() {
        cb(text);
    }
}

pub fn ask_user(prompt: &str, options: AskOptions) -> Result<String, TaskError> {
    check_cancelled()?;
    if let Some(cb) = ASK_INPUT_CB.read().unwrap().clone() {
        return cb(prompt, options);
    }
    Err(TaskError::Cancelled)
}

pub fn ask_directory(caption: &str) -> Result<String, TaskError> {
    check_cancelled()?;
    if let Some(cb) = ASK_DIR_CB.read().unwrap().clone() {
        return cb(caption);
    }
    Ok(String::new())
}

pub fn match_files(
    targets: Vec<String>,
    sources: Vec<String>,
) -> Result<Vec<(String, String)>, TaskError> {
    check_cancelled()?;
    if let Some(cb) = ASK_MATCHER_CB.read().unwrap().clone() {
        return cb(targets, sources);
    }
    Ok(Vec::new())
}

pub fn normalize_path(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else if let Ok(cwd) = std::env::current_dir() {
        cwd.join(path)
    } else {
        path.to_path_buf()
    }
}

/// Return one selected file or recursively find matching files in a folder.
pub fn get_files_recursive(folder: &str, extensions: &[&str]) -> Result<Vec<String>, TaskError> {
    check_cancelled()?;
    let normalized = normalize_path(Path::new(folder));
    let normalized_str = normalized.to_string_lossy().to_string();

    if normalized.is_file() {
        let lower = normalized_str.to_lowercase();
        if !extensions.iter().any(|ext| lower.ends_with(&ext.to_lowercase())) {
            return Err(TaskError::Message(format!(
                "Unsupported file type: {}",
                normalized_str
            )));
        }
        return Ok(vec![normalized_str]);
    }

    if !normalized.is_dir() {
        return Err(TaskError::Message(format!(
            "File or folder does not exist: {}",
            normalized_str
        )));
    }

    let mut found_files = Vec::new();
    collect_files_in_dir(&normalized, extensions, &mut found_files)?;
    found_files.sort();
    Ok(found_files)
}

fn collect_files_in_dir(
    dir: &Path,
    extensions: &[&str],
    out: &mut Vec<String>,
) -> Result<(), TaskError> {
    check_cancelled()?;
    let entries = fs::read_dir(dir)
        .map_err(|e| TaskError::Message(format!("Cannot read directory {:?}: {}", dir, e)))?;
    for entry in entries {
        check_cancelled()?;
        let entry = entry.map_err(|e| TaskError::Message(e.to_string()))?;
        let path = entry.path();
        if path.is_dir() {
            collect_files_in_dir(&path, extensions, out)?;
        } else if path.is_file() {
            let name_lower = path
                .file_name()
                .map(|n| n.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if extensions
                .iter()
                .any(|ext| name_lower.ends_with(&ext.to_lowercase()))
            {
                out.push(normalize_path(&path).to_string_lossy().to_string());
            }
        }
    }
    Ok(())
}

/// Creates a unique text signature based on the structure of a file's audio/sub tracks.
pub fn get_track_signature(tracks: &[Track]) -> String {
    let mut parts = Vec::new();
    for t in tracks {
        if t.track_type == "audio" || t.track_type == "subtitles" {
            let lang = t
                .properties
                .as_ref()
                .and_then(|p| p.language.as_deref())
                .unwrap_or("und");
            let codec = t.codec.as_deref().unwrap_or("Unknown");
            parts.push(format!("{}_{}_{}_{}", t.id, t.track_type, lang, codec));
        }
    }
    parts.join("|")
}

/// Validate track IDs before constructing commands which can remove tracks.
pub fn parse_track_selection(selection: &str, tracks: &[Track]) -> Result<Vec<i64>, TaskError> {
    if selection == "n" {
        return Ok(Vec::new());
    }
    if selection.is_empty() {
        return Ok(tracks.iter().map(|t| t.id).collect());
    }
    let mut ids = Vec::new();
    for part in selection.split(',') {
        let trimmed = part.trim();
        let val = trimmed.parse::<i64>().map_err(|_| {
            TaskError::Message("Track IDs must be comma-separated whole numbers.".to_string())
        })?;
        ids.push(val);
    }
    let valid_ids: HashSet<i64> = tracks.iter().map(|t| t.id).collect();
    if !ids.iter().all(|id| valid_ids.contains(id)) {
        return Err(TaskError::Message(
            "The selection contains a track ID that is not available.".to_string(),
        ));
    }
    let mut deduped = Vec::new();
    let mut seen = HashSet::new();
    for id in ids {
        if seen.insert(id) {
            deduped.push(id);
        }
    }
    Ok(deduped)
}

/// Helper to stream a child process stdout or stderr chunk by chunk, emitting lines on \r or \n.
pub fn stream_output<R: Read + Send + 'static>(mut reader: R, tx: mpsc::Sender<Option<String>>) {
    let mut buf = [0u8; 1024];
    let mut current = Vec::new();
    let mut prev_was_cr = false;
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                for &b in &buf[..n] {
                    if b == b'\r' {
                        prev_was_cr = true;
                        if !current.is_empty() {
                            let s = String::from_utf8_lossy(&current).to_string();
                            let _ = tx.send(Some(format!("{}\n", s)));
                            current.clear();
                        }
                    } else if b == b'\n' {
                        if prev_was_cr && current.is_empty() {
                            prev_was_cr = false;
                        } else {
                            prev_was_cr = false;
                            let s = String::from_utf8_lossy(&current).to_string();
                            let _ = tx.send(Some(format!("{}\n", s)));
                            current.clear();
                        }
                    } else {
                        prev_was_cr = false;
                        current.push(b);
                        if current.len() >= 4096 {
                            let s = String::from_utf8_lossy(&current).to_string();
                            let _ = tx.send(Some(format!("{}\n", s)));
                            current.clear();
                        }
                    }
                }
            }
            Err(_) => break,
        }
    }
    if !current.is_empty() {
        let s = String::from_utf8_lossy(&current).to_string();
        let _ = tx.send(Some(format!("{}\n", s)));
    }
    let _ = tx.send(None);
}

/// Runs a subprocess, streams output in real time, stages mkvmerge outputs, and handles cancellation.
pub fn run_subprocess(cmd: &[String], cwd: Option<&Path>) -> Result<i32, TaskError> {
    if let Some(hook) = SUBPROCESS_HOOK.read().unwrap().clone() {
        return hook(cmd, cwd);
    }
    if cmd.is_empty() {
        return Err(TaskError::Message("Empty command".to_string()));
    }

    let mut actual_cmd = cmd.to_vec();
    let tool = Path::new(&actual_cmd[0])
        .file_stem()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let mut output_target: Option<PathBuf> = None;
    let mut staged_target: Option<PathBuf> = None;
    let mut is_mkv_output = false;

    if let Some(pos) = actual_cmd.iter().position(|arg| arg == "-o") {
        if pos + 1 < actual_cmd.len() {
            let out_arg = PathBuf::from(&actual_cmd[pos + 1]);
            if out_arg
                .extension()
                .map(|e| e.to_string_lossy().eq_ignore_ascii_case("mkv"))
                .unwrap_or(false)
            {
                is_mkv_output = true;
                if tool == "mkvmerge" {
                    let resolved = if out_arg.is_absolute() {
                        out_arg
                    } else if let Some(dir) = cwd {
                        dir.join(out_arg)
                    } else {
                        normalize_path(&out_arg)
                    };
                    let staged = resolved.with_file_name(format!(
                        ".syncforge-part-{}.mkv",
                        Uuid::new_v4().simple()
                    ));
                    actual_cmd[pos + 1] = staged.to_string_lossy().to_string();
                    output_target = Some(resolved);
                    staged_target = Some(staged);
                }
            }
        }
    }

    let mut child = match start_process(&actual_cmd, cwd, false) {
        Ok(c) => c,
        Err(e) => {
            if let Some(ref staged) = staged_target {
                let _ = fs::remove_file(staged);
            }
            return Err(e);
        }
    };

    let (tx, rx) = mpsc::channel::<Option<String>>();

    if let Some(stdout) = child.stdout.take() {
        let tx_out = tx.clone();
        thread::spawn(move || {
            stream_output(stdout, tx_out);
        });
    } else {
        let _ = tx.send(None);
    }

    if let Some(stderr) = child.stderr.take() {
        let tx_err = tx;
        thread::spawn(move || {
            stream_output(stderr, tx_err);
        });
    } else {
        let _ = tx.send(None);
    }

    let mut closed_streams = 0;
    let run_result: Result<i32, TaskError> = (|| {
        while closed_streams < 2 {
            if tool != "mkvpropedit" {
                check_cancelled()?;
            }
            match rx.recv_timeout(Duration::from_millis(50)) {
                Ok(Some(line)) => {
                    if let Some(pct) = parse_progress_percent(&line) {
                        report_file_percent(pct);
                    }
                    log_raw(&line);
                }
                Ok(None) => closed_streams += 1,
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if let Ok(Some(_)) = child.try_wait() {
                        while let Ok(item) = rx.try_recv() {
                            if let Some(line) = item {
                                if let Some(pct) = parse_progress_percent(&line) {
                                    report_file_percent(pct);
                                }
                                log_raw(&line);
                            }
                        }
                        break;
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }

        let status = loop {
            if tool != "mkvpropedit" {
                check_cancelled()?;
            }
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) => thread::sleep(Duration::from_millis(25)),
                Err(e) => return Err(TaskError::Message(format!("Wait failed: {}", e))),
            }
        };

        if tool != "mkvpropedit" {
            check_cancelled()?;
        }

        let returncode = status.code().unwrap_or(-1);
        let is_mkv_tool = matches!(tool.as_str(), "mkvmerge" | "mkvextract" | "mkvpropedit");
        let valid = if is_mkv_tool {
            returncode == 0 || returncode == 1
        } else {
            returncode == 0
        };

        if !valid {
            return Err(TaskError::Message(format!(
                "Command '{}' returned non-zero exit status {}",
                tool, returncode
            )));
        }

        report_file_percent(100.0);

        if let (Some(ref staged), Some(ref output)) = (&staged_target, &output_target) {
            if staged.exists() {
                fs::rename(staged, output).map_err(|e| {
                    TaskError::Message(format!("Failed to finalize output {:?}: {}", output, e))
                })?;
            }
        }

        Ok(returncode)
    })();

    if run_result.is_err() {
        stop_process_tree(&mut child);
    }
    if let Some(ref staged) = staged_target {
        if staged.exists() {
            let _ = fs::remove_file(staged);
        }
    }

    let mut returncode = run_result?;
    let progress = current_task();
    let is_mkv_tool = matches!(tool.as_str(), "mkvmerge" | "mkvextract" | "mkvpropedit");

    if returncode == 1 && is_mkv_tool {
        if let Some(ref p) = progress {
            p.add_warning(1);
        }
        log_line(&format!(
            "[Warning] {} finished with warnings; see the output above.",
            tool
        ));
        returncode = 0;
    }

    if let Some(ref p) = progress {
        if tool == "mkvpropedit" || (tool == "mkvmerge" && is_mkv_output) {
            p.add_output(1);
        }
    }

    Ok(returncode)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_parse_progress_percent_mkvmerge() {
        assert_eq!(parse_progress_percent("Progress: 0%"), Some(0.0));
        assert_eq!(parse_progress_percent("Progress: 42%"), Some(42.0));
        assert_eq!(parse_progress_percent("Progress: 100%"), Some(100.0));
        assert_eq!(parse_progress_percent("# mkvmerge progress: 87%"), Some(87.0));
    }

    #[test]
    fn test_parse_progress_percent_tqdm() {
        assert_eq!(
            parse_progress_percent(" 45%|████████▍         | 450/1000 [00:04<00:05, 95.23it/s]"),
            Some(45.0)
        );
        assert_eq!(
            parse_progress_percent("100%|██████████████████| 1000/1000 [00:09<00:00, 105.12it/s]"),
            Some(100.0)
        );
        assert_eq!(parse_progress_percent("Normal log line without percent"), None);
    }

    #[test]
    fn test_stream_output_carriage_returns() {
        let input = b"Progress: 10%\rProgress: 20%\rProgress: 30%\r";
        let cursor = Cursor::new(input.to_vec());
        let (tx, rx) = mpsc::channel();
        stream_output(cursor, tx);

        let mut lines = Vec::new();
        while let Ok(Some(line)) = rx.recv() {
            lines.push(line);
        }
        assert_eq!(lines, vec!["Progress: 10%\n", "Progress: 20%\n", "Progress: 30%\n"]);
    }

    #[test]
    fn test_stream_output_crlf_and_lf() {
        let input = b"Line 1\r\nLine 2\nLine 3\rLine 4";
        let cursor = Cursor::new(input.to_vec());
        let (tx, rx) = mpsc::channel();
        stream_output(cursor, tx);

        let mut lines = Vec::new();
        while let Ok(Some(line)) = rx.recv() {
            lines.push(line);
        }
        assert_eq!(lines, vec!["Line 1\n", "Line 2\n", "Line 3\n", "Line 4\n"]);
    }
}

