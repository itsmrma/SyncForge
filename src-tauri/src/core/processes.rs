use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use crate::core::tasks::{check_cancelled, TaskError};

#[derive(Debug, Clone)]
pub struct CompletedProcess {
    pub cmd: Vec<String>,
    pub returncode: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Keep bundled library overrides out of system tools' library search path
/// and ensure standard Homebrew/local binary paths are present on macOS/Linux.
pub fn external_tool_environment() -> HashMap<String, String> {
    let mut env: HashMap<String, String> = std::env::vars().collect();
    external_tool_environment_from(&mut env, cfg!(target_os = "linux"));
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let current_path = env.get("PATH").cloned().unwrap_or_default();
        let mut parts: Vec<String> = if current_path.is_empty() {
            Vec::new()
        } else {
            current_path.split(':').map(|s| s.to_string()).collect()
        };
        let mut extra = vec![
            "/opt/homebrew/bin".to_string(),
            "/usr/local/bin".to_string(),
        ];
        if let Some(home) = env.get("HOME") {
            extra.push(format!("{}/.local/bin", home));
            extra.push(format!("{}/.cargo/bin", home));
        }
        for dir in extra.into_iter().rev() {
            if !parts.iter().any(|p| p == &dir) {
                parts.insert(0, dir);
            }
        }
        env.insert("PATH".to_string(), parts.join(":"));
    }
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

    let mut command = Command::new(&cmd[0]);
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
