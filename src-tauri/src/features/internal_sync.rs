use std::fs;
use std::path::Path;

use tempfile::Builder;

use crate::core::audio_sync::{
    convert_audio_file_to_opus, extract_audio_segment, find_audio_delay,
};
use crate::core::config::{get_config, MAX_AUDIO_DELAY_MS, VIDEO_EXT};
use crate::core::mkv_tools::{
    format_track_label, get_tracks_info, windows_long_path, Track,
};
use crate::core::tasks::{check_cancelled, TaskError};
use crate::core::utils::{
    ask_directory, ask_user, get_files_recursive, get_track_signature, log_line, normalize_path,
    build_output_path, compute_relative_subfolder, run_subprocess, set_file_progress, AskOptions,
};

struct InternalSyncGroup {
    tracks: Vec<Track>,
    files: Vec<String>,
}

fn select_track_prompt(
    tracks: &[Track],
    prompt: &str,
    group_desc: &str,
) -> Result<Option<Track>, TaskError> {
    if tracks.is_empty() {
        return Ok(None);
    }
    if tracks.len() == 1 {
        return Ok(Some(tracks[0].clone()));
    }

    log_line(&format!("\n⚠️  TRACK SELECTION: {}", group_desc));
    log_line(prompt);
    for t in tracks {
        log_line(&format!("   {}", format_track_label(t)));
    }

    loop {
        let sel = ask_user(
            prompt,
            AskOptions {
                tracks: tracks.to_vec(),
                kind: "single".to_string(),
                allow_empty: false,
                allow_skip: false,
                context: Some(group_desc.to_string()),
                files: Vec::new(),
            },
        )?;
        let trimmed = sel.trim();
        if trimmed.is_empty() {
            return Ok(Some(tracks[0].clone()));
        }
        if let Ok(id) = trimmed.parse::<i64>() {
            if let Some(found) = tracks.iter().find(|t| t.id == id) {
                return Ok(Some(found.clone()));
            }
        }
    }
}

