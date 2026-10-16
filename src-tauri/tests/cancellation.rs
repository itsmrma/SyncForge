use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::json;
use tempfile::tempdir;

use syncforge_lib::core::processes::capture_command;
use syncforge_lib::core::tasks::{with_task, TaskError, TaskProgress};
use syncforge_lib::core::utils::run_subprocess;
use syncforge_lib::ui::backend::Api;

#[cfg(unix)]
#[test]
fn test_stop_interrupts_silent_subprocess_and_allows_next_task() {
    let api = Api::new();
    let started = Arc::new(Mutex::new(false));
    let s_clone = started.clone();

    api.set_module_override(
        "stream_manager",
        Some(Arc::new(move || {
            *s_clone.lock().unwrap() = true;
            run_subprocess(
                &["sh".to_string(), "-c".to_string(), "sleep 30".to_string()],
                None,
            )?;
            Ok(())
        })),
    );

    let api_worker = api.clone();
    let worker = thread::spawn(move || {
        api_worker.run_module(
            "stream_manager",
            &json!({ "notify_on_finish": false }),
            None,
            false,
        )
    });

    let deadline = Instant::now() + Duration::from_secs(3);
    while !*started.lock().unwrap() && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(20));
    }
    thread::sleep(Duration::from_millis(100));

    let stop_start = Instant::now();
    api.stop_task();
    let result = worker.join().unwrap();
    assert!(stop_start.elapsed() < Duration::from_secs(5));
    assert_eq!(result.status, "cancelled");

    // Next task works cleanly
    api.set_module_override("stream_manager", Some(Arc::new(|| Ok(()))));
    let next = api.run_module(
        "stream_manager",
        &json!({ "notify_on_finish": false }),
        None,
        false,
    );
    assert_eq!(next.status, "cancelled");
}

#[cfg(unix)]
#[test]
fn test_analysis_can_be_stopped_before_command_finishes() {
    let task = TaskProgress::new();
    let task_cancel = task.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(200));
        task_cancel.cancel();
    });

    let started = Instant::now();
    let res = with_task(task, || {
        capture_command(
            &["sh".to_string(), "-c".to_string(), "sleep 30".to_string()],
            None,
        )
    });
    assert_eq!(res.unwrap_err(), TaskError::Cancelled);
    assert!(started.elapsed() < Duration::from_secs(5));
}

#[cfg(unix)]
#[test]
fn test_cancelled_mux_removes_partial_file_and_preserves_previous_output() {
    let dir = tempdir().unwrap();
    let fake_bin_dir = dir.path().join("bin");
    fs::create_dir(&fake_bin_dir).unwrap();
    let fake_mkvmerge = fake_bin_dir.join("mkvmerge");

    // Script writes "partial" to the staged -o path and sleeps
    let script = "#!/bin/sh\nwhile [ $# -gt 0 ]; do\n  if [ \"$1\" = \"-o\" ]; then\n    echo \"partial\" > \"$2\"\n    break\n  fi\n  shift\ndone\nsleep 30\n";
    fs::write(&fake_mkvmerge, script).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&fake_mkvmerge).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&fake_mkvmerge, perms).unwrap();
    }

    let out_dir = dir.path().join("out");
    fs::create_dir(&out_dir).unwrap();
    let output = out_dir.join("output.mkv");
    fs::write(&output, b"previous completed output").unwrap();

    let task = TaskProgress::new();
    let task_cancel = task.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(300));
        task_cancel.cancel();
    });

    let res = with_task(task, || {
        run_subprocess(
            &[
                fake_mkvmerge.to_string_lossy().to_string(),
                "-o".to_string(),
                output.to_string_lossy().to_string(),
                "input.mkv".to_string(),
            ],
            Some(&out_dir),
        )
    });

    assert_eq!(res.unwrap_err(), TaskError::Cancelled);
    assert_eq!(
        fs::read(&output).unwrap(),
        b"previous completed output"
    );
    let entries: Vec<_> = fs::read_dir(&out_dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    assert_eq!(entries, vec![output]);
}
