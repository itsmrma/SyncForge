use std::fs;
use std::path::Path;

use tempfile::Builder;

use crate::core::audio_sync::convert_audio_track_to_opus;
use crate::core::config::{get_config, VIDEO_EXT};
use crate::core::mkv_tools::{format_track_label, get_tracks_info, windows_long_path, Track};
use crate::core::tasks::{check_cancelled, TaskError};
use crate::core::utils::{
    ask_directory, ask_user, get_files_recursive, get_track_signature, log_line, normalize_path,
    build_output_path, compute_relative_subfolder, parse_track_selection, run_subprocess, set_file_progress, AskOptions,
};

struct StreamGroup {
    tracks: Vec<Track>,
    files: Vec<String>,
}

struct StreamAction {
    group_idx: usize,
    files: Vec<String>,
    tracks: Vec<Track>,
    ids_to_keep: Option<Vec<i64>>,
    do_opus: bool,
    audio_tracks_info: Vec<Track>,
}

pub fn run_stream_manager() -> Result<(), TaskError> {
    log_line("\n--- MODE 1: STREAM MANAGER (SMART BATCH) ---");
    let folder = ask_directory("Select Video Folder to process")?;
    if folder.is_empty() {
        return Ok(());
    }

    let out_folder = ask_directory("Select OUTPUT Folder")?;
    if out_folder.is_empty() {
        return Ok(());
    }

    let videos = get_files_recursive(&folder, VIDEO_EXT)?;
    if videos.is_empty() {
        log_line("No videos found.");
        return Ok(());
    }

    log_line("\n[Analyze] Analyzing file structures and dividing into groups...");
    let mut groups: Vec<(String, StreamGroup)> = Vec::new();
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
                StreamGroup {
                    tracks,
                    files: vec![vid.clone()],
                },
            ));
        }
    }

    log_line(&format!(
        "[Info] Found {} files, grouped into {} distinct track structures.",
        videos.len(),
        groups.len()
    ));

    log_line(&format!("\n{}", "=".repeat(60)));
    log_line("CONFIGURATION PHASE");
    log_line("Answer questions for each group. Processing starts at the end.");
    log_line(&"=".repeat(60));

    let mut actions_to_execute: Vec<StreamAction> = Vec::new();
    let total_groups = groups.len();

    for (idx, (_, group)) in groups.into_iter().enumerate() {
        let i = idx + 1;
        let files = group.files;
        let tracks = group.tracks;

        log_line(&format!(
            "\n[Group {}/{} - Contains {} identical files:",
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
            log_line(&format!("  ... and {} more files.", files.len() - 3));
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

        log_line("\n--- AUDIO TRACKS ---");
        if !audio_tracks.is_empty() {
            for t in &audio_tracks {
                log_line(&format_track_label(t));
            }
        } else {
            log_line(" (No audio tracks)");
        }

        log_line("\n--- SUBTITLE TRACKS ---");
        if !sub_tracks.is_empty() {
            for t in &sub_tracks {
                log_line(&format_track_label(t));
            }
        } else {
            log_line(" (No subtitle tracks)");
        }

        log_line("\n------------------------------------------------");
        log_line("Enter IDs to KEEP for this group (e.g. 1, 3).");
        log_line(" - Leave EMPTY to keep everything.");
        log_line(" - Type 's' to SKIP this group.");

        let mut all_selectable = audio_tracks.clone();
        all_selectable.extend(sub_tracks.clone());

        let sel = ask_user(
            "Choose the audio and subtitle tracks to keep",
            AskOptions {
                tracks: all_selectable.clone(),
                kind: "multiple".to_string(),
                allow_empty: false,
                allow_skip: true,
                context: Some(format!("Group {}/{} • {} files", i, total_groups, files.len())),
                files: files.clone(),
            },
        )?
        .trim()
        .to_lowercase();

        if sel == "s" {
            log_line(&format!("[Skip] Group {} skipped.", i));
            continue;
        }

        let ids_to_keep = if sel.is_empty() {
            None
        } else {
            Some(parse_track_selection(&sel, &all_selectable)?)
        };

        let kept_audio_tracks: Vec<Track> = match &ids_to_keep {
            Some(keep_ids) => audio_tracks
                .iter()
                .filter(|t| keep_ids.contains(&t.id))
                .cloned()
                .collect(),
            None => audio_tracks.clone(),
        };

        let cfg = get_config();
        let mut do_opus_conversion = false;
        if !kept_audio_tracks.is_empty() {
            if cfg.opus_mode == "always" {
                log_line("   [Opus] Conversion enabled [from global settings]");
                do_opus_conversion = true;
            } else if cfg.opus_mode == "prompt" {
                let prompt_text = format!(
                    "Convert kept audio tracks to Opus ({}k, {})?",
                    cfg.opus_bitrate,
                    if cfg.opus_downmix {
                        "stereo downmix"
                    } else {
                        "preserve channels"
                    }
                );
                let conv_ans = ask_user(
                    &prompt_text,
                    AskOptions {
                        tracks: kept_audio_tracks.clone(),
                        kind: "confirm".to_string(),
                        allow_empty: false,
                        allow_skip: false,
                        context: Some(format!(
                            "Group {}/{} • {} audio track(s) kept",
                            i,
                            total_groups,
                            kept_audio_tracks.len()
                        )),
                        files: files.clone(),
                    },
                )?
                .trim()
                .to_lowercase();
                do_opus_conversion = conv_ans == "y";
            }
        }

        actions_to_execute.push(StreamAction {
            group_idx: i,
            files,
            tracks,
            ids_to_keep,
            do_opus: do_opus_conversion,
            audio_tracks_info: audio_tracks,
        });
    }

    if actions_to_execute.is_empty() {
        log_line("\nNo actions programmed. Returning to main menu.");
        return Ok(());
    }

    log_line(&format!("\n{}", "=".repeat(60)));
    log_line("PROCESSING PHASE");
    log_line(&"=".repeat(60));

    let total_files: usize = actions_to_execute.iter().map(|a| a.files.len()).sum();
    let mut processed_idx = 0;

    for action in actions_to_execute {
        log_line(&format!(
            "\n[Process] Processing Group {} ({} files)...",
            action.group_idx,
            action.files.len()
        ));

        for vid in &action.files {
            let vid_path = Path::new(vid);
            let filename = vid_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            processed_idx += 1;
            set_file_progress(&filename, processed_idx, total_files);
            let _name_only = vid_path
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let clean_vid = normalize_path(vid_path).to_string_lossy().to_string();
            let out = build_output_path(&out_folder, &folder, &clean_vid, "_mod.mkv")?;
            let out_str = out.to_string_lossy().to_string();
            let out_dir = out.parent().unwrap_or_else(|| Path::new(&out_folder));

            let temp_dir = Builder::new()
                .prefix("syncforge_")
                .tempdir_in(out_dir)
                .map_err(|e| TaskError::Message(e.to_string()))?;

            let mut cmd = vec!["mkvmerge".to_string(), "-o".to_string(), out_str.clone()];
            let mut temp_files: Vec<String> = Vec::new();

            let (curr_a, curr_s): (Vec<Track>, Vec<Track>) =
                if let Some(ref keep_ids) = action.ids_to_keep {
                    (
                        action
                            .tracks
                            .iter()
                            .filter(|t| keep_ids.contains(&t.id) && t.track_type == "audio")
                            .cloned()
                            .collect(),
                        action
                            .tracks
                            .iter()
                            .filter(|t| keep_ids.contains(&t.id) && t.track_type == "subtitles")
                            .cloned()
                            .collect(),
                    )
                } else {
                    (
                        action
                            .tracks
                            .iter()
                            .filter(|t| t.track_type == "audio")
                            .cloned()
                            .collect(),
                        action
                            .tracks
                            .iter()
                            .filter(|t| t.track_type == "subtitles")
                            .cloned()
                            .collect(),
                    )
                };

            if action.do_opus && !curr_a.is_empty() {
                cmd.push("--no-audio".to_string());

                if action.ids_to_keep.is_some() {
                    if !curr_s.is_empty() {
                        cmd.push("--subtitle-tracks".to_string());
                        cmd.push(
                            curr_s
                                .iter()
                                .map(|t| t.id.to_string())
                                .collect::<Vec<_>>()
                                .join(","),
                        );
                    } else {
                        cmd.push("--no-subtitles".to_string());
                    }
                }

                cmd.push(clean_vid.clone());

                for a_track in &curr_a {
                    let idx = action
                        .audio_tracks_info
                        .iter()
                        .position(|t| t.id == a_track.id)
                        .unwrap_or(0);
                    let temp_opus = convert_audio_track_to_opus(
                        &clean_vid,
                        idx,
                        a_track.id,
                        temp_dir.path(),
                        out_dir,
                        &filename,
                    )?;
                    temp_files.push(temp_opus.clone());

                    let props = a_track.properties.clone().unwrap_or_default();
                    let lang = props.language.unwrap_or_else(|| "und".to_string());
                    let name = props.track_name.unwrap_or_default();

                    cmd.push("--language".to_string());
                    cmd.push(format!("0:{}", lang));
                    if !name.is_empty() {
                        cmd.push("--track-name".to_string());
                        cmd.push(format!("0:{} (Opus)", name));
                    }
                    if props.default_track.unwrap_or(false) {
                        cmd.push("--default-track".to_string());
                        cmd.push("0:1".to_string());
                    } else {
                        cmd.push("--default-track".to_string());
                        cmd.push("0:0".to_string());
                    }

                    cmd.push(temp_opus);
                }
            } else {
                if action.ids_to_keep.is_some() {
                    if !curr_a.is_empty() {
                        cmd.push("--audio-tracks".to_string());
                        cmd.push(
                            curr_a
                                .iter()
                                .map(|t| t.id.to_string())
                                .collect::<Vec<_>>()
                                .join(","),
                        );
                    } else {
                        cmd.push("--no-audio".to_string());
                    }

                    if !curr_s.is_empty() {
                        cmd.push("--subtitle-tracks".to_string());
                        cmd.push(
                            curr_s
                                .iter()
                                .map(|t| t.id.to_string())
                                .collect::<Vec<_>>()
                                .join(","),
                        );
                    } else {
                        cmd.push("--no-subtitles".to_string());
                    }
                }

                cmd.push(clean_vid.clone());
            }

            let returncode = run_subprocess(&cmd, Some(out_dir))?;

            for t_f in temp_files {
                let _ = fs::remove_file(t_f);
            }

            if returncode != 0 {
                log_line(&format!("   [Error] Error writing {}", filename));
            } else {
                let rel_sub = compute_relative_subfolder(&folder, &clean_vid);
                let display_saved = if rel_sub.as_os_str().is_empty() {
                    out.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
                } else {
                    rel_sub.join(out.file_name().unwrap_or_default()).to_string_lossy().to_string()
                };
                log_line(&format!("   -> Saved: {}", display_saved));
            }
        }
    }

    log_line(&format!("\n[Done] All batches processed in: {}", out_folder));
    Ok(())
}

pub fn run_set_default_tracks() -> Result<(), TaskError> {
    log_line("\n--- MODE 1B: SET DEFAULT/FORCED TRACKS (IN-PLACE) ---");
    let folder = ask_directory("Select Video Folder to process")?;
    if folder.is_empty() {
        return Ok(());
    }

    let videos = get_files_recursive(&folder, VIDEO_EXT)?;
    if videos.is_empty() {
        log_line("No videos found.");
        return Ok(());
    }

    log_line("\n[Analyze] Analyzing file structures and dividing into groups...");
    let mut groups: Vec<(String, StreamGroup)> = Vec::new();
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
                StreamGroup {
                    tracks,
                    files: vec![vid.clone()],
                },
            ));
        }
    }

    log_line(&format!(
        "[Info] Found {} files, grouped into {} structures.",
        videos.len(),
        groups.len()
    ));

    let total_groups = groups.len();
    for (idx, (_, group)) in groups.into_iter().enumerate() {
        let i = idx + 1;
        let files = group.files;
        let tracks = group.tracks;

        log_line(&format!("\n{}", "=".repeat(60)));
        log_line(&format!(
            "[Group {}/{} - Contains {} identical files:",
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
            log_line(&format!("  ... and {} more files.", files.len() - 3));
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

        log_line("\n--- AUDIO TRACKS ---");
        for t in &audio_tracks {
            log_line(&format_track_label(t));
        }

        log_line("\n--- SUBTITLE TRACKS ---");
        for t in &sub_tracks {
            log_line(&format_track_label(t));
        }

        log_line("\n------------------------------------------------");
        log_line("Enter Track ID. Leave EMPTY to not modify that parameter.");
        log_line("Type 's' to skip this group.");

        let sel_audio = ask_user(
            "Choose the default audio track",
            AskOptions {
                tracks: audio_tracks.clone(),
                kind: "single".to_string(),
                allow_empty: true,
                allow_skip: true,
                context: Some(format!("Group {}/{} • {} files", i, total_groups, files.len())),
                files: files.clone(),
            },
        )?
        .trim()
        .to_lowercase();

        if sel_audio == "s" {
            log_line(&format!("[Skip] Group {} skipped.", i));
            continue;
        }

        let sel_sub_def = ask_user(
            "Choose the default subtitle track",
            AskOptions {
                tracks: sub_tracks.clone(),
                kind: "single".to_string(),
                allow_empty: true,
                allow_skip: false,
                context: Some(format!("Group {}/{} • {} files", i, total_groups, files.len())),
                files: files.clone(),
            },
        )?
        .trim()
        .to_lowercase();

        let sel_sub_forced = ask_user(
            "Choose the forced subtitle track",
            AskOptions {
                tracks: sub_tracks.clone(),
                kind: "single".to_string(),
                allow_empty: true,
                allow_skip: false,
                context: Some(format!("Group {}/{} • {} files", i, total_groups, files.len())),
                files: files.clone(),
            },
        )?
        .trim()
        .to_lowercase();

        for (selection, candidates) in [
            (&sel_audio, &audio_tracks),
            (&sel_sub_def, &sub_tracks),
            (&sel_sub_forced, &sub_tracks),
        ] {
            if !selection.is_empty() {
                parse_track_selection(selection, candidates)?;
                if !selection.chars().all(|c| c.is_ascii_digit()) {
                    return Err(TaskError::Message(
                        "Enter one track ID, or leave the field empty.".to_string(),
                    ));
                }
            }
        }

        let target_audio_id: Option<i64> = sel_audio.parse().ok();
        let target_sub_def_id: Option<i64> = sel_sub_def.parse().ok();
        let target_sub_forced_id: Option<i64> = sel_sub_forced.parse().ok();

        if target_audio_id.is_none() && target_sub_def_id.is_none() && target_sub_forced_id.is_none()
        {
            log_line("No modification requested for this group.");
            continue;
        }

        log_line("[Process] Modifying in-place (No remuxing)...");
        let total_files: usize = files.len();
        for (f_idx, vid) in files.iter().enumerate() {
            let clean_vid_buf = normalize_path(Path::new(vid));
            let bname = clean_vid_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            set_file_progress(&bname, f_idx + 1, total_files);
            let clean_vid = clean_vid_buf.to_string_lossy().to_string();
            let vid_dir = clean_vid_buf.parent();
            let write_path = windows_long_path(&clean_vid);

            let mut cmd = vec!["mkvpropedit".to_string(), write_path];
            let mut modifiche_aggiunte = false;

            if let Some(target_a) = target_audio_id {
                for (a_idx, t) in audio_tracks.iter().enumerate() {
                    let val = if t.id == target_a { "1" } else { "0" };
                    cmd.extend([
                        "--edit".to_string(),
                        format!("track:a{}", a_idx + 1),
                        "--set".to_string(),
                        format!("flag-default={}", val),
                    ]);
                    modifiche_aggiunte = true;
                }
            }

            if target_sub_def_id.is_some() || target_sub_forced_id.is_some() {
                for (s_idx, t) in sub_tracks.iter().enumerate() {
                    let mut edits_for_track = Vec::new();
                    if let Some(target_sd) = target_sub_def_id {
                        let val_def = if t.id == target_sd { "1" } else { "0" };
                        edits_for_track.push("--set".to_string());
                        edits_for_track.push(format!("flag-default={}", val_def));
                    }
                    if let Some(target_sf) = target_sub_forced_id {
                        let val_forced = if t.id == target_sf { "1" } else { "0" };
                        edits_for_track.push("--set".to_string());
                        edits_for_track.push(format!("flag-forced={}", val_forced));
                    }
                    if !edits_for_track.is_empty() {
                        cmd.push("--edit".to_string());
                        cmd.push(format!("track:s{}", s_idx + 1));
                        cmd.extend(edits_for_track);
                        modifiche_aggiunte = true;
                    }
                }
            }

            let bname = clean_vid_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if modifiche_aggiunte {
                let returncode = run_subprocess(&cmd, vid_dir)?;
                if returncode != 0 {
                    log_line(&format!("   [Error] mkvpropedit error on {}", bname));
                } else {
                    log_line(&format!("   -> Modified: {}", bname));
                }
            } else {
                log_line(&format!("   -> No modifications for: {}", bname));
            }
        }
    }

    log_line("\n[Done] Operations completed on original files!");
    Ok(())
}
