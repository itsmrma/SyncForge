use std::collections::VecDeque;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};
use tempfile::tempdir;

use syncforge_lib::core::mkv_tools::{clear_metadata_cache, set_capture_hook};
use syncforge_lib::core::processes::CompletedProcess;
use syncforge_lib::core::tasks::current_task;
use syncforge_lib::core::utils::set_subprocess_hook;
use syncforge_lib::ui::backend::{Api, FrontendBridge, PathsInput};

struct MockMediaBridge {
    on_input: Box<dyn Fn(&Value, &str) -> bool + Send + Sync>,
    on_matcher: Box<dyn Fn(&[String], &[String], &str) -> bool + Send + Sync>,
}

impl FrontendBridge for MockMediaBridge {
    fn append_terminal(&self, _text: &str) {}

    fn ask_input(&self, payload: &Value, callback_id: &str) -> bool {
        (self.on_input)(payload, callback_id)
    }

    fn ask_matcher(&self, targets: &[String], sources: &[String], callback_id: &str) -> bool {
        (self.on_matcher)(targets, sources, callback_id)
    }

    fn cancel_requests(&self) {}

    fn pick_folder(&self) -> String {
        String::new()
    }

    fn pick_file(&self, _label: &str, _extensions: &[&str]) -> String {
        String::new()
    }
}

