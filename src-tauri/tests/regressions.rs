use std::collections::HashMap;
use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use hound::{SampleFormat, WavSpec, WavWriter};
use serde_json::{json, Value};
use tempfile::tempdir;

use syncforge_lib::core::audio_sync::find_audio_delay;
use syncforge_lib::core::mkv_tools::{
    clear_metadata_cache, get_tracks_info, has_attachments, set_capture_hook, Track,
};
use syncforge_lib::core::notifications::{
    build_linux_notify_send_command, build_macos_notification_command, notify_task_finished,
    set_notify_hook,
};
use syncforge_lib::core::processes::{external_tool_environment_from, CompletedProcess};
use syncforge_lib::core::tasks::{current_task, with_task, TaskError, TaskProgress};
use syncforge_lib::core::utils::{
    ask_directory, get_files_recursive, match_files, parse_track_selection, AskOptions,
};
#[cfg(unix)]
use syncforge_lib::core::utils::run_subprocess;
use syncforge_lib::ui::backend::{Api, FrontendBridge, PathsInput};

static TEST_LOCK: Mutex<()> = Mutex::new(());

struct MockBridge {
    on_input: Option<Box<dyn Fn(&Value, &str) -> bool + Send + Sync>>,
    on_matcher: Option<Box<dyn Fn(&[String], &[String], &str) -> bool + Send + Sync>>,
    picked_folder: Mutex<String>,
    picked_file: Mutex<String>,
    last_file_filter: Mutex<(String, Vec<String>)>,
}

impl Default for MockBridge {
    fn default() -> Self {
        Self {
            on_input: None,
            on_matcher: None,
            picked_folder: Mutex::new(String::new()),
            picked_file: Mutex::new(String::new()),
            last_file_filter: Mutex::new((String::new(), Vec::new())),
        }
    }
}

impl FrontendBridge for MockBridge {
    fn append_terminal(&self, _text: &str) {}

    fn ask_input(&self, payload: &Value, callback_id: &str) -> bool {
        if let Some(ref cb) = self.on_input {
            cb(payload, callback_id)
        } else {
            false
        }
    }

    fn ask_matcher(&self, targets: &[String], sources: &[String], callback_id: &str) -> bool {
        if let Some(ref cb) = self.on_matcher {
            cb(targets, sources, callback_id)
        } else {
            false
        }
    }

    fn cancel_requests(&self) {}

    fn pick_folder(&self) -> String {
        self.picked_folder.lock().unwrap().clone()
    }

    fn pick_file(&self, label: &str, extensions: &[&str]) -> String {
        *self.last_file_filter.lock().unwrap() = (
            label.to_string(),
            extensions.iter().map(|s| s.to_string()).collect(),
        );
        self.picked_file.lock().unwrap().clone()
    }
}

#[test]
fn test_task_lifecycle_and_notifications() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let api = Api::new();
    let notifications: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(Vec::new()));
    let n_clone = notifications.clone();
    set_notify_hook(Some(Arc::new(move |title, msg| {
        n_clone
            .lock()
            .unwrap()
            .push((title.to_string(), msg.to_string()));
        Ok(())
    })));

    // 1. Success notifies once after task returns
    let n_check = notifications.clone();
    api.set_module_override(
        "stream_manager",
        Some(Arc::new(move || {
            assert!(n_check.lock().unwrap().is_empty());
            current_task().unwrap().add_output(2);
            Ok(())
        })),
    );
    let res = api.run_module("stream_manager", &json!({}), None, false);
    assert_eq!(res.status, "ok");
    thread::sleep(Duration::from_millis(50));
    assert_eq!(notifications.lock().unwrap().len(), 1);
    assert!(notifications.lock().unwrap()[0].0.contains("Task completed"));

    // 2. Failure notifies and allows another run
    notifications.lock().unwrap().clear();
    api.set_module_override(
        "stream_manager",
        Some(Arc::new(|| Err(TaskError::Message("broken mux".to_string())))),
    );
    let res = api.run_module("stream_manager", &json!({}), None, false);
    assert_eq!(res.status, "error");
    assert_eq!(res.message.as_deref(), Some("broken mux"));
    thread::sleep(Duration::from_millis(50));
    assert_eq!(notifications.lock().unwrap().len(), 1);
    assert!(notifications.lock().unwrap()[0].0.contains("Task failed"));

    // Subsequent run works
    api.set_module_override("stream_manager", Some(Arc::new(|| Ok(()))));
    let res2 = api.run_module("stream_manager", &json!({}), None, false);
    assert_eq!(res2.status, "cancelled");

    // 3. Warnings are not a clean success
    notifications.lock().unwrap().clear();
    api.set_module_override(
        "stream_manager",
        Some(Arc::new(|| {
            let p = current_task().unwrap();
            p.add_output(1);
            p.add_warning(1);
            Ok(())
        })),
    );
    let res = api.run_module("stream_manager", &json!({}), None, false);
    assert_eq!(res.status, "warning");
    thread::sleep(Duration::from_millis(50));
    assert_eq!(notifications.lock().unwrap().len(), 1);
    assert!(notifications.lock().unwrap()[0]
        .0
        .contains("completed with warnings"));

    // 4. Disabled notifications
    notifications.lock().unwrap().clear();
    api.set_module_override(
        "stream_manager",
        Some(Arc::new(|| {
            current_task().unwrap().add_output(1);
            Ok(())
        })),
    );
    let res = api.run_module(
        "stream_manager",
        &json!({ "notify_on_finish": false }),
        None,
        false,
    );
    assert_eq!(res.status, "ok");
    thread::sleep(Duration::from_millis(50));
    assert!(notifications.lock().unwrap().is_empty());

    // 5. Cancelled prompt does not report success or notify
    api.set_module_override(
        "stream_manager",
        Some(Arc::new(|| Err(TaskError::Cancelled))),
    );
    let res = api.run_module("stream_manager", &json!({}), None, false);
    assert_eq!(res.status, "cancelled");
    notify_task_finished("Stream Manager", "cancelled");
    thread::sleep(Duration::from_millis(50));
    assert!(notifications.lock().unwrap().is_empty());

    set_notify_hook(None);
}

