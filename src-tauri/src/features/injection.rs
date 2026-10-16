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
use crate::core::tasks::TaskError;
use crate::core::utils::{
    ask_directory, ask_user, get_files_recursive, get_track_signature, log_line, match_files,
    normalize_path, run_subprocess, set_file_progress, AskOptions,
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
            do_opus_audio = ask_user(
                "Convert injected audio to Opus stereo 128kbps?",
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

    log_line("\n🔍 Analyzing SOURCE file structures...");
    let mut groups: Vec<(String, InjectionGroup)> = Vec::new();
    for (tgt, src) in &pairs {
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
            "📦 BATCH {}/{} - {} pairs:",
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
            let base_name = tgt_buf
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            log_line(&format!("\n>> Processing Target: {}", filename));

            let tgt_clean = tgt_buf.to_string_lossy().to_string();
            let src_clean = src_buf.to_string_lossy().to_string();

            let out_file =
                normalize_path(&Path::new(&out_folder).join(format!("{}_final.mkv", base_name)));
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

            if let (true, Some(ref a_track)) = (do_audio, &selected_audio_track) {
                log_line(&format!("   🎤 Extracting Audio ID {}...", a_track.id));
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

                let mut delay_ms = 0;
                if do_audio_sync {
                    log_line(&format!(
                        "   🧪 Searching for sync (Max +/- {}ms)...",
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

                    extract_audio_segment(&tgt_clean, &wav_ref, "00:05:00", "00:02:00")?;
                    extract_audio_segment(&full_audio_path, &wav_src, "00:05:00", "00:02:00")?;

                    if Path::new(&wav_ref).exists() && Path::new(&wav_src).exists() {
                        delay_ms = find_audio_delay(&wav_ref, &wav_src)?;
                        log_line(&format!("   ⏱️  Delay applied: {} ms", delay_ms));
                        temp_files.push(wav_ref);
                        temp_files.push(wav_src);
                    }
                } else {
                    log_line("   ℹ️ Audio auto-sync skipped.");
                }

                let mut final_audio_path = full_audio_path.clone();
                if do_opus_audio {
                    match convert_audio_file_to_opus(&full_audio_path, temp_dir.path(), out_dir) {
                        Ok(opus_path) => {
                            temp_files.push(opus_path.clone());
                            final_audio_path = opus_path;
                        }
                        Err(e) => {
                            log_line(&format!("   ⚠️ Opus conversion failed, falling back to original audio: {}", e));
                        }
                    }
                }

                cmd.extend([
                    "--language".to_string(),
                    "0:ita".to_string(),
                    "--track-name".to_string(),
                    "0:Muxed Audio".to_string(),
                    "--sync".to_string(),
                    format!("0:{}", delay_ms),
                    final_audio_path,
                ]);
            }

            if let (true, Some(ref s_track)) = (do_subs, &selected_sub_track) {
                log_line(&format!("   📝 Extracting Sub ID {}...", s_track.id));
                let codec_id = s_track
                    .properties
                    .as_ref()
                    .and_then(|p| p.codec_id.as_deref())
                    .unwrap_or("")
                    .to_uppercase();
                let codec_name = s_track.codec.as_deref().unwrap_or("").to_uppercase();

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
                        log_line("      [Sync] Starting ffsubsync...");
                        let mut cmd_ffsubsync = vec![
                            "ffsubsync".to_string(),
                            tgt_clean.clone(),
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
                                final_sub_to_merge = synced_sub_path.clone();
                                temp_files.push(synced_sub_path);
                                log_line("      ✅ Sync successful.");
                            }
                        }
                    }

                    cmd.extend([
                        "--language".to_string(),
                        "0:ita".to_string(),
                        "--track-name".to_string(),
                        "0:Muxed Sub".to_string(),
                        final_sub_to_merge,
                    ]);
                }
            }

            if do_attachments && has_attachments(&src_clean)? {
                log_line("   📎 Importing attachments (Fonts/Images)...");
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

            log_line("   💾 Writing MKV file...");
            let returncode = run_subprocess(&cmd, Some(out_dir))?;

            for t in temp_files {
                let _ = fs::remove_file(t);
            }

            if returncode != 0 {
                log_line("   ❌ ERROR during muxing.");
            } else {
                log_line("   ✅ Done.");
            }
        }
    }

    Ok(())
}