#[test]
fn test_all_six_processing_modes_end_to_end() {
    clear_metadata_cache();
    let root = tempdir().unwrap();
    let target_dir = root.path().join("target");
    let source_dir = root.path().join("source");
    let output_dir = root.path().join("output");
    fs::create_dir_all(&target_dir).unwrap();
    fs::create_dir_all(&source_dir).unwrap();
    fs::create_dir_all(&output_dir).unwrap();

    let target_video = target_dir.join("video.mkv");
    let source_video = source_dir.join("video.mkv");
    let source_sub = source_dir.join("subs.srt");
    fs::write(&target_video, b"target_mkv").unwrap();
    fs::write(&source_video, b"source_mkv").unwrap();
    fs::write(&source_sub, b"1\n00:00:00,100 --> 00:00:01,200\nSub\n").unwrap();

    // Mock mkvmerge -J track metadata
    set_capture_hook(Some(Arc::new(|cmd, _cwd| {
        Ok(CompletedProcess {
            cmd: cmd.to_vec(),
            returncode: 0,
            stdout: r#"{
                "tracks": [
                    {"id": 0, "type": "video", "codec": "AVC"},
                    {"id": 1, "type": "audio", "codec": "AAC", "properties": {"language": "ita", "default_track": true}},
                    {"id": 2, "type": "subtitles", "codec": "SubRip/SRT", "properties": {"language": "ita", "codec_id": "S_TEXT/UTF8", "forced_track": false}},
                    {"id": 3, "type": "audio", "codec": "AAC", "properties": {"language": "jpn", "default_track": false}}
                ],
                "attachments": [{"id": 1}]
            }"#
            .to_string(),
            stderr: String::new(),
        })
    })));

    // Mock external tool executions (mkvmerge, mkvextract, mkvpropedit, ffmpeg, ffsubsync)
    let recorded_cmds: Arc<Mutex<Vec<Vec<String>>>> = Arc::new(Mutex::new(Vec::new()));
    let rec_clone = recorded_cmds.clone();
    set_subprocess_hook(Some(Arc::new(move |cmd: &[String], _cwd: Option<&Path>| {
        rec_clone.lock().unwrap().push(cmd.to_vec());
        let tool = Path::new(&cmd[0])
            .file_stem()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        if tool == "mkvmerge" {
            if let Some(pos) = cmd.iter().position(|a| a == "-o") {
                let out_path = Path::new(&cmd[pos + 1]);
                let _ = fs::write(out_path, b"muxed_data");
                if out_path
                    .extension()
                    .map(|e| e.to_string_lossy().eq_ignore_ascii_case("mkv"))
                    .unwrap_or(false)
                {
                    if let Some(p) = current_task() {
                        p.add_output(1);
                    }
                }
            }
        } else if tool == "mkvextract" {
            if let Some(spec) = cmd.get(3) {
                if let Some((_, dest)) = spec.split_once(':') {
                    let _ = fs::write(dest, b"extracted_sub");
                }
            }
        } else if tool == "mkvpropedit" {
            if let Some(p) = current_task() {
                p.add_output(1);
            }
        } else if tool == "ffmpeg" {
            if let Some(last) = cmd.last() {
                let _ = fs::write(last, b"converted_media");
            }
        } else if tool == "ffsubsync" {
            if let Some(pos) = cmd.iter().position(|a| a == "-o") {
                let _ = fs::write(&cmd[pos + 1], b"synced_sub");
            }
        }
        Ok(0)
    })));

    let run_mode = |mode: &str, answers: Vec<&str>, paths: PathsInput, settings: serde_json::Value| {
        let api = Api::new();
        let queue: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(
            answers.into_iter().map(|s| s.to_string()).collect(),
        ));
        let q_clone = queue.clone();
        let api_input = api.clone();
        let api_matcher = api.clone();

        let bridge = Arc::new(MockMediaBridge {
            on_input: Box::new(move |_payload, callback_id| {
                let ans = q_clone.lock().unwrap().pop_front();
                api_input.resolve_input(callback_id, ans);
                true
            }),
            on_matcher: Box::new(move |targets, sources, callback_id| {
                let pairs: Vec<(String, String)> = targets
                    .iter()
                    .cloned()
                    .zip(sources.iter().cloned())
                    .collect();
                api_matcher.resolve_matcher(callback_id, pairs, Some(sources.to_vec()));
                true
            }),
        });
        api.set_bridge(Some(bridge));
        api.run_module(mode, &settings, Some(paths), false)
    };

    let default_paths = || PathsInput {
        video: target_dir.to_string_lossy().to_string(),
        sub: source_dir.to_string_lossy().to_string(),
        output: output_dir.to_string_lossy().to_string(),
    };
    let base_settings = json!({
        "auto_audio": false,
        "auto_subs": true,
        "enable_max_offset": true,
        "max_offset": 2,
        "notify_on_finish": false
    });

    // 1. Stream Manager (Lossless & Opus conversion)
    let res = run_mode("stream_manager", vec!["", "n"], default_paths(), base_settings.clone());
    assert_eq!(res.status, "ok");
    assert!(output_dir.join("video_mod.mkv").exists());

    let res = run_mode("stream_manager", vec!["", "y"], default_paths(), base_settings.clone());
    assert_eq!(res.status, "ok");

    // 2. Set Default & Forced (valid & invalid track ID)
    let res = run_mode("set_default", vec!["1", "2", "2"], default_paths(), base_settings.clone());
    assert_eq!(res.status, "ok");

    let res_bad = run_mode("set_default", vec!["99", "", ""], default_paths(), base_settings.clone());
    assert_eq!(res_bad.status, "error");

    // 3. Sync External Subtitles (verifies direct ffsubsync executable invocation!)
    recorded_cmds.lock().unwrap().clear();
    let res = run_mode("sync_subs", vec![], default_paths(), base_settings.clone());
    assert_eq!(res.status, "ok");
    assert!(output_dir.join("video_subbed.mkv").exists());
    assert!(recorded_cmds
        .lock()
        .unwrap()
        .iter()
        .any(|c| c[0] == "ffsubsync" && c.contains(&"--max-offset-seconds".to_string())));

    // 4. Sync Subs from MKV
    let res = run_mode("sync_subs_mkv", vec![], default_paths(), base_settings.clone());
    assert_eq!(res.status, "ok");

    // 5. WaveSync Injection
    let res = run_mode(
        "injection",
        vec!["n", "n", "y", "y", "y"],
        default_paths(),
        base_settings.clone(),
    );
    assert_eq!(res.status, "ok");
    assert!(output_dir.join("video_final.mkv").exists());

    // 6. Custom Track Merge
    let res = run_mode(
        "custom_merge",
        vec!["n", "n", "", ""],
        default_paths(),
        base_settings.clone(),
    );
    assert_eq!(res.status, "ok");
    assert!(output_dir.join("video_merged.mkv").exists());

    // 7. Internal Track Sync (Self-Sync Audio & Subtitles)
    let res = run_mode(
        "internal_sync",
        vec!["y", "y", "3", "1", "2"],
        default_paths(),
        base_settings,
    );
    assert_eq!(res.status, "ok");
    assert!(output_dir.join("video_synced.mkv").exists());

    set_subprocess_hook(None);
    set_capture_hook(None);
}
