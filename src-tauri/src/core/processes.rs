use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;
#[cfg(unix)]
use std::time::Instant;

use crate::core::tasks::{check_cancelled, TaskError};

#[derive(Debug, Clone)]
pub struct CompletedProcess {
    pub cmd: Vec<String>,
    pub returncode: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Returns the search directories for external CLI tools across all platforms.
pub fn get_search_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // Look in the same directory as the SyncForge executable and portable subdirectories
    if let Ok(exe_path) = std::env::current_exe() {
        let mut app_dirs = Vec::new();
        if let Some(parent) = exe_path.parent() {
            app_dirs.push(parent.to_path_buf());

            #[cfg(target_os = "macos")]
            {
                // If running inside SyncForge.app/Contents/MacOS, also inspect the folder containing SyncForge.app
                let parent_str = parent.to_string_lossy();
                if parent_str.ends_with("Contents/MacOS") || parent_str.ends_with("Contents/MacOS/") {
                    if let Some(app_bundle) = parent.parent().and_then(|p| p.parent()) {
                        if let Some(bundle_dir) = app_bundle.parent() {
                            app_dirs.push(bundle_dir.to_path_buf());
                        }
                    }
                }
            }
        }

        for base in app_dirs {
            if base.is_dir() && !dirs.contains(&base) {
                dirs.push(base.clone());
            }

            // Common subdirectories for portable setups: bin, tools, ffmpeg, mkvtoolnix, ffsubsync, mpv
            let common_subs = [
                "bin",
                "tools",
                "ffmpeg",
                "ffmpeg/bin",
                "mkvtoolnix",
                "MKVToolNix",
                "ffsubsync",
                "mpv",
                "mpv/bin",
            ];
            for sub in &common_subs {
                let sub_path = base.join(sub);
                if sub_path.is_dir() && !dirs.contains(&sub_path) {
                    dirs.push(sub_path);
                }
            }

            // Also check all immediate subdirectories of the application directory (1 level deep)
            if let Ok(entries) = std::fs::read_dir(&base) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() && !dirs.contains(&path) {
                        dirs.push(path.clone());
                        let sub_bin = path.join("bin");
                        if sub_bin.is_dir() && !dirs.contains(&sub_bin) {
                            dirs.push(sub_bin);
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let macos_known = [
            "/Applications/MKVToolNix.app/Contents/MacOS",
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
            "/opt/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ];
        for d in &macos_known {
            let pb = PathBuf::from(d);
            if pb.is_dir() && !dirs.contains(&pb) {
                dirs.push(pb);
            }
        }

        // Also detect any /Applications/MKVToolNix*.app
        if let Ok(entries) = std::fs::read_dir("/Applications") {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("MKVToolNix") && name_str.ends_with(".app") {
                    let pb = entry.path().join("Contents/MacOS");
                    if pb.is_dir() && !dirs.contains(&pb) {
                        dirs.push(pb);
                    }
                }
            }
        }

        if let Ok(home) = std::env::var("HOME") {
            let user_known = [
                format!("{}/Applications/MKVToolNix.app/Contents/MacOS", home),
                format!("{}/.local/bin", home),
                format!("{}/.cargo/bin", home),
                format!("{}/bin", home),
            ];
            for d in &user_known {
                let pb = PathBuf::from(d);
                if pb.is_dir() && !dirs.contains(&pb) {
                    dirs.push(pb);
                }
            }
        }
    }

    #[cfg(windows)]
    {
        let win_known = [
            r"C:\Program Files\MKVToolNix",
            r"C:\Program Files (x86)\MKVToolNix",
            r"C:\ffmpeg\bin",
            r"C:\tools\ffmpeg\bin",
            r"C:\tools\mkvtoolnix",
            r"C:\ProgramData\chocolatey\bin",
        ];
        for d in &win_known {
            let pb = PathBuf::from(d);
            if pb.is_dir() && !dirs.contains(&pb) {
                dirs.push(pb);
            }
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let user_known = [
                format!(r"{}\.local\bin", userprofile),
                format!(r"{}\.cargo\bin", userprofile),
                format!(r"{}\bin", userprofile),
            ];
            for d in &user_known {
                let pb = PathBuf::from(d);
                if pb.is_dir() && !dirs.contains(&pb) {
                    dirs.push(pb);
                }
            }
        }
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            let programs = PathBuf::from(&localappdata).join("Programs");
            if programs.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&programs) {
                    for entry in entries.flatten() {
                        let bin = entry.path().join("bin");
                        if bin.is_dir() && !dirs.contains(&bin) {
                            dirs.push(bin);
                        }
                    }
                }
                // Detect Python Scripts installed in %LOCALAPPDATA%\Programs\Python\Python*\Scripts (pip install ffsubsync)
                let python_dir = programs.join("Python");
                if python_dir.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(&python_dir) {
                        for entry in entries.flatten() {
                            let scripts = entry.path().join("Scripts");
                            if scripts.is_dir() && !dirs.contains(&scripts) {
                                dirs.push(scripts);
                            }
                        }
                    }
                }
            }
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            // Detect Python Scripts in %APPDATA%\Python\Python*\Scripts
            let py_dir = PathBuf::from(&appdata).join("Python");
            if py_dir.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&py_dir) {
                    for entry in entries.flatten() {
                        let scripts = entry.path().join("Scripts");
                        if scripts.is_dir() && !dirs.contains(&scripts) {
                            dirs.push(scripts);
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let linux_known = [
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/snap/bin",
            "/var/lib/flatpak/exports/bin",
        ];
        for d in &linux_known {
            let pb = PathBuf::from(d);
            if pb.is_dir() && !dirs.contains(&pb) {
                dirs.push(pb);
            }
        }
        if let Ok(home) = std::env::var("HOME") {
            let user_known = [
                format!("{}/.local/bin", home),
                format!("{}/.cargo/bin", home),
                format!("{}/bin", home),
            ];
            for d in &user_known {
                let pb = PathBuf::from(d);
                if pb.is_dir() && !dirs.contains(&pb) {
                    dirs.push(pb);
                }
            }
        }
    }

    // Existing PATH
    if let Ok(path_var) = std::env::var("PATH") {
        #[cfg(windows)]
        let sep = ';';
        #[cfg(not(windows))]
        let sep = ':';
        for p in path_var.split(sep) {
            let pb = PathBuf::from(p);
            if !p.is_empty() && pb.is_dir() && !dirs.contains(&pb) {
                dirs.push(pb);
            }
        }
    }

    dirs
}

/// Resolves an external executable name to its full path if found in search directories.
pub fn resolve_executable(name: &str) -> String {
    let p = Path::new(name);
    if p.is_file() || name.contains('/') || (cfg!(windows) && name.contains('\\')) {
        return name.to_string();
    }

    let dirs = get_search_directories();
    #[cfg(windows)]
    let extensions = ["", ".exe", ".com", ".cmd", ".bat"];
    #[cfg(not(windows))]
    let extensions = [""];

    for dir in &dirs {
        for ext in &extensions {
            let candidate = dir.join(format!("{}{}", name, ext));
            if candidate.is_file() {
                return candidate.to_string_lossy().into_owned();
            }
        }
    }

    name.to_string()
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolStatus {
    pub name: String,
    pub found: bool,
    pub path: Option<String>,
}

pub fn check_tool_status(name: &str) -> ToolStatus {
    let resolved = resolve_executable(name);
    let p = Path::new(&resolved);
    if p.is_file() {
        ToolStatus {
            name: name.to_string(),
            found: true,
            path: Some(p.to_string_lossy().to_string()),
        }
    } else {
        ToolStatus {
            name: name.to_string(),
            found: false,
            path: None,
        }
    }
}

pub fn check_all_tools() -> HashMap<String, ToolStatus> {
    let tools = ["mkvmerge", "mkvextract", "mkvpropedit", "ffmpeg", "ffsubsync", "mpv"];
    let mut map = HashMap::new();
    for tool in &tools {
        map.insert(tool.to_string(), check_tool_status(tool));
    }
    map
}

/// Initializes process PATH by prepending all known tool directories.
pub fn setup_environment() {
    let dirs = get_search_directories();
    #[cfg(windows)]
    let sep = ";";
    #[cfg(not(windows))]
    let sep = ":";
    let combined = dirs
        .iter()
        .map(|d| d.to_string_lossy())
        .collect::<Vec<_>>()
        .join(sep);
    std::env::set_var("PATH", &combined);
}

/// Keep bundled library overrides out of system tools' library search path
/// and ensure standard MKVToolNix/Homebrew/local binary paths are present.
pub fn external_tool_environment() -> HashMap<String, String> {
    let mut env: HashMap<String, String> = std::env::vars().collect();
    external_tool_environment_from(&mut env, cfg!(target_os = "linux"));
    let dirs = get_search_directories();
    #[cfg(windows)]
    let sep = ";";
    #[cfg(not(windows))]
    let sep = ":";
    let combined = dirs
        .iter()
        .map(|d| d.to_string_lossy())
        .collect::<Vec<_>>()
        .join(sep);
    env.insert("PATH".to_string(), combined);
    env
}

pub fn external_tool_environment_from(env: &mut HashMap<String, String>, is_linux: bool) {
    if is_linux {
        if let Some(orig) = env.get("LD_LIBRARY_PATH_ORIG").cloned() {
            env.insert("LD_LIBRARY_PATH".to_string(), orig);
        }
    }
}

pub fn start_process(
    cmd: &[String],
    cwd: Option<&Path>,
    capture: bool,
) -> Result<Child, TaskError> {
    check_cancelled()?;
    if cmd.is_empty() {
        return Err(TaskError::Message("Empty command".to_string()));
    }

    let resolved_binary = resolve_executable(&cmd[0]);
    let mut command = Command::new(&resolved_binary);
    if cmd.len() > 1 {
        command.args(&cmd[1..]);
    }
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    command.envs(external_tool_environment());
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    if capture {
        command.stderr(Stdio::piped());
    } else {
        command.stderr(Stdio::piped());
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        command.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    command
        .spawn()
        .map_err(|e| TaskError::Message(format!("Failed to start '{}': {}", cmd[0], e)))
}

pub fn stop_process_tree(child: &mut Child) {
    if let Ok(Some(_)) = child.try_wait() {
        return;
    }
    let pid = child.id();

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }

    #[cfg(unix)]
    {
        unsafe {
            let _ = libc::kill(-(pid as i32), libc::SIGTERM);
        }
        let deadline = Instant::now() + Duration::from_secs(2);
        let mut exited = false;
        while Instant::now() < deadline {
            if let Ok(Some(_)) = child.try_wait() {
                exited = true;
                break;
            }
            thread::sleep(Duration::from_millis(25));
        }
        if !exited {
            unsafe {
                let _ = libc::kill(-(pid as i32), libc::SIGKILL);
            }
        }
    }

    let _ = child.wait();
}

pub fn capture_command(
    cmd: &[String],
    cwd: Option<&Path>,
) -> Result<CompletedProcess, TaskError> {
    let mut child = start_process(cmd, cwd, true)?;
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();

    let out_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut pipe) = stdout_pipe {
            let _ = pipe.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).into_owned()
    });

