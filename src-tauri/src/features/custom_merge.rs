use std::fs;
use std::path::Path;

use tempfile::Builder;

use crate::core::audio_sync::convert_audio_track_to_opus;
use crate::core::config::{get_config, VIDEO_EXT};
use crate::core::mkv_tools::{format_track_label, get_tracks_info, Track};
use crate::core::tasks::TaskError;
use crate::core::utils::{
    ask_directory, ask_user, get_files_recursive, get_track_signature, log_line, match_files,
    normalize_path, parse_track_selection, run_subprocess, set_file_progress, AskOptions,
};

struct MergeGroup {
    tracks_a: Vec<Track>,
    tracks_b: Vec<Track>,
    pairs: Vec<(String, String)>,
}

struct MergeAction {
    pairs: Vec<(String, String)>,
    keep_a_audio: Vec<i64>,
    keep_a_subs: Vec<i64>,
    keep_b_audio: Vec<i64>,
    keep_b_subs: Vec<i64>,
    do_opus: bool,
    tracks_a_audio: Vec<Track>,
    tracks_b_audio: Vec<Track>,
}

pub fn run_custom_merge() -> Result<(), TaskError> {
    log_line("\n--- MODE 4: CUSTOM MERGE FROM TWO SOURCES (SMART BATCH) ---");
    log_line("ℹ️ Direct remux: combines selected tracks without altering timing or audio sync.");
    let folder_a = ask_directory("Select Folder A (Base Video + Audio/Subs)")?;
    let folder_b = ask_directory("Select Folder B (Additional Audio/Subs)")?;
    if folder_a.is_empty() || folder_b.is_empty() {
        return Ok(());
    }

    let out_folder = ask_directory("Select OUTPUT Folder")?;
    if out_folder.is_empty() {
        return Ok(());
    }

    let files_a = get_files_recursive(&folder_a, VIDEO_EXT)?;
    let files_b = get_files_recursive(&folder_b, VIDEO_EXT)?;
    let pairs = match_files(files_a, files_b)?;
    if pairs.is_empty() {
        return Ok(());
    }

    log_line("\n🔍 Analyzing structure of pairs...");
    let mut groups: Vec<(String, MergeGroup)> = Vec::new();
    for (f_a, f_b) in &pairs {
        let tracks_a = get_tracks_info(f_a)?;
        let tracks_b = get_tracks_info(f_b)?;
        let sig = format!(
            "{}||{}",
            get_track_signature(&tracks_a),
            get_track_signature(&tracks_b)
        );
        if let Some((_, group)) = groups.iter_mut().find(|(s, _)| s == &sig) {
            group.pairs.push((f_a.clone(), f_b.clone()));
        } else {
            groups.push((
                sig,
                MergeGroup {
                    tracks_a,
                    tracks_b,
                    pairs: vec![(f_a.clone(), f_b.clone())],
                },
            ));
        }
    }

    log_line(&format!(
        "✅ Found {} pairs, grouped into {} distinct structures.",
        pairs.len(),
        groups.len()
    ));

    let mut actions_to_execute: Vec<MergeAction> = Vec::new();
    let total_groups = groups.len();

    for (idx, (_, group)) in groups.into_iter().enumerate() {
        let i = idx + 1;
        let pairs_in_group = group.pairs;
        let tracks_a = group.tracks_a;
        let tracks_b = group.tracks_b;
        let ctx = Some(format!(
            "Batch {}/{} / {} pairs",
            i,
            total_groups,
            pairs_in_group.len()
        ));

        log_line(&format!("\n{}", "=".repeat(60)));
        log_line(&format!(
            "📦 BATCH {}/{} - Contains {} pairs:",
            i,
            total_groups,
            pairs_in_group.len()
        ));

        log_line("\n--- FOLDER A (BASE VIDEO) ---");
        let audio_a: Vec<Track> = tracks_a
            .iter()
            .filter(|t| t.track_type == "audio")
            .cloned()
            .collect();
        let subs_a: Vec<Track> = tracks_a
            .iter()
            .filter(|t| t.track_type == "subtitles")
            .cloned()
            .collect();
        if !audio_a.is_empty() {
            log_line(" AUDIO:");
            for t in &audio_a {
                log_line(&format!("   {}", format_track_label(t)));
            }
        }
        if !subs_a.is_empty() {
            log_line(" SUBTITLES:");
            for t in &subs_a {
                log_line(&format!("   {}", format_track_label(t)));
            }
        }

        let pair_names: Vec<String> = pairs_in_group
            .iter()
            .map(|(a, b)| {
                let name_a = Path::new(a)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let name_b = Path::new(b)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                format!("{} ➔ {}", name_a, name_b)
            })
            .collect();

        let sel_a_audio = ask_user(
            "Choose audio tracks from Folder A",
            AskOptions {
                tracks: audio_a.clone(),
                kind: "multiple".to_string(),
                allow_empty: false,
                allow_skip: false,
                context: ctx.clone(),
                files: pair_names.clone(),
            },
        )?
        .trim()
        .to_lowercase();

        let sel_a_subs = ask_user(
            "Choose subtitle tracks from Folder A",
            AskOptions {
                tracks: subs_a.clone(),
                kind: "multiple".to_string(),
                allow_empty: false,
                allow_skip: false,
                context: ctx.clone(),
                files: pair_names.clone(),
            },
        )?
        .trim()
        .to_lowercase();

        log_line("\n--- FOLDER B (ADDITIONAL SOURCE) ---");
        let audio_b: Vec<Track> = tracks_b
            .iter()
            .filter(|t| t.track_type == "audio")
            .cloned()
            .collect();
        let subs_b: Vec<Track> = tracks_b
            .iter()
            .filter(|t| t.track_type == "subtitles")
            .cloned()
            .collect();
        if !audio_b.is_empty() {
            log_line(" AUDIO:");
            for t in &audio_b {
                log_line(&format!("   {}", format_track_label(t)));
            }
        }
        if !subs_b.is_empty() {
            log_line(" SUBTITLES:");
            for t in &subs_b {
                log_line(&format!("   {}", format_track_label(t)));
            }
        }

        let sel_b_audio = ask_user(
            "Choose audio tracks from Folder B",
            AskOptions {
                tracks: audio_b.clone(),
                kind: "multiple".to_string(),
                allow_empty: false,
                allow_skip: false,
                context: ctx.clone(),
                files: pair_names.clone(),
            },
        )?
        .trim()
        .to_lowercase();

        let sel_b_subs = ask_user(
            "Choose subtitle tracks from Folder B",
            AskOptions {
                tracks: subs_b.clone(),
                kind: "multiple".to_string(),
                allow_empty: false,
                allow_skip: false,
                context: ctx,
                files: pair_names,
            },
        )?
        .trim()
        .to_lowercase();

        let keep_a_audio = parse_track_selection(&sel_a_audio, &audio_a)?;
        let keep_a_subs = parse_track_selection(&sel_a_subs, &subs_a)?;
        let keep_b_audio = parse_track_selection(&sel_b_audio, &audio_b)?;
        let keep_b_subs = parse_track_selection(&sel_b_subs, &subs_b)?;

        let kept_audio_tracks: Vec<Track> = audio_a
            .iter()
            .filter(|t| keep_a_audio.contains(&t.id))
            .chain(audio_b.iter().filter(|t| keep_b_audio.contains(&t.id)))
            .cloned()
            .collect();

        let cfg = get_config();
        let mut do_opus = false;
        if !kept_audio_tracks.is_empty() {
            if cfg.opus_mode == "always" {
                log_line("   🎵 Opus conversion enabled [from global settings]");
                do_opus = true;
            } else if cfg.opus_mode == "prompt" {
                let conv_ans = ask_user(
                    "Convert merged audio tracks to Opus stereo 128kbps?",
                    AskOptions {
                        tracks: kept_audio_tracks.clone(),
                        kind: "confirm".to_string(),
                        allow_empty: false,
                        allow_skip: false,
                        context: Some(format!(
                            "Batch {}/{} • {} audio track(s) to merge",
                            i,
                            total_groups,
                            kept_audio_tracks.len()
                        )),
                        files: pair_names.clone(),
                    },
                )?
                .trim()
                .to_lowercase();
                do_opus = conv_ans == "y";
            }
        }

        actions_to_execute.push(MergeAction {
            pairs: pairs_in_group,
            keep_a_audio,
            keep_a_subs,
            keep_b_audio,
            keep_b_subs,
            do_opus,
            tracks_a_audio: audio_a,
            tracks_b_audio: audio_b,
        });
    }

    log_line(&format!("\n{}", "=".repeat(60)));
    log_line("🚀 MULTI-BATCH PROCESSING PHASE");
    log_line(&"=".repeat(60));

    let total_pairs: usize = actions_to_execute.iter().map(|a| a.pairs.len()).sum();
    let mut processed_idx = 0;

    for (batch_idx, action) in actions_to_execute.into_iter().enumerate() {
        log_line(&format!("\n💾 Processing Batch {}...", batch_idx + 1));
        for (f_a, f_b) in action.pairs {
            let clean_a_buf = normalize_path(Path::new(&f_a));
            let clean_b_buf = normalize_path(Path::new(&f_b));
            let filename = clean_a_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            processed_idx += 1;
            set_file_progress(&filename, processed_idx, total_pairs);
            let base_name = clean_a_buf
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let out_file =
                normalize_path(&Path::new(&out_folder).join(format!("{}_merged.mkv", base_name)));
            let out_dir = out_file.parent().unwrap_or_else(|| Path::new(&out_folder));

            let temp_dir = Builder::new()
                .prefix("syncforge_merge_")
                .tempdir_in(out_dir)?;
            let mut temp_files: Vec<String> = Vec::new();

            let mut cmd = vec![
                "mkvmerge".to_string(),
                "-o".to_string(),
                out_file.to_string_lossy().to_string(),
            ];

            let clean_a_str = clean_a_buf.to_string_lossy().to_string();
            let clean_b_str = clean_b_buf.to_string_lossy().to_string();

            if action.do_opus {
                // If opus conversion is active, convert audio tracks from A and B to opus
                for track_id in &action.keep_a_audio {
                    let idx = action
                        .tracks_a_audio
                        .iter()
                        .position(|t| t.id == *track_id)
                        .unwrap_or(0);
                    let opus_file = convert_audio_track_to_opus(
                        &clean_a_str,
                        idx,
                        *track_id,
                        temp_dir.path(),
                        out_dir,
                        &filename,
                    )?;
                    temp_files.push(opus_file);
                }
                cmd.push("--no-audio".to_string());
            } else if !action.keep_a_audio.is_empty() {
                cmd.push("--audio-tracks".to_string());
                cmd.push(
                    action
                        .keep_a_audio
                        .iter()
                        .map(|id| id.to_string())
                        .collect::<Vec<_>>()
                        .join(","),
                );
            } else {
                cmd.push("--no-audio".to_string());
            }

            if !action.keep_a_subs.is_empty() {
                cmd.push("--subtitle-tracks".to_string());
                cmd.push(
                    action
                        .keep_a_subs
                        .iter()
                        .map(|id| id.to_string())
                        .collect::<Vec<_>>()
                        .join(","),
                );
            } else {
                cmd.push("--no-subtitles".to_string());
            }

            cmd.push(clean_a_str);

            cmd.push("--no-video".to_string());
            cmd.push("--no-chapters".to_string());

            if action.do_opus {
                for track_id in &action.keep_b_audio {
                    let idx = action
                        .tracks_b_audio
                        .iter()
                        .position(|t| t.id == *track_id)
                        .unwrap_or(0);
                    let opus_file = convert_audio_track_to_opus(
                        &clean_b_str,
                        idx,
                        *track_id,
                        temp_dir.path(),
                        out_dir,
                        &filename,
                    )?;
                    temp_files.push(opus_file);
                }
                cmd.push("--no-audio".to_string());
            } else if !action.keep_b_audio.is_empty() {
                cmd.push("--audio-tracks".to_string());
                cmd.push(
                    action
                        .keep_b_audio
                        .iter()
                        .map(|id| id.to_string())
                        .collect::<Vec<_>>()
                        .join(","),
                );
            } else {
                cmd.push("--no-audio".to_string());
            }

            if !action.keep_b_subs.is_empty() {
                cmd.push("--subtitle-tracks".to_string());
                cmd.push(
                    action
                        .keep_b_subs
                        .iter()
                        .map(|id| id.to_string())
                        .collect::<Vec<_>>()
                        .join(","),
                );
            } else {
                cmd.push("--no-subtitles".to_string());
            }

            cmd.push(clean_b_str);

            // Append any converted opus audio tracks
            for opus_file in &temp_files {
                cmd.push(opus_file.clone());
            }

            let returncode = run_subprocess(&cmd, Some(out_dir))?;
            for t in temp_files {
                let _ = fs::remove_file(t);
            }

            if returncode != 0 {
                log_line(&format!("   ❌ Error writing {}", base_name));
            } else {
                let out_name = out_file
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                log_line(&format!("   -> Saved: {}", out_name));
            }
        }
    }

    log_line(&format!(
        "\n✅ Operations complete! Files saved to: {}",
        out_folder
    ));
    Ok(())
}