#[test]
fn test_offset_validation_and_module_guards() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let api = Api::new();
    api.set_module_override("stream_manager", Some(Arc::new(|| Ok(()))));

    // Blank disabled offset is ignored
    let res = api.run_module(
        "stream_manager",
        &json!({ "max_offset": "", "enable_max_offset": false, "notify_on_finish": false }),
        None,
        false,
    );
    assert_eq!(res.status, "cancelled");

    // Invalid offset is reported without starting
    for invalid in [json!(""), json!("-1"), json!("1.5"), Value::Null] {
        let called = Arc::new(Mutex::new(false));
        let c = called.clone();
        api.set_module_override(
            "stream_manager",
            Some(Arc::new(move || {
                *c.lock().unwrap() = true;
                Ok(())
            })),
        );
        let res = api.run_module(
            "stream_manager",
            &json!({ "max_offset": invalid, "enable_max_offset": true, "notify_on_finish": false }),
            None,
            false,
        );
        assert_eq!(res.status, "error");
        assert!(!*called.lock().unwrap());
    }

    // Unknown module and repeat without history
    let api_fresh = Api::new();
    assert_eq!(
        api_fresh
            .run_module("missing", &json!({}), None, false)
            .status,
        "error"
    );
    assert_eq!(
        api_fresh
            .run_module("stream_manager", &json!({}), None, true)
            .status,
        "error"
    );

    // Concurrent run is rejected
    *api_fresh.inner.run_lock.lock().unwrap() = true;
    assert_eq!(
        api_fresh
            .run_module("stream_manager", &json!({}), None, false)
            .status,
        "busy"
    );
    *api_fresh.inner.run_lock.lock().unwrap() = false;
}