    let err_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut pipe) = stderr_pipe {
            let _ = pipe.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).into_owned()
    });

    let status = loop {
        if let Err(err) = check_cancelled() {
            stop_process_tree(&mut child);
            let _ = out_handle.join();
            let _ = err_handle.join();
            return Err(err);
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(e) => {
                stop_process_tree(&mut child);
                return Err(TaskError::Message(format!("Process wait error: {}", e)));
            }
        }
    };

    if let Err(err) = check_cancelled() {
        stop_process_tree(&mut child);
        return Err(err);
    }

    let stdout = out_handle.join().unwrap_or_default();
    let stderr = err_handle.join().unwrap_or_default();
    let returncode = status.code().unwrap_or(-1);

    Ok(CompletedProcess {
        cmd: cmd.to_vec(),
        returncode,
        stdout,
        stderr,
    })
}

pub fn build_mpv_preview_args(
    target: &str,
    audio_file: Option<&str>,
    audio_delay_ms: Option<i64>,
    sub_file: Option<&str>,
    sub_delay_ms: Option<i64>,
    start_time: Option<&str>,
) -> Vec<String> {
    let mut args = vec![target.to_string()];

    if let Some(af) = audio_file.map(str::trim).filter(|s| !s.is_empty()) {
        args.push(format!("--audio-file={}", af));
    }
    if let Some(ad) = audio_delay_ms {
        args.push(format!("--audio-delay={:.3}", (ad as f64) / 1000.0));
    }
    if let Some(sf) = sub_file.map(str::trim).filter(|s| !s.is_empty()) {
        args.push(format!("--sub-file={}", sf));
    }
    if let Some(sd) = sub_delay_ms {
        args.push(format!("--sub-delay={:.3}", (sd as f64) / 1000.0));
    }
    if let Some(st) = start_time.map(str::trim).filter(|s| !s.is_empty()) {
        args.push(format!("--start={}", st));
    }

    let a_ms = audio_delay_ms.unwrap_or(0);
    let s_ms = sub_delay_ms.unwrap_or(0);
    args.push(format!(
        "--title=SyncForge Preview — Audio: {:+}ms | Sub: {:+}ms",
        a_ms, s_ms
    ));
    args
}