pub fn run_internal_sync() -> Result<(), TaskError> {
    log_line("\n--- INTERNAL TRACK SYNCHRONIZATION ---");
    let vid_folder = ask_directory("Select Video Folder or File to process")?;
    if vid_folder.is_empty() {
        return Ok(());
    }

    let out_folder = ask_directory("Select OUTPUT Folder")?;
    if out_folder.is_empty() {
        return Ok(());
    }

    let videos = get_files_recursive(&vid_folder, VIDEO_EXT)?;
    if videos.is_empty() {
        log_line("No video files found.");
        return Ok(());
    }

    let confirm_opts = AskOptions {
        tracks: Vec::new(),
        kind: "confirm".to_string(),
        allow_empty: false,
        allow_skip: false,
        context: None,
        files: Vec::new(),
    };

    log_line("\n[SYNC CONFIGURATION] What tracks would you like to synchronize inside the video?");
    let do_audio =
        ask_user("Synchronize an audio track?", confirm_opts.clone())?.to_lowercase() == "y";
    let do_subs =
        ask_user("Synchronize a subtitle track?", confirm_opts.clone())?.to_lowercase() == "y";

    if !do_audio && !do_subs {
        log_line("No tracks selected for synchronization. Returning to main menu.");
        return Ok(());
    }

    let cfg = get_config();

    let mut do_audio_sync = false;
    let mut do_opus_audio = false;
    if do_audio {
        do_audio_sync = cfg.auto_sync_audio;
        log_line(&format!(
            "      Apply auto-sync to audio (WaveSync)? {} [from global settings]",
            if do_audio_sync { "y" } else { "n" }
        ));
        if cfg.opus_mode == "always" {
            log_line("      Apply Opus conversion to synced audio? y [from global settings]");
            do_opus_audio = true;
        } else if cfg.opus_mode == "prompt" {
            let prompt_text = format!(
                "Convert synced audio to Opus ({}k, {})?",
                cfg.opus_bitrate,
                if cfg.opus_downmix {
                    "stereo downmix"
                } else {
                    "preserve channels"
                }
            );
            do_opus_audio = ask_user(&prompt_text, confirm_opts.clone())?.to_lowercase() == "y";
        }
    }

    let mut do_sub_sync = false;
    if do_subs {
        do_sub_sync = cfg.auto_sync_subs;
        log_line(&format!(
            "      Apply auto-sync to subtitles (ffsubsync)? {} [from global settings]",
            if do_sub_sync { "y" } else { "n" }
        ));
    }

    log_line("\n🔍 Analyzing file structures and dividing into groups...");
    let mut groups: Vec<(String, InternalSyncGroup)> = Vec::new();
    let total_vids = videos.len();
    for (idx, vid) in videos.iter().enumerate() {
        check_cancelled()?;
        let bname = Path::new(vid)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        log_line(&format!("   [{}/{}] Probing: {}", idx + 1, total_vids, bname));
        let tracks = get_tracks_info(vid)?;
        let sig = get_track_signature(&tracks);
        if let Some((_, group)) = groups.iter_mut().find(|(s, _)| s == &sig) {
            group.files.push(vid.clone());
        } else {
            groups.push((
                sig,
                InternalSyncGroup {
                    tracks,
                    files: vec![vid.clone()],
                },
            ));
        }
    }

    let total_groups = groups.len();
    let total_files = videos.len();
    let mut processed_idx = 0;

    log_line(&format!(
        "✅ Found {} file(s), grouped into {} distinct track structure(s).",
        total_files, total_groups
    ));

    for (idx, (_, group)) in groups.into_iter().enumerate() {
        let i = idx + 1;
        let files = group.files;
        let tracks = group.tracks;

        log_line(&format!("\n{}", "=".repeat(60)));
        log_line(&format!(
            "📦 BATCH {}/{} - Contains {} file(s):",
            i,
            total_groups,
            files.len()
        ));
        for f in files.iter().take(3) {
            let bname = Path::new(f)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            log_line(&format!("  - {}", bname));
        }
        if files.len() > 3 {
            log_line(&format!("  ... and {} more file(s).", files.len() - 3));
        }

        let audio_tracks: Vec<Track> = tracks
            .iter()
            .filter(|t| t.track_type == "audio")
            .cloned()
            .collect();
        let sub_tracks: Vec<Track> = tracks
            .iter()
            .filter(|t| t.track_type == "subtitles")
            .cloned()
            .collect();

        // 1. Select audio tracks if audio sync is requested
        let mut ref_audio_track: Option<Track> = None;
        let mut target_audio_track: Option<Track> = None;

        if do_audio {
            if audio_tracks.len() < 2 {
                log_line("   ⚠️ Batch has fewer than 2 audio tracks; cannot synchronize audio against reference audio.");
            } else {
                ref_audio_track = select_track_prompt(
                    &audio_tracks,
                    "Select REFERENCE Audio Track (in sync with video)",
                    &format!("Batch {}/{}", i, total_groups),
                )?;
                if let Some(ref ref_a) = ref_audio_track {
                    let candidates: Vec<Track> = audio_tracks
                        .iter()
                        .filter(|t| t.id != ref_a.id)
                        .cloned()
                        .collect();
                    target_audio_track = select_track_prompt(
                        &candidates,
                        "Select TARGET Audio Track to synchronize",
                        &format!("Batch {}/{}", i, total_groups),
                    )?;
                }
            }
        }

        // 2. Select subtitle track if subtitle sync is requested
        let mut target_sub_track: Option<Track> = None;
        if do_subs {
            if sub_tracks.is_empty() {
                log_line("   ⚠️ Batch has no subtitle tracks; skipping subtitle synchronization.");
            } else {
                if ref_audio_track.is_none() && !audio_tracks.is_empty() {
                    ref_audio_track = select_track_prompt(
                        &audio_tracks,
                        "Select REFERENCE Audio Track for speech alignment",
                        &format!("Batch {}/{}", i, total_groups),
                    )?;
                }
                target_sub_track = select_track_prompt(
                    &sub_tracks,
                    "Select TARGET Subtitle Track to synchronize",
                    &format!("Batch {}/{}", i, total_groups),
                )?;
            }
        }

        if target_audio_track.is_none() && target_sub_track.is_none() {
            log_line("⏭️ No tracks to synchronize for this batch, skipping.");
            continue;
        }

        for vid in files {
            let vid_buf = normalize_path(Path::new(&vid));
            let filename = vid_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            processed_idx += 1;
            set_file_progress(&filename, processed_idx, total_files);
            let _base_name = vid_buf
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            log_line(&format!("\n>> Processing: {}", filename));

            let clean_vid = vid_buf.to_string_lossy().to_string();
            let out_file = build_output_path(&out_folder, &vid_folder, &clean_vid, "_synced.mkv")?;
            let out_dir = out_file.parent().unwrap_or_else(|| Path::new(&out_folder));

            let temp_dir = Builder::new()
                .prefix("syncforge_")
                .tempdir_in(out_dir)
                .map_err(|e| TaskError::Message(e.to_string()))?;

            let mut temp_files: Vec<String> = Vec::new();
            let vid_read_path = windows_long_path(&clean_vid);

            let mut audio_delay_ms: i64 = 0;
            let mut sub_delay_ms: i64 = 0;
            let sample_start = "00:05:00".to_string();
            let sample_duration = "00:02:00".to_string();

            let mut ref_audio_mka_path: Option<String> = None;
            let mut target_audio_mka_path: Option<String> = None;
            let mut final_opus_audio: Option<String> = None;
            let mut final_sub_path: Option<String> = None;

            // Extract reference audio if needed (for audio sync or subtitle sync)
            if let Some(ref ref_a) = ref_audio_track {
                if target_audio_track.is_some() || target_sub_track.is_some() {
                    let ref_mka = temp_dir
                        .path()
                        .join("temp_ref_audio.mka")
                        .to_string_lossy()
                        .to_string();
                    let rc = run_subprocess(
                        &[
                            "mkvmerge".to_string(),
                            "-o".to_string(),
                            ref_mka.clone(),
                            "--no-video".to_string(),
                            "--no-subtitles".to_string(),
                            "--no-attachments".to_string(),
                            "--no-chapters".to_string(),
                            "--audio-tracks".to_string(),
                            ref_a.id.to_string(),
                            vid_read_path.clone(),
                        ],
                        Some(out_dir),
                    )?;
                    if rc == 0 && Path::new(&ref_mka).exists() {
                        temp_files.push(ref_mka.clone());
                        ref_audio_mka_path = Some(ref_mka);
                    }
                }
            }

            // A) AUDIO SYNC
            if let Some(ref tgt_a) = target_audio_track {
                log_line(&format!("   🎤 Extracting Target Audio ID {}...", tgt_a.id));
                let tgt_mka = temp_dir
                    .path()
                    .join("temp_target_audio.mka")
                    .to_string_lossy()
                    .to_string();
                let rc = run_subprocess(
                    &[
                        "mkvmerge".to_string(),
                        "-o".to_string(),
                        tgt_mka.clone(),
                        "--no-video".to_string(),
                        "--no-subtitles".to_string(),
                        "--no-attachments".to_string(),
                        "--no-chapters".to_string(),
                        "--audio-tracks".to_string(),
                        tgt_a.id.to_string(),
                        vid_read_path.clone(),
                    ],
                    Some(out_dir),
                )?;
                if rc == 0 && Path::new(&tgt_mka).exists() {
                    temp_files.push(tgt_mka.clone());
                    target_audio_mka_path = Some(tgt_mka.clone());

                    if do_audio_sync && ref_audio_mka_path.is_some() {
                        log_line(&format!(
                            "   🧪 Searching for audio sync (Max +/- {}ms)...",
                            MAX_AUDIO_DELAY_MS
                        ));
                        let wav_ref = temp_dir
                            .path()
                            .join("temp_ref.wav")
                            .to_string_lossy()
                            .to_string();
                        let wav_tgt = temp_dir
                            .path()
                            .join("temp_tgt.wav")
                            .to_string_lossy()
                            .to_string();

                        let r1 = extract_audio_segment(
                            ref_audio_mka_path.as_ref().unwrap(),
                            &wav_ref,
                            &sample_start,
                            &sample_duration,
                        );
                        let r2 = extract_audio_segment(
                            &tgt_mka,
                            &wav_tgt,
                            &sample_start,
                            &sample_duration,
                        );

                        if r1.is_ok()
                            && r2.is_ok()
                            && Path::new(&wav_ref).exists()
                            && Path::new(&wav_tgt).exists()
                        {
                            match find_audio_delay(&wav_ref, &wav_tgt) {
                                Ok(delay) => {
                                    audio_delay_ms = delay;
                                    log_line(&format!(
                                        "   ⏱️  Calculated Audio Delay: {} ms",
                                        audio_delay_ms
                                    ));
                                }
                                Err(e) => {
                                    log_line(&format!(
                                        "   ⚠️ Waveform delay calculation failed ({}), using 0 ms.",
                                        e
                                    ));
                                }
                            }
                            temp_files.push(wav_ref);
                            temp_files.push(wav_tgt);
                        } else {
                            log_line("   ⚠️ Could not extract audio segment for analysis, skipping auto-delay.");
                        }
                    } else if !do_audio_sync {
                        log_line("   ℹ️ Audio auto-sync skipped (manual or disabled in settings).");
                    }

                    if do_opus_audio {
                        match convert_audio_file_to_opus(&tgt_mka, temp_dir.path(), out_dir) {
                            Ok(opus_path) => {
                                temp_files.push(opus_path.clone());
                                final_opus_audio = Some(opus_path);
                            }
                            Err(e) => {
                                log_line(&format!(
                                    "   ⚠️ Opus conversion failed, falling back to original audio: {}",
                                    e
                                ));
                            }
                        }
                    }
                }
            }

            // B) SUBTITLE SYNC
            if let Some(ref tgt_s) = target_sub_track {
                log_line(&format!(
                    "   [mkvextract] 📝 Extracting Subtitle ID {}...",
                    tgt_s.id
                ));
                let codec_id = tgt_s
                    .properties
                    .as_ref()
                    .and_then(|p| p.codec_id.as_deref())
                    .unwrap_or("")
                    .to_uppercase();
                let codec_name = tgt_s.codec.as_deref().unwrap_or("").to_uppercase();

                let (sub_ext, can_sync) = if codec_id.contains("ASS")
                    || codec_id.contains("SSA")
                    || codec_name.contains("ASS")
                {
                    (".ass", true)
                } else if codec_id.contains("PGS") || codec_name.contains("PG") {
                    (".sup", false)
                } else if codec_id.contains("VOBSUB") {
                    (".sub", false)
                } else {
                    (".srt", true)
                };

                let raw_sub_path = temp_dir
                    .path()
                    .join(format!("temp_raw{}", sub_ext))
                    .to_string_lossy()
                    .to_string();
                let synced_sub_path = temp_dir
                    .path()
                    .join(format!("temp_synced{}", sub_ext))
                    .to_string_lossy()
                    .to_string();

                run_subprocess(
                    &[
                        "mkvextract".to_string(),
                        vid_read_path.clone(),
                        "tracks".to_string(),
                        format!("{}:{}", tgt_s.id, raw_sub_path),
                    ],
                    Some(out_dir),
                )?;
                temp_files.push(raw_sub_path.clone());

                let mut chosen_sub = if sub_ext == ".sub" {
                    Path::new(&raw_sub_path)
                        .with_extension("idx")
                        .to_string_lossy()
                        .to_string()
                } else {
                    raw_sub_path.clone()
                };

                if Path::new(&raw_sub_path).exists() {
                    if can_sync && do_sub_sync {
                        let ref_input = if let Some(ref r_mka) = ref_audio_mka_path {
                            r_mka.clone()
                        } else {
                            clean_vid.clone()
                        };

                        log_line("      [ffsubsync] [Sync] Starting ffsubsync...");
                        let mut cmd_ffsubsync = vec![
                            "ffsubsync".to_string(),
                            ref_input,
                            "-i".to_string(),
                            raw_sub_path.clone(),
                            "-o".to_string(),
                            synced_sub_path.clone(),
                        ];
                        if cfg.enable_max_offset && cfg.max_offset_seconds > 0 {
                            cmd_ffsubsync.push("--max-offset-seconds".to_string());
                            cmd_ffsubsync.push(cfg.max_offset_seconds.to_string());
                        }
                        run_subprocess(&cmd_ffsubsync, Some(out_dir))?;

                        if let Ok(meta) = fs::metadata(&synced_sub_path) {
                            if meta.len() > 0 {
                                chosen_sub = synced_sub_path.clone();
                                temp_files.push(synced_sub_path);
                                log_line("      ✅ Subtitle sync successful.");
                            } else {
                                log_line("      ⚠️ Subtitle sync produced empty file, using original.");
                            }
                        } else {
                            log_line("      ⚠️ Subtitle sync failed, using original.");
                        }
                    } else if can_sync && !do_sub_sync {
                        log_line("      [Sync] Subtitle auto-sync skipped (disabled in settings). Using original.");
                    }
                    final_sub_path = Some(chosen_sub);
                }
            }

            // C) PREVIEW WITH MPV
            if cfg.preview_mpv
                && (final_opus_audio.is_some()
                    || target_audio_mka_path.is_some()
                    || final_sub_path.is_some())
            {
                let audio_preview_target =
                    final_opus_audio.as_ref().or(target_audio_mka_path.as_ref());
                loop {
                    let preview_ctx = serde_json::json!({
                        "filename": filename,
                        "target": clean_vid,
                        "audio_file": audio_preview_target,
                        "audio_delay_ms": audio_delay_ms,
                        "sub_file": final_sub_path,
                        "sub_delay_ms": sub_delay_ms,
                        "start_time": sample_start,
                        "duration": sample_duration,
                        "has_audio": audio_preview_target.is_some(),
                        "has_sub": final_sub_path.is_some(),
                    });
                    let resp = ask_user(
                        &format!("Verify sync for {}", filename),
                        AskOptions {
                            tracks: Vec::new(),
                            kind: "sync_preview".to_string(),
                            allow_empty: false,
                            allow_skip: false,
                            context: Some(preview_ctx.to_string()),
                            files: vec![clean_vid.clone()],
                        },
                    )?;

                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&resp) {
                        let action = parsed
                            .get("action")
                            .and_then(|v| v.as_str())
                            .unwrap_or("confirm");
                        if action == "stop" {
                            log_line("   ⏹️ Task stopped by user from preview.");
                            return Err(TaskError::Cancelled);
                        }
                        if let Some(a_d) = parsed.get("audio_delay_ms").and_then(|v| v.as_i64()) {
                            audio_delay_ms = a_d;
                        }
                        if let Some(s_d) = parsed.get("sub_delay_ms").and_then(|v| v.as_i64()) {
                            sub_delay_ms = s_d;
                        }
                        break;
                    } else {
                        break;
                    }
                }
            }

            // D) FINAL REMUX
            log_line("   📦 Remuxing synchronized tracks losslessly...");
            let mut cmd = vec![
                "mkvmerge".to_string(),
                "-o".to_string(),
                out_file.to_string_lossy().to_string(),
            ];

            // Subtitle filtering for clean_vid
            if let Some(ref tgt_s) = target_sub_track {
                let other_subs: Vec<String> = sub_tracks
                    .iter()
                    .filter(|t| t.id != tgt_s.id)
                    .map(|t| t.id.to_string())
                    .collect();
                if other_subs.is_empty() {
                    cmd.push("--no-subtitles".to_string());
                } else {
                    cmd.push("--subtitle-tracks".to_string());
                    cmd.push(other_subs.join(","));
                }
            }

            // Audio filtering / sync for clean_vid
            if let Some(ref tgt_a) = target_audio_track {
                if final_opus_audio.is_some() {
                    // Replaced with opus file -> exclude from clean_vid
                    let other_audios: Vec<String> = audio_tracks
                        .iter()
                        .filter(|t| t.id != tgt_a.id)
                        .map(|t| t.id.to_string())
                        .collect();
                    if other_audios.is_empty() {
                        cmd.push("--no-audio".to_string());
                    } else {
                        cmd.push("--audio-tracks".to_string());
                        cmd.push(other_audios.join(","));
                    }
                } else {
                    // Lossless shift in place
                    cmd.push("--sync".to_string());
                    cmd.push(format!("{}:{}", tgt_a.id, audio_delay_ms));
                }
            }

            cmd.push(clean_vid.clone());

            // Add converted Opus audio if present
            if let (Some(ref tgt_a), Some(ref opus_file)) =
                (&target_audio_track, &final_opus_audio)
            {
                let props = tgt_a.properties.as_ref().cloned().unwrap_or_default();
                let lang = props.language.unwrap_or_else(|| "und".to_string());
                let name = props.track_name.unwrap_or_default();
                let name_label = if name.is_empty() {
                    "Opus".to_string()
                } else {
                    format!("{} (Opus)", name)
                };
                if audio_delay_ms != 0 {
                    cmd.push("--sync".to_string());
                    cmd.push(format!("0:{}", audio_delay_ms));
                }
                cmd.push("--language".to_string());
                cmd.push(format!("0:{}", lang));
                cmd.push("--track-name".to_string());
                cmd.push(format!("0:{}", name_label));
                if props.default_track.unwrap_or(false) {
                    cmd.push("--default-track".to_string());
                    cmd.push("0:1".to_string());
                } else {
                    cmd.push("--default-track".to_string());
                    cmd.push("0:0".to_string());
                }
                if props.forced_track.unwrap_or(false) {
                    cmd.push("--forced-track".to_string());
                    cmd.push("0:1".to_string());
                } else {
                    cmd.push("--forced-track".to_string());
                    cmd.push("0:0".to_string());
                }
                cmd.push(opus_file.clone());
            }

            // Add synchronized subtitle if present
            if let (Some(ref tgt_s), Some(ref sub_file)) = (&target_sub_track, &final_sub_path) {
                let props = tgt_s.properties.as_ref().cloned().unwrap_or_default();
                let lang = props.language.unwrap_or_else(|| "und".to_string());
                let name = props.track_name.unwrap_or_default();
                if sub_delay_ms != 0 {
                    cmd.push("--sync".to_string());
                    cmd.push(format!("0:{}", sub_delay_ms));
                }
                cmd.push("--language".to_string());
                cmd.push(format!("0:{}", lang));
                if !name.is_empty() {
                    cmd.push("--track-name".to_string());
                    cmd.push(format!("0:{}", name));
                }
                if props.default_track.unwrap_or(false) {
                    cmd.push("--default-track".to_string());
                    cmd.push("0:1".to_string());
                } else {
                    cmd.push("--default-track".to_string());
                    cmd.push("0:0".to_string());
                }
                if props.forced_track.unwrap_or(false) {
                    cmd.push("--forced-track".to_string());
                    cmd.push("0:1".to_string());
                } else {
                    cmd.push("--forced-track".to_string());
                    cmd.push("0:0".to_string());
                }
                cmd.push(sub_file.clone());
            }

            let rc = run_subprocess(&cmd, Some(out_dir))?;

            for t_f in temp_files {
                let _ = fs::remove_file(t_f);
            }

            if rc != 0 {
                log_line(&format!("   ❌ Error writing {}", filename));
            } else {
                let rel_sub = compute_relative_subfolder(&vid_folder, &clean_vid);
                let display_saved = if rel_sub.as_os_str().is_empty() {
                    out_file.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
                } else {
                    rel_sub.join(out_file.file_name().unwrap_or_default()).to_string_lossy().to_string()
                };
                log_line(&format!("   ✅ Saved: {}", display_saved));
            }
        }
    }

    log_line(&format!("\nDone! Output files saved to: {}", out_folder));
    Ok(())
}