#[test]
fn test_repeat_paths_and_single_file_default_output() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let api = Api::new();
    let dir = tempdir().unwrap();
    let folder = dir.path().to_string_lossy().to_string();

    let received: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let r_clone = received.clone();
    api.set_module_override(
        "stream_manager",
        Some(Arc::new(move || {
            let p = ask_directory("Select Video Folder")?;
            r_clone.lock().unwrap().push(p);
            Ok(())
        })),
    );

    api.run_module(
        "stream_manager",
        &json!({ "notify_on_finish": false }),
        Some(PathsInput {
            video: folder.clone(),
            sub: String::new(),
            output: String::new(),
        }),
        false,
    );
    api.run_module(
        "custom_merge",
        &json!({ "notify_on_finish": false }),
        None,
        true,
    );
    assert_eq!(*received.lock().unwrap(), vec![folder.clone(), folder.clone()]);

    // Single file repeat defaults output to parent folder
    let target = dir.path().join("target.mkv");
    let source = dir.path().join("source.mkv");
    fs::write(&target, b"v").unwrap();
    fs::write(&source, b"s").unwrap();

    let triples: Arc<Mutex<Vec<(String, String, String)>>> = Arc::new(Mutex::new(Vec::new()));
    let t_clone = triples.clone();
    api.set_module_override(
        "custom_merge",
        Some(Arc::new(move || {
            let a = ask_directory("Select TARGET")?;
            let b = ask_directory("Select SOURCE")?;
            let o = ask_directory("Select OUTPUT Folder")?;
            t_clone.lock().unwrap().push((a, b, o));
            Ok(())
        })),
    );

    api.run_module(
        "custom_merge",
        &json!({ "notify_on_finish": false }),
        Some(PathsInput {
            video: target.to_string_lossy().to_string(),
            sub: source.to_string_lossy().to_string(),
            output: String::new(),
        }),
        false,
    );
    api.run_module(
        "stream_manager",
        &json!({ "notify_on_finish": false }),
        None,
        true,
    );
    assert_eq!(triples.lock().unwrap().len(), 2);
    assert_eq!(triples.lock().unwrap()[0].2, folder);

    fs::remove_file(&source).unwrap();
    let res = api.run_module(
        "custom_merge",
        &json!({ "notify_on_finish": false }),
        None,
        true,
    );
    assert_eq!(res.status, "error");
    assert!(res
        .message
        .unwrap_or_default()
        .contains("File or folder does not exist"));
}

#[test]
fn test_file_picker_and_matcher_ordering() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let api = Api::new();

    // Unknown matcher response is not retained
    api.resolve_matcher("expired", vec![], None);
    assert!(!api.inner.matcher_results.lock().unwrap().contains_key("expired"));

    // File picker filters video and subtitle files
    let bridge = Arc::new(MockBridge {
        picked_file: Mutex::new("chosen.mkv".to_string()),
        ..Default::default()
    });
    api.set_bridge(Some(bridge.clone()));
    assert_eq!(api.pick_file("video"), "chosen.mkv");
    assert!(bridge.last_file_filter.lock().unwrap().1.contains(&".mkv".to_string()));

    api.pick_file("subtitles");
    assert!(bridge.last_file_filter.lock().unwrap().1.contains(&".srt".to_string()));
    assert!(!bridge.last_file_filter.lock().unwrap().1.contains(&".mkv".to_string()));

    *bridge.picked_file.lock().unwrap() = String::new();
    assert_eq!(api.pick_file("video"), "");

    // show_in_folder validates empty and non-existent paths
    assert!(api.show_in_folder("").is_err());
    assert!(api.show_in_folder("/nonexistent_syncforge_path_xyz/file.mkv").is_err());

    // Matcher retains full order including unpaired sources and repeat restores order
    let displayed: Arc<Mutex<Vec<Vec<String>>>> = Arc::new(Mutex::new(Vec::new()));
    let disp_clone = displayed.clone();
    let api_for_bridge = api.clone();
    let matcher_bridge = Arc::new(MockBridge {
        on_matcher: Some(Box::new(move |targets, sources, callback_id| {
            let mut d = disp_clone.lock().unwrap();
            d.push(sources.to_vec());
            let order = if d.len() == 1 {
                vec!["b".to_string(), "a".to_string(), "c".to_string()]
            } else {
                sources.to_vec()
            };
            let pairs = targets
                .iter()
                .cloned()
                .zip(order.iter().cloned())
                .collect();
            api_for_bridge.resolve_matcher(callback_id, pairs, Some(order));
            true
        })),
        ..Default::default()
    });
    api.set_bridge(Some(matcher_bridge));

    api.set_module_override(
        "stream_manager",
        Some(Arc::new(|| {
            let _ = match_files(
                vec!["target".to_string()],
                vec!["a".to_string(), "b".to_string(), "c".to_string()],
            )?;
            Ok(())
        })),
    );

    api.run_module(
        "stream_manager",
        &json!({ "notify_on_finish": false }),
        None,
        false,
    );
    api.run_module(
        "stream_manager",
        &json!({ "notify_on_finish": false }),
        None,
        true,
    );
    api.run_module(
        "stream_manager",
        &json!({ "notify_on_finish": false }),
        None,
        false,
    );

    assert_eq!(
        *displayed.lock().unwrap(),
        vec![
            vec!["a".to_string(), "b".to_string(), "c".to_string()],
            vec!["b".to_string(), "a".to_string(), "c".to_string()],
            vec!["a".to_string(), "b".to_string(), "c".to_string()],
        ]
    );
}

