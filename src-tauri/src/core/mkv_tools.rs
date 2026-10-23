use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::core::processes::{capture_command, CompletedProcess};
use crate::core::tasks::{check_cancelled, TaskError};
use crate::core::utils::{ask_user, log_line, normalize_path, AskOptions};

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct TrackProperties {
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub track_name: Option<String>,
    #[serde(default)]
    pub default_track: Option<bool>,
    #[serde(default)]
    pub forced_track: Option<bool>,
    #[serde(default)]
    pub codec_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Track {
    pub id: i64,
    #[serde(rename = "type", default)]
    pub track_type: String,
    #[serde(default)]
    pub codec: Option<String>,
    #[serde(default)]
    pub properties: Option<TrackProperties>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MkvMetadata {
    #[serde(default)]
    pub tracks: Vec<Track>,
    #[serde(default)]
    pub attachments: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct CacheKey {
    filepath: String,
    size: u64,
    modified_ns: u128,
}

pub type CaptureHook =
    Arc<dyn Fn(&[String], Option<&Path>) -> Result<CompletedProcess, TaskError> + Send + Sync>;

static METADATA_CACHE: RwLock<Option<HashMap<CacheKey, MkvMetadata>>> = RwLock::new(None);
static CAPTURE_HOOK: RwLock<Option<CaptureHook>> = RwLock::new(None);

pub fn clear_metadata_cache() {
    *METADATA_CACHE.write().unwrap() = None;
}

pub fn set_capture_hook(hook: Option<CaptureHook>) {
    *CAPTURE_HOOK.write().unwrap() = hook;
}

fn read_metadata_cached(
    filepath: &str,
    size: u64,
    modified_ns: u128,
) -> Result<MkvMetadata, TaskError> {
    let key = CacheKey {
        filepath: filepath.to_string(),
        size,
        modified_ns,
    };

    if let Some(ref map) = *METADATA_CACHE.read().unwrap() {
        if let Some(found) = map.get(&key) {
            return Ok(found.clone());
        }
    }

    let read_path = windows_long_path(filepath);
    let cmd = vec![
        "mkvmerge".to_string(),
        "-J".to_string(),
        read_path,
    ];
    let parent = Path::new(filepath).parent();

    let result = if let Some(hook) = CAPTURE_HOOK.read().unwrap().clone() {
        hook(&cmd, parent)?
    } else {
        capture_command(&cmd, parent)?
    };

    if result.returncode != 0 && result.returncode != 1 {
        let detail = result.stderr.trim();
        return Err(TaskError::Message(format!(
            "Cannot read tracks from {}: {}",
            filepath, detail
        )));
    }

    let parsed: MkvMetadata = serde_json::from_str(&result.stdout).map_err(|e| {
        TaskError::Message(format!("Invalid JSON from mkvmerge for {}: {}", filepath, e))
    })?;

    let mut guard = METADATA_CACHE.write().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    if map.len() >= 256 {
        map.clear();
    }
    map.insert(key, parsed.clone());
    Ok(parsed)
}

pub fn windows_long_path(filepath: &str) -> String {
    #[cfg(windows)]
    {
        let upper = filepath.to_uppercase();
        let excluded_drive = ["Z:", "X:", "Y:", "W:", "V:"]
            .iter()
            .any(|d| upper.starts_with(d));
        if !filepath.starts_with("\\\\") && !excluded_drive {
            return format!("\\\\?\\{}", filepath);
        }
    }
    filepath.to_string()
}

fn metadata(filepath: &str) -> Result<MkvMetadata, TaskError> {
    check_cancelled()?;
    let norm = normalize_path(Path::new(filepath));
    let norm_str = norm.to_string_lossy().to_string();
    let info = fs::metadata(&norm).map_err(|e| {
        TaskError::Message(format!("Cannot stat file {}: {}", norm_str, e))
    })?;
    let size = info.len();
    let modified_ns = info
        .modified()
        .ok()
        .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    read_metadata_cached(&norm_str, size, modified_ns)
}

pub fn get_tracks_info(filepath: &str) -> Result<Vec<Track>, TaskError> {
    Ok(metadata(filepath)?.tracks)
}

pub fn has_attachments(filepath: &str) -> Result<bool, TaskError> {
    Ok(!metadata(filepath)?.attachments.is_empty())
}

pub fn get_subtitle_extension_and_syncability(track: &Track) -> (&'static str, bool) {
    let codec_id = track
        .properties
        .as_ref()
        .and_then(|p| p.codec_id.as_deref())
        .unwrap_or("")
        .to_uppercase();
    let codec_name = track.codec.as_deref().unwrap_or("").to_uppercase();

    if codec_id.contains("ASS") || codec_id.contains("SSA") || codec_name.contains("ASS") {
        (".ass", true)
    } else if codec_id.contains("PGS") || codec_name.contains("PG") {
        (".sup", false)
    } else if codec_id.contains("VOBSUB") {
        (".sub", false)
    } else {
        (".srt", true)
    }
}

pub fn format_track_label(track: &Track) -> String {
    let props = track.properties.as_ref();
    let lang = props.and_then(|p| p.language.as_deref()).unwrap_or("und");
    let codec = track.codec.as_deref().unwrap_or("Unknown");
    let name = props.and_then(|p| p.track_name.as_deref()).unwrap_or("");

    let mut label = format!("[ID: {}] {} ({})", track.id, lang.to_uppercase(), codec);
    if !name.is_empty() {
        label.push_str(&format!(" - {}", name));
    }

    let mut flags = Vec::new();
    if props.and_then(|p| p.default_track).unwrap_or(false) {
        flags.push("Default");
    }
    if props.and_then(|p| p.forced_track).unwrap_or(false) {
        flags.push("Forced");
    }
    if !flags.is_empty() {
        label.push_str(&format!(" [{}]", flags.join("|")));
    }

    label
}

pub fn select_track_interactive(
    tracks: &[Track],
    track_type: &str,
    group_desc: &str,
) -> Result<Option<Track>, TaskError> {
    let candidates: Vec<Track> = tracks
        .iter()
        .filter(|t| t.track_type == track_type)
        .cloned()
        .collect();
    if candidates.is_empty() {
        return Ok(None);
    }
    if candidates.len() == 1 {
        return Ok(Some(candidates[0].clone()));
    }

    let ita_tracks: Vec<Track> = candidates
        .iter()
        .filter(|t| {
            matches!(
                t.properties
                    .as_ref()
                    .and_then(|p| p.language.as_deref()),
                Some("ita") | Some("it")
            )
        })
        .cloned()
        .collect();
    if ita_tracks.len() == 1 {
        return Ok(Some(ita_tracks[0].clone()));
    }

    log_line(&format!("\n[Track Selection] FOR: {}", group_desc));
    log_line(&format!(
        "Multiple {} tracks found. Which one do you want to use?",
        track_type
    ));
    for t in &candidates {
        log_line(&format!("   {}", format_track_label(t)));
    }

    loop {
        let sel = ask_user(
            "Choose the track to use in this batch",
            AskOptions {
                tracks: candidates.clone(),
                kind: "single".to_string(),
                allow_empty: false,
                allow_skip: false,
                context: Some(group_desc.to_string()),
                files: Vec::new(),
            },
        )?;
        if let Ok(id) = sel.trim().parse::<i64>() {
            if let Some(found) = candidates.iter().find(|t| t.id == id) {
                return Ok(Some(found.clone()));
            }
        }
    }
}
