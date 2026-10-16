use std::fs;
use std::path::Path;

use tempfile::Builder;

use crate::core::config::{get_config, SUB_EXT, VIDEO_EXT};
use crate::core::mkv_tools::{
    get_tracks_info, select_track_interactive, windows_long_path, Track,
};
use crate::core::tasks::TaskError;
use crate::core::utils::{
    ask_directory, get_files_recursive, get_track_signature, log_line, match_files, normalize_path,
    run_subprocess, set_file_progress,
};

pub fn run_sync_subs() -> Result<(), TaskError> {
    log_line("\n--- MODE 2: SYNC EXTERNAL SUBTITLES ---");
    let vid_folder = ask_directory("Select VIDEO Folder")?;
    let sub_folder = ask_directory("Select SUBTITLE Folder")?;
    if vid_folder.is_empty() || sub_folder.is_empty() {
        return Ok(());
    }

    let out_folder = ask_directory("Select OUTPUT Folder")?;
    if out_folder.is_empty() {
        return Ok(());
    }

    let videos = get_files_recursive(&vid_folder, VIDEO_EXT)?;
    let subs = get_files_recursive(&sub_folder, SUB_EXT)?;
    let pairs = match_files(videos, subs)?;
    if pairs.is_empty() {
        return Ok(());
    }

    let cfg = get_config();
    let total_pairs = pairs.len();

    for (idx, (v_path, s_path)) in pairs.into_iter().enumerate() {
        let v_name = Path::new(&v_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        set_file_progress(&v_name, idx + 1, total_pairs);
        log_line(&format!("Syncing: {}", v_name));

        let temp_dir = Builder::new()
            .prefix("syncforge_")
            .tempdir_in(&out_folder)
            .map_err(|e| TaskError::Message(e.to_string()))?;

        let sub_ext = Path::new(&s_path)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_else(|| ".srt".to_string());
        let synced = temp_dir
            .path()
            .join(format!("synced{}", sub_ext))
            .to_string_lossy()
            .to_string();

        let v_clean_buf = normalize_path(Path::new(&v_path));
        let s_clean_buf = normalize_path(Path::new(&s_path));
        let v_clean = v_clean_buf.to_string_lossy().to_string();
        let s_clean = s_clean_buf.to_string_lossy().to_string();

        if cfg.auto_sync_subs {
            let mut cmd_ffsubsync = vec![
                "ffsubsync".to_string(),
                v_clean.clone(),
                "-i".to_string(),
                s_clean.clone(),
                "-o".to_string(),
                synced.clone(),
            ];
            if cfg.enable_max_offset && cfg.max_offset_seconds > 0 {
                cmd_ffsubsync.push("--max-offset-seconds".to_string());
                cmd_ffsubsync.push(cfg.max_offset_seconds.to_string());
            }
            run_subprocess(&cmd_ffsubsync, None)?;
        } else {
            fs::copy(&s_clean_buf, &synced)
                .map_err(|e| TaskError::Message(format!("Failed to copy subtitle: {}", e)))?;
        }

        if Path::new(&synced).exists() {
            let name_only = v_clean_buf
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let out = normalize_path(&Path::new(&out_folder).join(format!("{}_subbed.mkv", name_only)));
            let out_dir = out.parent().unwrap_or_else(|| Path::new(&out_folder));

            let cmd = vec![
                "mkvmerge".to_string(),
                "-o".to_string(),
                out.to_string_lossy().to_string(),
                v_clean,
                "--language".to_string(),
                "0:ita".to_string(),
                synced.clone(),
            ];
            run_subprocess(&cmd, Some(out_dir))?;
            let _ = fs::remove_file(&synced);
        }
    }

    log_line(&format!("\nDone! Synced files saved to: {}", out_folder));
    Ok(())
}

struct SubMkvGroup {
    tracks: Vec<Track>,
    pairs: Vec<(String, String)>,
}

pub fn run_sync_subs_from_mkv() -> Result<(), TaskError> {
    log_line("\n--- MODE 2B: SYNC SUBS FROM OTHER MKV (SMART BATCH) ---");
    let tgt_folder = ask_directory("Select TARGET VIDEO Folder (to subtitle)")?;
    let src_folder = ask_directory("Select SOURCE VIDEO Folder (has subtitles)")?;
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

    log_line("\n🔍 Analyzing SOURCE file structures...");
    let mut groups: Vec<(String, SubMkvGroup)> = Vec::new();
    for (tgt, src) in &pairs {
        let src_tracks = get_tracks_info(src)?;
        let sig = get_track_signature(&src_tracks);
        if let Some((_, group)) = groups.iter_mut().find(|(s, _)| s == &sig) {
            group.pairs.push((tgt.clone(), src.clone()));
        } else {
            groups.push((
                sig,
                SubMkvGroup {
                    tracks: src_tracks,
                    pairs: vec![(tgt.clone(), src.clone())],
                },
            ));
        }
    }

    log_line(&format!(
        "✅ Found {} pairs, grouped into {} distinct source structures.",
        pairs.len(),
        groups.len()
    ));

    let cfg = get_config();
    let total_groups = groups.len();
    let total_pairs = pairs.len();
    let mut processed_idx = 0;

    for (idx, (_, group)) in groups.into_iter().enumerate() {
        let i = idx + 1;
        let pairs_in_group = group.pairs;
        let src_tracks = group.tracks;

        log_line(&format!("\n{}", "=".repeat(60)));
        log_line(&format!(
            "📦 BATCH {}/{} - Contains {} pairs:",
            i,
            total_groups,
            pairs_in_group.len()
        ));

        let Some(selected_sub_track) = select_track_interactive(
            &src_tracks,
            "subtitles",
            &format!("Batch {}/{}", i, total_groups),
        )?
        else {
            log_line("⏭️ No subtitle track selected, skipping batch.");
            continue;
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
                normalize_path(&Path::new(&out_folder).join(format!("{}_subbed.mkv", base_name)));
            let out_dir = out_file.parent().unwrap_or_else(|| Path::new(&out_folder));

            let temp_dir = Builder::new()
                .prefix("syncforge_")
                .tempdir_in(out_dir)
                .map_err(|e| TaskError::Message(e.to_string()))?;

            let mut temp_files: Vec<String> = Vec::new();

            log_line(&format!("   📝 Extracting Sub ID {}...", selected_sub_track.id));
            let codec_id = selected_sub_track
                .properties
                .as_ref()
                .and_then(|p| p.codec_id.as_deref())
                .unwrap_or("")
                .to_uppercase();
            let codec_name = selected_sub_track
                .codec
                .as_deref()
                .unwrap_or("")
                .to_uppercase();

            let (sub_ext, can_sync) =
                if codec_id.contains("ASS") || codec_id.contains("SSA") || codec_name.contains("ASS")
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
                .join(format!("temp_raw_2b{}", sub_ext))
                .to_string_lossy()
                .to_string();
            let synced_sub_path = temp_dir
                .path()
                .join(format!("temp_synced_2b{}", sub_ext))
                .to_string_lossy()
                .to_string();

            let src_read_path = windows_long_path(&src_clean);
            run_subprocess(
                &[
                    "mkvextract".to_string(),
                    src_read_path,
                    "tracks".to_string(),
                    format!("{}:{}", selected_sub_track.id, raw_sub_path),
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
                if can_sync && cfg.auto_sync_subs {
                    log_line("      [Sync] Running ffsubsync...");
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
                        } else {
                            log_line("      ⚠️ Sync failed or impossible. Using original.");
                        }
                    } else {
                        log_line("      ⚠️ Sync failed or impossible. Using original.");
                    }
                } else if can_sync && !cfg.auto_sync_subs {
                    log_line("      [Sync] Skipped (disabled in settings). Using original.");
                }

                let cmd = vec![
                    "mkvmerge".to_string(),
                    "-o".to_string(),
                    out_file.to_string_lossy().to_string(),
                    tgt_clean,
                    "--language".to_string(),
                    "0:ita".to_string(),
                    final_sub_to_merge,
                ];
                let returncode = run_subprocess(&cmd, Some(out_dir))?;
                if returncode != 0 {
                    log_line("   ❌ ERROR during muxing.");
                } else {
                    log_line("   ✅ Done.");
                }
            }

            for t in temp_files {
                let _ = fs::remove_file(t);
            }
        }
    }

    log_line(&format!(
        "\n✅ All files processed and saved in: {}",
        out_folder
    ));
    Ok(())
}