#[test]
fn test_prompts_and_stop_release() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let api = Api::new();

    // Cancelled input without bridge raises Cancelled instead of looping
    assert_eq!(
        api.request_input("Select a track", AskOptions::default()),
        Err(TaskError::Cancelled)
    );

    // Custom prompt waits for bridge response and cleans up
    let api_clone = api.clone();
    let bridge = Arc::new(MockBridge {
        on_input: Some(Box::new(move |payload, callback_id| {
            assert_eq!(payload["prompt"], "Choose tracks");
            api_clone.resolve_input(callback_id, Some("1,8".to_string()));
            true
        })),
        ..Default::default()
    });
    api.set_bridge(Some(bridge));
    let res = api
        .request_input(
            "Choose tracks",
            AskOptions {
                tracks: vec![Track {
                    id: 8,
                    ..Default::default()
                }],
                kind: "multiple".to_string(),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(res, "1,8");
    assert!(api.inner.input_events.lock().unwrap().is_empty());
    assert!(api.inner.input_results.lock().unwrap().is_empty());

    // Stop releases an open input dialog
    let shown = Arc::new(Mutex::new(false));
    let shown_clone = shown.clone();
    let blocking_bridge = Arc::new(MockBridge {
        on_input: Some(Box::new(move |_payload, _callback_id| {
            *shown_clone.lock().unwrap() = true;
            true
        })),
        ..Default::default()
    });
    api.set_bridge(Some(blocking_bridge));
    let api_for_task = api.clone();
    api.set_module_override(
        "stream_manager",
        Some(Arc::new(move || {
            let _ = api_for_task.request_input("Choose tracks", AskOptions::default())?;
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

    let deadline = Instant::now() + Duration::from_secs(2);
    while (!*shown.lock().unwrap() || api.inner.input_events.lock().unwrap().is_empty())
        && Instant::now() < deadline
    {
        thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(api.stop_task()["status"], "stopping");
    let outcome = worker.join().unwrap();
    assert_eq!(outcome.status, "cancelled");
    assert!(api.inner.input_events.lock().unwrap().is_empty());

    // Stop without running task is harmless
    assert_eq!(api.stop_task()["status"], "idle");
}

#[test]
fn test_file_selection_and_track_parsing() {
    let dir = tempdir().unwrap();
    let selected = dir.path().join("selected.MKV");
    fs::write(&selected, b"").unwrap();
    let nested = dir.path().join("nested");
    fs::create_dir(&nested).unwrap();
    let sibling = nested.join("other.mkv");
    fs::write(&sibling, b"").unwrap();
    fs::write(dir.path().join("ignore.txt"), b"").unwrap();

    let sel_str = selected.to_string_lossy().to_string();
    let sib_str = sibling.to_string_lossy().to_string();
    assert_eq!(
        get_files_recursive(&sel_str, &[".mkv"]).unwrap(),
        vec![sel_str.clone()]
    );
    let mut expected = vec![sel_str, sib_str];
    expected.sort();
    assert_eq!(
        get_files_recursive(&dir.path().to_string_lossy(), &[".mkv"]).unwrap(),
        expected
    );

    let wrong = dir.path().join("wrong.txt");
    fs::write(&wrong, b"").unwrap();
    assert!(get_files_recursive(&wrong.to_string_lossy(), &[".mkv"])
        .unwrap_err()
        .to_string()
        .contains("Unsupported file type"));
    assert!(
        get_files_recursive(&dir.path().join("missing.mkv").to_string_lossy(), &[".mkv"])
            .unwrap_err()
            .to_string()
            .contains("File or folder does not exist")
    );

    // Track selection validation
    let tracks = vec![
        Track {
            id: 1,
            ..Default::default()
        },
        Track {
            id: 2,
            ..Default::default()
        },
    ];
    for bad in ["99", "wrong", "1,wrong", "-1"] {
        assert!(parse_track_selection(bad, &tracks).is_err());
    }
    assert_eq!(parse_track_selection("", &tracks).unwrap(), vec![1, 2]);
    assert_eq!(parse_track_selection("n", &tracks).unwrap(), Vec::<i64>::new());
}

#[test]
fn test_metadata_cache_and_notifications_commands() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    clear_metadata_cache();
    let dir = tempdir().unwrap();
    let video = dir.path().join("video.mkv");
    fs::write(&video, b"first").unwrap();

    let calls = Arc::new(Mutex::new(0usize));
    let c_clone = calls.clone();
    set_capture_hook(Some(Arc::new(move |cmd, _cwd| {
        *c_clone.lock().unwrap() += 1;
        Ok(CompletedProcess {
            cmd: cmd.to_vec(),
            returncode: 0,
            stdout: r#"{"tracks":[{"id":1,"type":"video"}],"attachments":[{}]}"#.to_string(),
            stderr: String::new(),
        })
    })));

    let v_str = video.to_string_lossy().to_string();
    assert_eq!(get_tracks_info(&v_str).unwrap()[0].id, 1);
    assert!(has_attachments(&v_str).unwrap());
    assert_eq!(*calls.lock().unwrap(), 1);

    fs::write(&video, b"changed file size").unwrap();
    get_tracks_info(&v_str).unwrap();
    assert_eq!(*calls.lock().unwrap(), 2);

    // Identification failure raises error
    set_capture_hook(Some(Arc::new(|cmd, _cwd| {
        Ok(CompletedProcess {
            cmd: cmd.to_vec(),
            returncode: 2,
            stdout: String::new(),
            stderr: "broken container".to_string(),
        })
    })));
    clear_metadata_cache();
    assert!(get_tracks_info(&v_str)
        .unwrap_err()
        .to_string()
        .contains("Cannot read tracks"));
    set_capture_hook(None);

    // Notification command builders
    let mac_cmd = build_macos_notification_command("SyncForge", "Quotes \" and $() stay text");
    assert_eq!(mac_cmd[0], "/usr/bin/osascript");
    assert_eq!(
        &mac_cmd[mac_cmd.len() - 2..],
        &["SyncForge".to_string(), "Quotes \" and $() stay text".to_string()]
    );

    let linux_cmd = build_linux_notify_send_command("Done", "Stream Manager");
    assert_eq!(
        linux_cmd,
        vec!["notify-send", "--app-name=SyncForge", "Done", "Stream Manager"]
    );

    // Linux LD_LIBRARY_PATH restoration
    let mut env = HashMap::new();
    env.insert("LD_LIBRARY_PATH".to_string(), "/bundle".to_string());
    env.insert("LD_LIBRARY_PATH_ORIG".to_string(), "/system".to_string());
    external_tool_environment_from(&mut env, true);
    assert_eq!(env.get("LD_LIBRARY_PATH").unwrap(), "/system");
}

#[test]
fn test_subprocess_warnings_and_errors() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let progress = TaskProgress::new();
    with_task(progress.clone(), || {
        // Exit code 0 with real sh/cmd
        #[cfg(unix)]
        {
            let rc = run_subprocess(
                &["sh".to_string(), "-c".to_string(), "exit 0".to_string()],
                None,
            )
            .unwrap();
            assert_eq!(rc, 0);

            let err = run_subprocess(
                &["sh".to_string(), "-c".to_string(), "exit 2".to_string()],
                None,
            );
            assert!(err.is_err());
        }
    });
}

#[test]
fn test_audio_sync_waveform_delay_and_silence_detection() {
    let dir = tempdir().unwrap();
    let ref_path = dir.path().join("reference.wav");
    let src_path = dir.path().join("source.wav");

    let spec = WavSpec {
        channels: 1,
        sample_rate: 8000,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    // Deterministic pseudo-random PRNG (xorshift32) for 8000 samples
    let mut state: u32 = 42;
    let mut audio = Vec::with_capacity(8000);
    for _ in 0..8000 {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        let sample = ((state as i32 % 32000) - 16000) as i16;
        audio.push(sample);
    }

    // Shift source by +800 samples (+100ms at 8000Hz) -> expected lag is -800 (-100ms)
    let mut shifted = vec![0i16; 800];
    shifted.extend_from_slice(&audio[..7200]);

    {
        let mut w_ref = WavWriter::create(&ref_path, spec).unwrap();
        for &s in &audio {
            w_ref.write_sample(s).unwrap();
        }
        w_ref.finalize().unwrap();

        let mut w_src = WavWriter::create(&src_path, spec).unwrap();
        for &s in &shifted {
            w_src.write_sample(s).unwrap();
        }
        w_src.finalize().unwrap();
    }

    let delay = find_audio_delay(
        &ref_path.to_string_lossy(),
        &src_path.to_string_lossy(),
    )
    .unwrap();
    assert_eq!(delay, -100);

    // Silent audio must be rejected
    let silent_path = dir.path().join("silent.wav");
    {
        let mut w_sil = WavWriter::create(&silent_path, spec).unwrap();
        for _ in 0..100 {
            w_sil.write_sample(0i16).unwrap();
        }
        w_sil.finalize().unwrap();
    }
    let err = find_audio_delay(
        &silent_path.to_string_lossy(),
        &silent_path.to_string_lossy(),
    )
    .unwrap_err();
    assert!(err.to_string().contains("No usable audio"));
}
