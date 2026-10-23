use std::fs;
use std::path::Path;

use tempfile::Builder;

use crate::core::audio_sync::{
    convert_audio_file_to_opus, extract_audio_segment, find_audio_delay,
};
use crate::core::config::{get_config, MAX_AUDIO_DELAY_MS, VIDEO_EXT};
use crate::core::mkv_tools::{
    get_tracks_info, has_attachments, select_track_interactive, windows_long_path, Track,
};
use crate::core::tasks::{check_cancelled, TaskError};
use crate::core::utils::{
    ask_directory, ask_user, get_files_recursive, get_track_signature, log_line, match_files,
    build_output_path, compute_relative_subfolder, normalize_path, run_subprocess, set_file_progress, AskOptions,
};

struct InjectionGroup {
    tracks: Vec<Track>,
    pairs: Vec<(String, String)>,
}

pub fn run_injection() -> Result<(), TaskError> {
    log_line("\n--- SOURCE -> TARGET INJECTION ---");
    let tgt_folder = ask_directory("Select TARGET Folder (High Quality Video)")?;
    let src_folder = ask_directory("Select SOURCE Folder (Audio/Subtitles to extract)")?;
    if tgt_folder.is_empty() || src_folder.is_empty() {
        return Ok(());
    }

    let out_folder = ask_directory("Select OUTPUT Folder")?;
    if out_folder.is_empty() {
        return Ok(());
    }

    let targets = get_files_recursive(&tgt_folder, VIDEO_EXT)?;
    let sources = get_files_recursive(&src_folder, VIDEO_EXT)?;
    let pairs = match_files(targets, sources)?;
    if pairs.is_empty() {
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

    log_line("\n[TARGET] What do you want to KEEP from the High Quality file (RAW)?");
    let keep_tgt_audio =
        ask_user("Keep original audio from the target?", confirm_opts.clone())?.to_lowercase()
            == "y";
    let keep_tgt_subs = ask_user(
        "Keep original subtitles from the target?",
        confirm_opts.clone(),
    )?
    .to_lowercase()
        == "y";

    let cfg = get_config();

    log_line("\n[SOURCE] What do you want to IMPORT from the Source file?");
    let do_audio =
        ask_user("Import audio from the source?", confirm_opts.clone())?.to_lowercase() == "y";
    let mut do_audio_sync = false;
    let mut do_opus_audio = false;
    if do_audio {
        do_audio_sync = cfg.auto_sync_audio;
        log_line(&format!(
            "      Apply auto-sync to audio (WaveSync)? {} [from global settings]",
            if do_audio_sync { "y" } else { "n" }
        ));
        if cfg.opus_mode == "always" {
            log_line("      Apply Opus conversion to injected audio? y [from global settings]");
            do_opus_audio = true;
        } else if cfg.opus_mode == "prompt" {
            let prompt_text = format!(
                "Convert injected audio to Opus ({}k, {})?",
                cfg.opus_bitrate,
                if cfg.opus_downmix {
                    "stereo downmix"
                } else {
                    "preserve channels"
                }
            );
            do_opus_audio = ask_user(
                &prompt_text,
                confirm_opts.clone(),
            )?
            .to_lowercase()
                == "y";
        }
    }

    let do_subs =
        ask_user("Import subtitles from the source?", confirm_opts.clone())?.to_lowercase() == "y";
    let mut do_sub_sync = false;
    let mut do_attachments = false;
    if do_subs {
        do_sub_sync = cfg.auto_sync_subs;
        log_line(&format!(
            "      Apply auto-sync to subtitles (ffsubsync)? {} [from global settings]",
            if do_sub_sync { "y" } else { "n" }
        ));
        log_line("      (For ASS subtitles, importing original Fonts is vital to keep styling)");
        do_attachments = ask_user(
            "Import attachments (fonts) from the source?",
            confirm_opts.clone(),
        )?
        .to_lowercase()
            != "n";
    }

    log_line("\n[Analyze] Analyzing SOURCE file structures and dividing into groups...");
    let mut groups: Vec<(String, InjectionGroup)> = Vec::new();
    let total_pairs_count = pairs.len();
    for (idx, (tgt, src)) in pairs.iter().enumerate() {
        check_cancelled()?;
        let bname = Path::new(src)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        log_line(&format!("   [{}/{}] Probing: {}", idx + 1, total_pairs_count, bname));
        let src_tracks = get_tracks_info(src)?;
        let sig = get_track_signature(&src_tracks);
        if let Some((_, group)) = groups.iter_mut().find(|(s, _)| s == &sig) {
            group.pairs.push((tgt.clone(), src.clone()));
        } else {
            groups.push((
                sig,
                InjectionGroup {
                    tracks: src_tracks,
                    pairs: vec![(tgt.clone(), src.clone())],
                },
            ));
        }
    }

    let total_groups = groups.len();
    let total_pairs = pairs.len();
    let mut processed_idx = 0;

    for (idx, (_, group)) in groups.into_iter().enumerate() {
        let i = idx + 1;
        let pairs_in_group = group.pairs;
        let src_tracks = group.tracks;

        log_line(&format!("\n{}", "=".repeat(60)));
        log_line(&format!(
            "[Batch {}/{} - {} pairs:",
            i,
            total_groups,
            pairs_in_group.len()
        ));

        let selected_audio_track = if do_audio {
            select_track_interactive(&src_tracks, "audio", &format!("Batch {}/{}", i, total_groups))?
        } else {
            None
        };

        let selected_sub_track = if do_subs {
            select_track_interactive(
                &src_tracks,
                "subtitles",
                &format!("Batch {}/{}", i, total_groups),
            )?
        } else {
            None
        };

        for (tgt, src) in pairs_in_group {
            let tgt_buf = normalize_path(Path::new(&tgt));
            let src_buf = normalize_path(Path::new(&src));
            let filename = tgt_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            processed_idx += 1;
            set_file_progress(&filename, processed_idx, total_pairs);
            let _base_name = tgt_buf
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            log_line(&format!("\n>> Processing Target: {}", filename));

            let tgt_clean = tgt_buf.to_string_lossy().to_string();
            let src_clean = src_buf.to_string_lossy().to_string();

            let out_file = build_output_path(&out_folder, &tgt_folder, &tgt_clean, "_final.mkv")?;
            let out_dir = out_file.parent().unwrap_or_else(|| Path::new(&out_folder));

            let temp_dir = Builder::new()
                .prefix("syncforge_")
                .tempdir_in(out_dir)
                .map_err(|e| TaskError::Message(e.to_string()))?;

            let mut temp_files: Vec<String> = Vec::new();
            let mut src_read_path = src_clean.clone();

            let mut cmd = vec![
                "mkvmerge".to_string(),
                "-o".to_string(),
                out_file.to_string_lossy().to_string(),
            ];

            if !keep_tgt_audio {
                cmd.push("--no-audio".to_string());
            }
            if !keep_tgt_subs {
                cmd.push("--no-subtitles".to_string());
            }

            cmd.push(tgt_clean.clone());

            let mut audio_delay_ms: i64 = 0;
            let mut sub_delay_ms: i64 = 0;
            let mut sample_start = "00:05:00".to_string();
            let mut sample_duration = "00:02:00".to_string();
            let mut extracted_audio_path: Option<String> = None;
            let mut final_audio_to_merge: Option<String> = None;
            let mut final_sub_path: Option<String> = None;

            if let (true, Some(ref a_track)) = (do_audio, &selected_audio_track) {
                log_line(&format!("   [Extract] Extracting Audio ID {}...", a_track.id));
                let full_audio_path = temp_dir
                    .path()
                    .join("temp_full_audio.mka")
                    .to_string_lossy()
                    .to_string();

                src_read_path = windows_long_path(&src_clean);
                run_subprocess(
                    &[
                        "mkvmerge".to_string(),
                        "-o".to_string(),
                        full_audio_path.clone(),
                        "--no-video".to_string(),
                        "--no-subtitles".to_string(),
                        "--no-attachments".to_string(),
                        "--no-chapters".to_string(),
                        "--audio-tracks".to_string(),
                        a_track.id.to_string(),
                        src_read_path.clone(),
                    ],
                    Some(out_dir),
                )?;
                temp_files.push(full_audio_path.clone());
                extracted_audio_path = Some(full_audio_path.clone());

                if do_audio_sync {
                    log_line(&format!(
                        "   [Sync] Searching for sync (Max +/- {}ms)...",
                        MAX_AUDIO_DELAY_MS
                    ));
                    let wav_ref = temp_dir
                        .path()
                        .join("temp_ref.wav")
                        .to_string_lossy()
                        .to_string();
                    let wav_src = temp_dir
                        .path()
                        .join("temp_src.wav")
                        .to_string_lossy()
                        .to_string();

                    extract_audio_segment(
                        &tgt_clean,
                        &wav_ref,
                        &sample_start,
                        &sample_duration,
                    )?;
                    extract_audio_segment(
                        &full_audio_path,
                        &wav_src,
                        &sample_start,
                        &sample_duration,
                    )?;

                    if Path::new(&wav_ref).exists() && Path::new(&wav_src).exists() {
                        audio_delay_ms = find_audio_delay(&wav_ref, &wav_src)?;
                        log_line(&format!("   [Sync] Delay applied: {} ms", audio_delay_ms));
                        temp_files.push(wav_ref);
                        temp_files.push(wav_src);
                    }
                } else {
                    log_line("   [Info] Audio auto-sync skipped.");
                }

                let mut final_audio_path = full_audio_path.clone();
                if do_opus_audio {
                    match convert_audio_file_to_opus(&full_audio_path, temp_dir.path(), out_dir) {
                        Ok(opus_path) => {
                            temp_files.push(opus_path.clone());
                            final_audio_path = opus_path;
                        }
                        Err(e) => {
                            log_line(&format!("   [Warning] Opus conversion failed, falling back to original audio: {}", e));
                        }
                    }
                }
                final_audio_to_merge = Some(final_audio_path);
            }

            if let (true, Some(ref s_track)) = (do_subs, &selected_sub_track) {
                log_line(&format!(
                    "   [mkvextract] [Extract] Extracting Sub ID {}...",
                    s_track.id
                ));

                let (sub_ext, can_sync) = crate::core::mkv_tools::get_subtitle_extension_and_syncability(s_track);

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
                        src_read_path.clone(),
                        "tracks".to_string(),
                        format!("{}:{}", s_track.id, raw_sub_path),
                    ],
                    Some(out_dir),
                )?;

                temp_files.push(raw_sub_path.clone());

                let mut final_sub_to_merge = if sub_ext == ".sub" {
                    Path::new(&raw_sub_path)
                        .with_extension("idx")
                        .to_string_lossy()
                        .to_string()
                } else {
                    raw_sub_path.clone()
                };

                if Path::new(&raw_sub_path).exists() {
                    if can_sync && do_sub_sync {
                        log_line("      [ffsubsync] [Sync] Starting ffsubsync...");
                        let cmd_ffsubsync = crate::core::utils::build_ffsubsync_args(&tgt_clean, &raw_sub_path, &synced_sub_path, &cfg);
                        run_subprocess(&cmd_ffsubsync, Some(out_dir))?;

                        if let Ok(meta) = fs::metadata(&synced_sub_path) {
                            if meta.len() > 0 {
                                final_sub_to_merge = synced_sub_path.clone();
                                temp_files.push(synced_sub_path);
                                log_line("      [Done] Sync successful.");
                            }
                        }
                    }
                    final_sub_path = Some(final_sub_to_merge);
                }
            }

            if cfg.preview_mpv && (final_audio_to_merge.is_some() || final_sub_path.is_some()) {
                loop {
                    let preview_ctx = serde_json::json!({
                        "filename": filename,
                        "target": tgt_clean,
                        "audio_file": extracted_audio_path.as_ref().or(final_audio_to_merge.as_ref()),
                        "audio_delay_ms": audio_delay_ms,
                        "sub_file": final_sub_path,
                        "sub_delay_ms": sub_delay_ms,
                        "start_time": sample_start,
                        "duration": sample_duration,
                        "has_audio": final_audio_to_merge.is_some(),
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
                            files: vec![tgt_clean.clone()],
                        },
                    )?;

                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&resp) {
                        let action = parsed
                            .get("action")
                            .and_then(|v| v.as_str())
                            .unwrap_or("confirm");
                        if action == "cancel" {
                            for t in temp_files {
                                let _ = fs::remove_file(t);
                            }
                            return Err(TaskError::Cancelled);
                        } else if action == "recalculate" {
                            if let Some(new_start) =
                                parsed.get("start_time").and_then(|v| v.as_str())
                            {
                                if !new_start.trim().is_empty() {
                                    sample_start = new_start.trim().to_string();
                                }
                            }
                            if let Some(new_dur) = parsed.get("duration").and_then(|v| v.as_str()) {
                                if !new_dur.trim().is_empty() {
                                    sample_duration = new_dur.trim().to_string();
                                }
                            }
                            if let Some(ref full_audio_path) = extracted_audio_path {
                                log_line(&format!(
                                    "   [Sync] Recalculating waveform sync at window {} ({})...",
                                    sample_start, sample_duration
                                ));
                                let wav_ref = temp_dir
                                    .path()
                                    .join("temp_ref_recalc.wav")
                                    .to_string_lossy()
                                    .to_string();
                                let wav_src = temp_dir
                                    .path()
                                    .join("temp_src_recalc.wav")
                                    .to_string_lossy()
                                    .to_string();
                                extract_audio_segment(
                                    &tgt_clean,
                                    &wav_ref,
                                    &sample_start,
                                    &sample_duration,
                                )?;
                                extract_audio_segment(
                                    full_audio_path,
                                    &wav_src,
                                    &sample_start,
                                    &sample_duration,
                                )?;
                                if Path::new(&wav_ref).exists() && Path::new(&wav_src).exists() {
                                    audio_delay_ms = find_audio_delay(&wav_ref, &wav_src)?;
                                    log_line(&format!(
                                        "   [Sync] Recalculated delay: {} ms",
                                        audio_delay_ms
                                    ));
                                    temp_files.push(wav_ref);
                                    temp_files.push(wav_src);
                                }
                            }
                            continue;
                        } else {
                            if let Some(a_ms) =
                                parsed.get("audio_delay_ms").and_then(|v| v.as_i64())
                            {
                                audio_delay_ms = a_ms;
                            }
                            if let Some(s_ms) = parsed.get("sub_delay_ms").and_then(|v| v.as_i64())
                            {
                                sub_delay_ms = s_ms;
                            }
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }

            if let Some(final_audio_path) = final_audio_to_merge {
                let (a_lang, a_name) = if let Some(ref a_t) = selected_audio_track {
                    let l = a_t.properties.as_ref().and_then(|p| p.language.as_deref()).unwrap_or("und");
                    let n = a_t.properties.as_ref().and_then(|p| p.track_name.as_deref()).unwrap_or("Muxed Audio");
                    (l, n)
                } else {
                    ("und", "Muxed Audio")
                };
                cmd.extend([
                    "--language".to_string(),
                    format!("0:{}", a_lang),
                    "--track-name".to_string(),
                    format!("0:{}", a_name),
                    "--sync".to_string(),
                    format!("0:{}", audio_delay_ms),
                    final_audio_path,
                ]);
            }

            if let Some(final_sub_to_merge) = final_sub_path {
                let (s_lang, s_name) = if let Some(ref s_t) = selected_sub_track {
                    let l = s_t.properties.as_ref().and_then(|p| p.language.as_deref()).unwrap_or("und");
                    let n = s_t.properties.as_ref().and_then(|p| p.track_name.as_deref()).unwrap_or("Muxed Sub");
                    (l, n)
                } else {
                    ("und", "Muxed Sub")
                };
                cmd.extend([
                    "--language".to_string(),
                    format!("0:{}", s_lang),
                    "--track-name".to_string(),
                    format!("0:{}", s_name),
                ]);
                if sub_delay_ms != 0 {
                    cmd.extend(["--sync".to_string(), format!("0:{}", sub_delay_ms)]);
                }
                cmd.push(final_sub_to_merge);
            }

            if do_attachments && has_attachments(&src_clean)? {
                log_line("   [Attachments] Importing attachments (Fonts/Images)...");
                cmd.extend([
                    "--no-video".to_string(),
                    "--no-audio".to_string(),
                    "--no-subtitles".to_string(),
                    "--no-chapters".to_string(),
                    "--no-track-tags".to_string(),
                    "--no-global-tags".to_string(),
                    src_clean,
                ]);
            }

            log_line("   [mkvmerge] [Mux] Writing MKV file...");
            let returncode = run_subprocess(&cmd, Some(out_dir))?;

            for t in temp_files {
                let _ = fs::remove_file(t);
            }

            if returncode != 0 {
                log_line("   [Error] ERROR during muxing.");
            } else {
                let rel_sub = compute_relative_subfolder(&tgt_folder, &tgt_clean);
                let display_saved = if rel_sub.as_os_str().is_empty() {
                    out_file.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
                } else {
                    rel_sub.join(out_file.file_name().unwrap_or_default()).to_string_lossy().to_string()
                };
                log_line(&format!("   [Done] -> {}", display_saved));
            }
        }
    }

    Ok(())
}