pub fn preview_sync_mpv(
    target: &str,
    audio_file: Option<&str>,
    audio_delay_ms: Option<i64>,
    sub_file: Option<&str>,
    sub_delay_ms: Option<i64>,
    start_time: Option<&str>,
) -> Result<Vec<String>, String> {
    let trimmed_target = target.trim();
    if trimmed_target.is_empty() {
        return Err("Target video path is empty.".to_string());
    }

    let args = build_mpv_preview_args(
        trimmed_target,
        audio_file,
        audio_delay_ms,
        sub_file,
        sub_delay_ms,
        start_time,
    );

    let resolved_binary = resolve_executable("mpv");
    let mut command = Command::new(&resolved_binary);
    command.args(&args);
    command.envs(external_tool_environment());
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::null());

    command.spawn().map_err(|e| {
        format!(
            "Failed to launch mpv ('{}'): {}. Make sure mpv is installed on your PATH or placed in the tools/ folder.",
            resolved_binary, e
        )
    })?;

    let mut full_cmd = vec![resolved_binary];
    full_cmd.extend(args);
    Ok(full_cmd)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_mpv_preview_args_combined() {
        let args = build_mpv_preview_args(
            "/media/target.mkv",
            Some("/media/source.mkv"),
            Some(-128),
            Some("/media/synced.srt"),
            Some(42),
            Some("00:05:00"),
        );
        assert_eq!(
            args,
            vec![
                "/media/target.mkv",
                "--audio-file=/media/source.mkv",
                "--audio-delay=-0.128",
                "--sub-file=/media/synced.srt",
                "--sub-delay=0.042",
                "--start=00:05:00",
                "--title=SyncForge Preview — Audio: -128ms | Sub: +42ms",
            ]
        );
    }

    #[test]
    fn test_build_mpv_preview_args_subs_only() {
        let args = build_mpv_preview_args(
            "/media/target.mkv",
            None,
            None,
            Some("/media/subs.ass"),
            Some(0),
            Some("00:03:00"),
        );
        assert_eq!(
            args,
            vec![
                "/media/target.mkv",
                "--sub-file=/media/subs.ass",
                "--sub-delay=0.000",
                "--start=00:03:00",
                "--title=SyncForge Preview — Audio: +0ms | Sub: +0ms",
            ]
        );
    }
}

