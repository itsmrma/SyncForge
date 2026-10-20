use std::collections::VecDeque;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tempfile::Builder;

use crate::core::audio_sync::{extract_audio_segment, find_audio_delay};
use crate::core::config::{get_config_path, load_user_config, save_user_config};
use crate::core::processes::{check_all_tools, preview_sync_mpv, setup_environment};
use crate::core::utils::set_log_to_stderr;
use crate::ui::backend::{Api, FrontendBridge, PathsInput, RunResult, VERSION};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CliRunOptions {
    pub module: String,
    #[serde(default)]
    pub video: String,
    #[serde(default)]
    pub sub: String,
    #[serde(default)]
    pub output: String,

    // Settings overrides
    #[serde(default)]
    pub opus_mode: Option<String>,
    #[serde(default)]
    pub opus_bitrate: Option<u32>,
    #[serde(default)]
    pub opus_downmix: Option<bool>,
    #[serde(default)]
    pub auto_audio: Option<bool>,
    #[serde(default)]
    pub auto_subs: Option<bool>,
    #[serde(default)]
    pub enable_max_offset: Option<bool>,
    #[serde(default)]
    pub max_offset: Option<i64>,
    #[serde(default)]
    pub notify_on_finish: Option<bool>,
    #[serde(default)]
    pub preview_mpv: Option<bool>,

    // Automation & prompt answers
    #[serde(default)]
    pub yes: bool,
    #[serde(default)]
    pub auto_match: bool,
    #[serde(default)]
    pub json_output: bool,
    #[serde(default)]
    pub pairs: Vec<(String, String)>,
    #[serde(default)]
    pub answers: Vec<String>,

    // Semantic module-specific prompt options
    #[serde(default)]
    pub keep_tracks: Option<String>,
    #[serde(default)]
    pub keep_audio: Option<String>,
    #[serde(default)]
    pub keep_subs: Option<String>,
    #[serde(default)]
    pub default_audio: Option<String>,
    #[serde(default)]
    pub default_sub: Option<String>,
    #[serde(default)]
    pub forced_sub: Option<String>,
    #[serde(default)]
    pub audio_track: Option<String>,
    #[serde(default)]
    pub sub_track: Option<String>,
    #[serde(default)]
    pub ref_audio_track: Option<String>,
    #[serde(default)]
    pub target_audio_track: Option<String>,
    #[serde(default)]
    pub target_sub_track: Option<String>,
    #[serde(default)]
    pub keep_target_audio: Option<bool>,
    #[serde(default)]
    pub keep_target_subs: Option<bool>,
    #[serde(default)]
    pub import_audio: Option<bool>,
    #[serde(default)]
    pub import_subs: Option<bool>,
    #[serde(default)]
    pub import_attachments: Option<bool>,
    #[serde(default)]
    pub keep_a_audio: Option<String>,
    #[serde(default)]
    pub keep_a_subs: Option<String>,
    #[serde(default)]
    pub keep_b_audio: Option<String>,
    #[serde(default)]
    pub keep_b_subs: Option<String>,
    #[serde(default)]
    pub sync_audio: Option<bool>,
    #[serde(default)]
    pub sync_subs: Option<bool>,
}

pub fn normalize_module_id(raw: &str) -> Option<&'static str> {
    match raw.trim().to_lowercase().replace('-', "_").as_str() {
        "stream_manager" | "filter" | "remove_tracks" | "stream" => Some("stream_manager"),
        "set_default" | "default_flags" | "flags" | "default" => Some("set_default"),
        "sync_subs" | "subs" | "sub_sync" => Some("sync_subs"),
        "sync_subs_mkv" | "subs_mkv" | "extract_subs" => Some("sync_subs_mkv"),
        "injection" | "wavesync" | "inject" => Some("injection"),
        "custom_merge" | "merge" | "direct_merge" => Some("custom_merge"),
        "internal_sync" | "self_sync" | "inplace_sync" => Some("internal_sync"),
        _ => None,
    }
}

pub fn resolve_track_spec(spec: &str, tracks: &[Value], is_multiple: bool) -> String {
    resolve_track_spec_filtered(spec, tracks, is_multiple, None)
}

pub fn resolve_track_spec_filtered(
    spec: &str,
    tracks: &[Value],
    is_multiple: bool,
    default_type_filter: Option<&str>,
) -> String {
    let trimmed = spec.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let lower = trimmed.to_lowercase();
    if lower == "all" || lower == "*" {
        if let Some(filter) = default_type_filter {
            let ids: Vec<String> = tracks
                .iter()
                .filter(|t| {
                    let t_type = t
                        .get("type")
                        .or_else(|| t.get("track_type"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    t_type == filter || (filter == "subtitles" && (t_type == "sub" || t_type == "subs"))
                })
                .filter_map(|t| t.get("id").and_then(|v| v.as_i64()).map(|i| i.to_string()))
                .collect();
            return ids.join(",");
        }
        return String::new();
    }
    if lower == "none" || lower == "n" {
        return if is_multiple {
            "n".to_string()
        } else {
            String::new()
        };
    }
    if lower == "skip" || lower == "s" {
        return "s".to_string();
    }

    let mut resolved_ids: Vec<String> = Vec::new();
    for token in trimmed.split(',') {
        let raw_tok = token.trim();
        if raw_tok.is_empty() {
            continue;
        }

        // Inline type prefix support: a:, audio:, s:, sub:, subs:, v:, video:
        let (tok_str, effective_filter) = {
            let raw_lower = raw_tok.to_lowercase();
            if let Some(rest) = raw_lower.strip_prefix("a:").or_else(|| raw_lower.strip_prefix("audio:")) {
                (rest.trim().to_string(), Some("audio"))
            } else if let Some(rest) = raw_lower.strip_prefix("s:").or_else(|| raw_lower.strip_prefix("sub:")).or_else(|| raw_lower.strip_prefix("subs:")) {
                (rest.trim().to_string(), Some("subtitles"))
            } else if let Some(rest) = raw_lower.strip_prefix("v:").or_else(|| raw_lower.strip_prefix("video:")) {
                (rest.trim().to_string(), Some("video"))
            } else {
                (raw_tok.to_string(), default_type_filter)
            }
        };
        let tok = tok_str.as_str();

        if tok.is_empty() {
            continue;
        }

        if tok.chars().all(|c| c.is_ascii_digit()) {
            if let Some(filter) = effective_filter {
                let matches_type = tracks.iter().any(|t| {
                    let tid = t.get("id").and_then(|v| v.as_i64());
                    let t_type = t
                        .get("type")
                        .or_else(|| t.get("track_type"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    tid.map(|i| i.to_string()) == Some(tok.to_string())
                        && (t_type == filter || (filter == "subtitles" && (t_type == "sub" || t_type == "subs")))
                });
                if matches_type || tracks.is_empty() {
                    resolved_ids.push(tok.to_string());
                }
            } else {
                resolved_ids.push(tok.to_string());
            }
            continue;
        }

        let tok_lower = tok.to_lowercase();
        if tok_lower == "all" || tok_lower == "*" {
            if let Some(filter) = effective_filter {
                for t in tracks {
                    let t_type = t
                        .get("type")
                        .or_else(|| t.get("track_type"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if t_type == filter || (filter == "subtitles" && (t_type == "sub" || t_type == "subs")) {
                        if let Some(id) = t.get("id").and_then(|v| v.as_i64()) {
                            let id_str = id.to_string();
                            if !resolved_ids.contains(&id_str) {
                                resolved_ids.push(id_str);
                            }
                        }
                    }
                }
            }
            continue;
        }

        if tok_lower == "none" || tok_lower == "n" {
            continue;
        }

        let mut matched_for_tok = Vec::new();
        for t in tracks {
            let t_type = t
                .get("type")
                .or_else(|| t.get("track_type"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if let Some(filter) = effective_filter {
                let is_match = t_type == filter || (filter == "subtitles" && (t_type == "sub" || t_type == "subs"));
                if !is_match {
                    continue;
                }
            }

            let id = t.get("id").and_then(|v| v.as_i64());
            let lang = t
                .get("properties")
                .and_then(|p| p.get("language"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let name = t
                .get("properties")
                .and_then(|p| p.get("track_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            if let Some(track_id) = id {
                let lang_match = lang == tok_lower
                    || (tok_lower == "ita" && lang == "it")
                    || (tok_lower == "it" && lang == "ita")
                    || (tok_lower == "eng" && lang == "en")
                    || (tok_lower == "en" && lang == "eng")
                    || (tok_lower == "jpn" && (lang == "ja" || lang == "jp"))
                    || (tok_lower == "ja" && lang == "jpn");
                let name_match = !name.is_empty() && name.contains(&tok_lower);
                if lang_match || name_match {
                    matched_for_tok.push(track_id.to_string());
                }
            }
        }
        if !matched_for_tok.is_empty() {
            if is_multiple {
                resolved_ids.extend(matched_for_tok);
            } else {
                resolved_ids.push(matched_for_tok[0].clone());
            }
        } else {
            resolved_ids.push(tok.to_string());
        }
    }

    if !is_multiple && resolved_ids.len() > 1 {
        resolved_ids.truncate(1);
    }
    resolved_ids.join(",")
}

struct CliBridge {
    api: Api,
    opts: CliRunOptions,
    answer_queue: Mutex<VecDeque<String>>,
    last_track_type_seen: Mutex<Option<String>>,
}

impl CliBridge {
    fn new(api: Api, opts: CliRunOptions) -> Self {
        let queue = VecDeque::from(opts.answers.clone());
        Self {
            api,
            opts,
            answer_queue: Mutex::new(queue),
            last_track_type_seen: Mutex::new(None),
        }
    }

    fn match_semantic_answer(&self, prompt: &str, payload: &Value) -> Option<String> {
        let p_lower = prompt.to_lowercase();
        let kind = payload
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("text");
        let is_multiple = kind == "multiple";
        let tracks = payload
            .get("tracks")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        // 1. Check sequential answer queue first if populated
        if let Some(front) = self.answer_queue.lock().unwrap().pop_front() {
            return Some(resolve_track_spec(&front, &tracks, is_multiple));
        }

        // 2. Module-specific semantic flags
        // stream_manager
        if p_lower.contains("choose the audio and subtitle tracks to keep") {
            if self.opts.keep_audio.is_some() || self.opts.keep_subs.is_some() {
                let mut kept_ids: Vec<String> = Vec::new();

                let audio_specified = self.opts.keep_audio.is_some();
                let subs_specified = self.opts.keep_subs.is_some();

                if let Some(ref ka) = self.opts.keep_audio {
                    let a_ids = resolve_track_spec_filtered(ka, &tracks, true, Some("audio"));
                    if !a_ids.is_empty() && a_ids != "n" {
                        for id in a_ids.split(',') {
                            let id_t = id.trim();
                            if !id_t.is_empty() && !kept_ids.contains(&id_t.to_string()) {
                                kept_ids.push(id_t.to_string());
                            }
                        }
                    }
                } else if subs_specified {
                    // Only keep_subs was specified; keep all audio tracks by default
                    for t in &tracks {
                        let t_type = t
                            .get("type")
                            .or_else(|| t.get("track_type"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if t_type == "audio" {
                            if let Some(id) = t.get("id").and_then(|v| v.as_i64()) {
                                let id_str = id.to_string();
                                if !kept_ids.contains(&id_str) {
                                    kept_ids.push(id_str);
                                }
                            }
                        }
                    }
                }

                if let Some(ref ks) = self.opts.keep_subs {
                    let s_ids = resolve_track_spec_filtered(ks, &tracks, true, Some("subtitles"));
                    if !s_ids.is_empty() && s_ids != "n" {
                        for id in s_ids.split(',') {
                            let id_t = id.trim();
                            if !id_t.is_empty() && !kept_ids.contains(&id_t.to_string()) {
                                kept_ids.push(id_t.to_string());
                            }
                        }
                    }
                } else if audio_specified {
                    // Only keep_audio was specified; keep all subtitle tracks by default
                    for t in &tracks {
                        let t_type = t
                            .get("type")
                            .or_else(|| t.get("track_type"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if t_type == "subtitles" || t_type == "sub" || t_type == "subs" {
                            if let Some(id) = t.get("id").and_then(|v| v.as_i64()) {
                                let id_str = id.to_string();
                                if !kept_ids.contains(&id_str) {
                                    kept_ids.push(id_str);
                                }
                            }
                        }
                    }
                }

                // If keep_tracks was also provided, append any extra tracks
                if let Some(ref kt) = self.opts.keep_tracks {
                    let extra = resolve_track_spec(kt, &tracks, true);
                    if !extra.is_empty() && extra != "n" {
                        for id in extra.split(',') {
                            let id_t = id.trim();
                            if !id_t.is_empty() && !kept_ids.contains(&id_t.to_string()) {
                                kept_ids.push(id_t.to_string());
                            }
                        }
                    }
                }

                if kept_ids.is_empty() {
                    return Some("n".to_string());
                } else {
                    return Some(kept_ids.join(","));
                }
            }

            if let Some(ref kt) = self.opts.keep_tracks {
                return Some(resolve_track_spec(kt, &tracks, true));
            }
        }

        // set_default
        if p_lower.contains("choose the default audio track") {
            if let Some(ref da) = self.opts.default_audio {
                return Some(resolve_track_spec(da, &tracks, false));
            }
        }
        if p_lower.contains("choose the default subtitle track") {
            if let Some(ref ds) = self.opts.default_sub {
                return Some(resolve_track_spec(ds, &tracks, false));
            }
        }
        if p_lower.contains("choose the forced subtitle track") {
            if let Some(ref fs_val) = self.opts.forced_sub {
                return Some(resolve_track_spec(fs_val, &tracks, false));
            }
        }

        // injection booleans
        if p_lower.contains("keep original audio from the target") {
            if let Some(v) = self.opts.keep_target_audio {
                return Some(if v { "y" } else { "n" }.to_string());
            }
        }
        if p_lower.contains("keep original subtitles from the target") {
            if let Some(v) = self.opts.keep_target_subs {
                return Some(if v { "y" } else { "n" }.to_string());
            }
        }
        if p_lower.contains("import audio from the source") {
            if let Some(v) = self.opts.import_audio {
                return Some(if v { "y" } else { "n" }.to_string());
            }
            if self.opts.audio_track.is_some() {
                return Some("y".to_string());
            }
        }
        if p_lower.contains("import subtitles from the source") {
            if let Some(v) = self.opts.import_subs {
                return Some(if v { "y" } else { "n" }.to_string());
            }
            if self.opts.sub_track.is_some() {
                return Some("y".to_string());
            }
        }
        if p_lower.contains("import attachments") {
            if let Some(v) = self.opts.import_attachments {
                return Some(if v { "y" } else { "n" }.to_string());
            }
        }

        // custom_merge
        if p_lower.contains("choose audio tracks from folder a") {
            if let Some(ref v) = self.opts.keep_a_audio {
                return Some(resolve_track_spec(v, &tracks, true));
            }
        }
        if p_lower.contains("choose subtitle tracks from folder a") {
            if let Some(ref v) = self.opts.keep_a_subs {
                return Some(resolve_track_spec(v, &tracks, true));
            }
        }
        if p_lower.contains("choose audio tracks from folder b") {
            if let Some(ref v) = self.opts.keep_b_audio {
                return Some(resolve_track_spec(v, &tracks, true));
            }
        }
        if p_lower.contains("choose subtitle tracks from folder b") {
            if let Some(ref v) = self.opts.keep_b_subs {
                return Some(resolve_track_spec(v, &tracks, true));
            }
        }

        // internal_sync booleans & track selections
        if p_lower.contains("synchronize an audio track?") {
            if let Some(v) = self.opts.sync_audio {
                return Some(if v { "y" } else { "n" }.to_string());
            }
            if self.opts.target_audio_track.is_some() || self.opts.audio_track.is_some() {
                return Some("y".to_string());
            }
        }
        if p_lower.contains("synchronize a subtitle track?") {
            if let Some(v) = self.opts.sync_subs {
                return Some(if v { "y" } else { "n" }.to_string());
            }
            if self.opts.target_sub_track.is_some() || self.opts.sub_track.is_some() {
                return Some("y".to_string());
            }
        }
        if p_lower.contains("select reference audio track") {
            if let Some(ref v) = self.opts.ref_audio_track {
                return Some(resolve_track_spec(v, &tracks, false));
            }
        }
        if p_lower.contains("select target audio track") {
            if let Some(ref v) = self.opts.target_audio_track.as_ref().or(self.opts.audio_track.as_ref()) {
                return Some(resolve_track_spec(v, &tracks, false));
            }
        }
        if p_lower.contains("select target subtitle track") {
            if let Some(ref v) = self.opts.target_sub_track.as_ref().or(self.opts.sub_track.as_ref()) {
                return Some(resolve_track_spec(v, &tracks, false));
            }
        }

        // select_track_interactive ("Choose the track to use in this batch")
        if p_lower.contains("choose the track to use in this batch") {
            let track_type = tracks
                .first()
                .and_then(|t| t.get("type"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if track_type == "audio" {
                if let Some(ref v) = self.opts.audio_track.as_ref().or(self.opts.target_audio_track.as_ref()) {
                    return Some(resolve_track_spec(v, &tracks, false));
                }
            } else if track_type == "subtitles" {
                if let Some(ref v) = self.opts.sub_track.as_ref().or(self.opts.target_sub_track.as_ref()) {
                    return Some(resolve_track_spec(v, &tracks, false));
                }
            }
        }

        // Opus conversion prompt
        if p_lower.contains("to opus") {
            if let Some(ref mode) = self.opts.opus_mode {
                if mode == "always" {
                    return Some("y".to_string());
                } else if mode == "off" {
                    return Some("n".to_string());
                }
            }
        }

        None
    }

    fn default_non_interactive_answer(&self, prompt: &str, payload: &Value) -> String {
        let kind = payload
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("text");
        let allow_empty = payload
            .get("allow_empty")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let tracks = payload
            .get("tracks")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        match kind {
            "confirm" => {
                let p_lower = prompt.to_lowercase();
                if p_lower.contains("to opus") && self.opts.opus_mode.as_deref() != Some("always") {
                    "n".to_string()
                } else {
                    "y".to_string()
                }
            }
            "multiple" => String::new(), // empty means keep all tracks in parse_track_selection
            "single" => {
                if allow_empty {
                    String::new()
                } else if let Some(first_id) = tracks.first().and_then(|t| t.get("id")).and_then(|v| v.as_i64()) {
                    first_id.to_string()
                } else {
                    String::new()
                }
            }
            "sync_preview" => {
                json!({
                    "action": "confirm",
                    "audio_delay_ms": 0,
                    "sub_delay_ms": 0
                })
                .to_string()
            }
            _ => String::new(),
        }
    }
}

impl FrontendBridge for CliBridge {
    fn append_terminal(&self, text: &str) {
        if text.contains("Multiple audio tracks found") {
            *self.last_track_type_seen.lock().unwrap() = Some("audio".to_string());
        } else if text.contains("Multiple subtitles tracks found") {
            *self.last_track_type_seen.lock().unwrap() = Some("subtitles".to_string());
        }
    }

    fn ask_input(&self, payload: &Value, callback_id: &str) -> bool {
        let prompt = payload
            .get("prompt")
            .and_then(|v| v.as_str())
            .unwrap_or("Input required");
        let kind = payload
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("text");
        let context = payload
            .get("context")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let tracks = payload
            .get("tracks")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        if let Some(ans) = self.match_semantic_answer(prompt, payload) {
            eprintln!("[CLI Auto-Input] {} -> '{}'", prompt, if ans.is_empty() { "<default/all>" } else { &ans });
            self.api.resolve_input(callback_id, Some(ans));
            return true;
        }

        if self.opts.yes {
            let ans = self.default_non_interactive_answer(prompt, payload);
            eprintln!("[CLI --yes] {} -> '{}'", prompt, if ans.is_empty() { "<default/all>" } else { &ans });
            self.api.resolve_input(callback_id, Some(ans));
            return true;
        }

        // Interactive terminal prompt via stdin
        if !context.is_empty() {
            eprintln!("\n[{}]", context);
        }
        if !tracks.is_empty() {
            eprintln!("Available tracks:");
            for t in &tracks {
                let id = t.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
                let t_type = t.get("type").and_then(|v| v.as_str()).unwrap_or("track");
                let codec = t.get("codec").and_then(|v| v.as_str()).unwrap_or("Unknown");
                let lang = t
                    .get("properties")
                    .and_then(|p| p.get("language"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("und");
                let name = t
                    .get("properties")
                    .and_then(|p| p.get("track_name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if name.is_empty() {
                    eprintln!("  [ID: {}] {} | {} ({})", id, t_type, lang.to_uppercase(), codec);
                } else {
                    eprintln!(
                        "  [ID: {}] {} | {} ({}) - {}",
                        id,
                        t_type,
                        lang.to_uppercase(),
                        codec,
                        name
                    );
                }
            }
        }

        let hint = match kind {
            "confirm" => "[y/n]",
            "multiple" => "[comma-separated IDs or language codes, Enter=all, n=none, s=skip]",
            "single" => "[track ID or language code, Enter=default]",
            _ => "",
        };
        eprint!("> {} {}: ", prompt, hint);
        let _ = io::stderr().flush();

        let stdin = io::stdin();
        let mut line = String::new();
        match stdin.lock().read_line(&mut line) {
            Ok(0) => {
                // EOF on stdin: fall back to non-interactive default
                let ans = self.default_non_interactive_answer(prompt, payload);
                eprintln!("[EOF -> default '{}']", ans);
                self.api.resolve_input(callback_id, Some(ans));
            }
            Ok(_) => {
                let trimmed = line.trim();
                let is_multiple = kind == "multiple";
                let resolved = if kind == "single" || kind == "multiple" {
                    resolve_track_spec(trimmed, &tracks, is_multiple)
                } else {
                    trimmed.to_string()
                };
                self.api.resolve_input(callback_id, Some(resolved));
            }
            Err(_) => {
                self.api.resolve_input(callback_id, None);
            }
        }
        true
    }

    fn ask_matcher(&self, targets: &[String], sources: &[String], callback_id: &str) -> bool {
        if !self.opts.pairs.is_empty() {
            self.api
                .resolve_matcher(callback_id, self.opts.pairs.clone(), None);
            return true;
        }

        let count = targets.len().min(sources.len());
        let default_pairs: Vec<(String, String)> = (0..count)
            .map(|i| (targets[i].clone(), sources[i].clone()))
            .collect();

        if self.opts.yes || self.opts.auto_match || (targets.len() == 1 && sources.len() == 1) {
            eprintln!("[CLI Matcher] Auto-matched {} pair(s):", default_pairs.len());
            for (idx, (t, s)) in default_pairs.iter().enumerate() {
                let t_name = Path::new(t)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| t.clone());
                let s_name = Path::new(s)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| s.clone());
                eprintln!("  {}. {}  <==  {}", idx + 1, t_name, s_name);
            }
            self.api
                .resolve_matcher(callback_id, default_pairs, Some(sources.to_vec()));
            return true;
        }

        eprintln!("\n--- File Matching ({} target(s), {} source(s)) ---", targets.len(), sources.len());
        for i in 0..count {
            let t_name = Path::new(&targets[i])
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| targets[i].clone());
            let s_name = Path::new(&sources[i])
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| sources[i].clone());
            eprintln!("  [{}] {}  <==  [{}] {}", i + 1, t_name, i + 1, s_name);
        }
        eprint!("> Confirm 1:1 file matching? [Enter/y = confirm, n = cancel, or source indices e.g. 2,1]: ");
        let _ = io::stderr().flush();

        let stdin = io::stdin();
        let mut line = String::new();
        match stdin.lock().read_line(&mut line) {
            Ok(0) => {
                self.api
                    .resolve_matcher(callback_id, default_pairs, Some(sources.to_vec()));
            }
            Ok(_) => {
                let trimmed = line.trim().to_lowercase();
                if trimmed == "n" || trimmed == "q" || trimmed == "cancel" {
                    self.api.resolve_matcher(callback_id, Vec::new(), None);
                } else if trimmed.is_empty() || trimmed == "y" || trimmed == "yes" {
                    self.api
                        .resolve_matcher(callback_id, default_pairs, Some(sources.to_vec()));
                } else {
                    let mut custom_pairs = Vec::new();
                    for (t_idx, part) in trimmed.split(',').enumerate() {
                        if t_idx >= targets.len() {
                            break;
                        }
                        if let Ok(s_idx_1based) = part.trim().parse::<usize>() {
                            if s_idx_1based >= 1 && s_idx_1based <= sources.len() {
                                custom_pairs.push((
                                    targets[t_idx].clone(),
                                    sources[s_idx_1based - 1].clone(),
                                ));
                            }
                        }
                    }
                    self.api.resolve_matcher(callback_id, custom_pairs, None);
                }
            }
            Err(_) => {
                self.api.resolve_matcher(callback_id, Vec::new(), None);
            }
        }
        true
    }

    fn cancel_requests(&self) {}

    fn pick_folder(&self) -> String {
        if self.opts.yes {
            return String::new();
        }
        eprint!("> Enter folder/file path: ");
        let _ = io::stderr().flush();
        let mut line = String::new();
        let _ = io::stdin().lock().read_line(&mut line);
        line.trim().to_string()
    }

    fn pick_file(&self, label: &str, _extensions: &[&str]) -> String {
        if self.opts.yes {
            return String::new();
        }
        eprint!("> Enter path for {}: ", label);
        let _ = io::stderr().flush();
        let mut line = String::new();
        let _ = io::stdin().lock().read_line(&mut line);
        line.trim().to_string()
    }
}

pub fn print_cli_help() {
    println!(
        "syncforge-cli v{version} — Headless CLI & Script Automation Runner for SyncForge

USAGE:
  syncforge-cli <SUBCOMMAND> [OPTIONS]
  syncforge-cli run <MODULE> [OPTIONS]
  syncforge-cli script <FILE.json> [--json]

SUBCOMMANDS:
  run <MODULE>       Execute one of the 7 media processing modules
  script <FILE.json> Execute a single job or multi-step workflow from a JSON script file
  inspect <PATH>     Inspect media container tracks, codecs, flags, or folder summary
  delay <REF> <TGT>  Calculate exact audio delay (ms) between two media files via FFT
  preview            Launch mpv synchronization preview with custom audio/subtitle delays
  tools              Check status and paths of external CLI tools (mkvmerge, ffmpeg, ffsubsync, mpv)
  modules            List all available processing modules and their applicable flags
  config             View or modify persistent SyncForge user configuration
  help               Show this help message
  version            Show version information

MODULES (for `syncforge-cli run <MODULE>`):
  stream_manager     Remove & Filter Tracks (+ optional Opus conversion) [alias: filter]
  set_default        Set Default & Forced Track Flags in-place (mkvpropedit) [alias: flags]
  sync_subs          Sync External Subtitle Files (.srt/.ass) to Video Audio [alias: subs]
  sync_subs_mkv      Extract & Sync Subtitles from another MKV [alias: subs-mkv]
  injection          Waveform Audio Sync & Merge (WaveSync FFT + ffsubsync) [alias: wavesync]
  custom_merge       Direct Track Merge from Two Sources (No Sync) [alias: merge]
  internal_sync      Self-Sync Audio & Subtitles within an existing video [alias: self-sync]

PATH OPTIONS:
  -v, --video, --target <PATH>   Primary/target video file or folder (or Folder A)
  -s, --sub, --source <PATH>     Secondary/source video or subtitle file/folder (or Folder B)
  -o, --output <PATH>            Output folder (defaults to configured output dir or target folder)

PROCESSING SETTINGS:
  --opus <off|always|prompt>     Opus audio conversion mode (or --convert-opus for 'always')
  --opus-bitrate <KBPS>          Opus encoding bitrate in kbps (default: 128)
  --opus-downmix                 Downmix audio to 2.0 stereo when converting to Opus (default)
  --no-opus-downmix              Preserve original channel layout when converting to Opus
  --auto-audio / --no-auto-audio Enable or disable automatic WaveSync FFT audio alignment
  --auto-subs / --no-auto-subs   Enable or disable automatic ffsubsync subtitle alignment
  --max-offset <SECONDS>         Limit ffsubsync maximum offset in seconds
  --notify / --no-notify         Enable or disable desktop notification on completion
  --preview-mpv                  Open interactive mpv preview before muxing

SCRIPTING & NON-INTERACTIVE FLAGS:
  -y, --yes, --non-interactive   Never prompt on stdin; auto-match files 1:1 & use smart defaults
  --auto-match                   Automatically match target and source files 1:1 in sorted order
  --keep-tracks <IDS|LANG|all>   Tracks to keep in `stream_manager` (e.g. `1,2`, `ita,eng`, `a:jpn,s:ita`, `none`)
  --keep-audio <IDS|LANG|all>    Audio tracks to keep in `stream_manager` (e.g. `jpn`, `1,2`, `all`, `none`)
  --keep-subs <IDS|LANG|all>     Subtitle tracks to keep in `stream_manager` (e.g. `ita`, `10`, `all`, `none`)
  --default-audio <ID|LANG|none> Default audio track for `set_default` (e.g. `1` or `ita`)
  --default-sub <ID|LANG|none>   Default subtitle track for `set_default`
  --forced-sub <ID|LANG|none>    Forced subtitle track for `set_default`
  --audio-track <ID|LANG>        Source/target audio track to select (e.g. `1` or `ita`)
  --sub-track <ID|LANG>          Source/target subtitle track to select (e.g. `2` or `ita`)
  --ref-audio-track <ID|LANG>    Reference audio track for `internal_sync`
  --target-audio-track <ID|LANG> Target audio track to align in `internal_sync`
  --target-sub-track <ID|LANG>   Target subtitle track to align in `internal_sync`
  --keep-target-audio            Keep original audio from target in `injection` (--no-keep-target-audio)
  --keep-target-subs             Keep original subtitles from target in `injection` (--no-keep-target-subs)
  --import-audio                 Import audio from source in `injection` (--no-import-audio)
  --import-subs                  Import subtitles from source in `injection` (--no-import-subs)
  --import-attachments           Import font attachments from source in `injection` (--no-import-attachments)
  --keep-a-audio <IDS|LANG|all>  Audio tracks from Folder A in `custom_merge`
  --keep-a-subs <IDS|LANG|all>   Subtitle tracks from Folder A in `custom_merge`
  --keep-b-audio <IDS|LANG|all>  Audio tracks from Folder B in `custom_merge`
  --keep-b-subs <IDS|LANG|all>   Subtitle tracks from Folder B in `custom_merge`
  --sync-audio / --no-sync-audio Enable or disable audio sync in `internal_sync`
  --sync-subs / --no-sync-subs   Enable or disable subtitle sync in `internal_sync`
  --answer <VALUE>               Queue a raw answer for interactive prompts (repeatable)
  --json                         Emit machine-readable JSON output on stdout (logs routed to stderr)

EXAMPLES:
  syncforge-cli run stream_manager -v ./videos -o ./out --keep-tracks ita,eng --opus always -y
  syncforge-cli run set_default -v ./episode.mkv --default-audio ita --default-sub ita -y
  syncforge-cli run sync_subs -v ./video.mkv -s ./subs.srt -o ./out --max-offset 60 -y
  syncforge-cli run injection -v ./bdrip -s ./webdl -o ./muxed --keep-target-audio --import-audio --audio-track ita --import-subs --sub-track ita -y
  syncforge-cli script workflow.json
  syncforge-cli inspect ./movie.mkv --json
  syncforge-cli tools",
        version = VERSION
    );
}

pub fn build_settings_value(opts: &CliRunOptions) -> Value {
    let mut base = load_user_config();
    if !base.is_object() {
        base = json!({});
    }
    let obj = base.as_object_mut().unwrap();

    // Default notify_on_finish to false in CLI unless explicitly enabled
    let notify = opts.notify_on_finish.unwrap_or(false);
    obj.insert("notify_on_finish".to_string(), json!(notify));

    if let Some(ref opus_mode) = opts.opus_mode {
        obj.insert("opus_mode".to_string(), json!(opus_mode));
    }
    if let Some(bitrate) = opts.opus_bitrate {
        obj.insert("opus_bitrate".to_string(), json!(bitrate));
    }
    if let Some(downmix) = opts.opus_downmix {
        obj.insert("opus_downmix".to_string(), json!(downmix));
    }
    if let Some(auto_a) = opts.auto_audio {
        obj.insert("auto_audio".to_string(), json!(auto_a));
    }
    if let Some(auto_s) = opts.auto_subs {
        obj.insert("auto_subs".to_string(), json!(auto_s));
    }
    if let Some(en_off) = opts.enable_max_offset {
        obj.insert("enable_max_offset".to_string(), json!(en_off));
    }
    if let Some(max_off) = opts.max_offset {
        obj.insert("max_offset".to_string(), json!(max_off));
        if opts.enable_max_offset.is_none() {
            obj.insert("enable_max_offset".to_string(), json!(true));
        }
    }
    if let Some(prev) = opts.preview_mpv {
        obj.insert("preview_mpv".to_string(), json!(prev));
    }

    base
}

pub fn execute_cli_run(opts: CliRunOptions) -> (RunResult, i32) {
    let Some(canonical_mod) = normalize_module_id(&opts.module) else {
        let res = RunResult {
            status: "error".to_string(),
            message: Some(format!(
                "Unknown module '{}'. Run `syncforge-cli modules` to see valid module IDs.",
                opts.module
            )),
            output_dir: None,
        };
        return (res, 2);
    };

    let mut normalized_opts = opts;
    normalized_opts.module = canonical_mod.to_string();

    if normalized_opts.json_output {
        set_log_to_stderr(true);
    }

    let settings = build_settings_value(&normalized_opts);
    let paths = PathsInput {
        video: normalized_opts.video.clone(),
        sub: normalized_opts.sub.clone(),
        output: normalized_opts.output.clone(),
    };

    let api = Api::new();
    let bridge = Arc::new(CliBridge::new(api.clone(), normalized_opts.clone()));
    api.set_bridge(Some(bridge));

    let result = api.run_module(canonical_mod, &settings, Some(paths), false);
    let code = match result.status.as_str() {
        "ok" | "warning" => 0,
        "cancelled" => 130,
        _ => 1,
    };
    (result, code)
}

pub fn parse_run_args(module: &str, args: &[String]) -> Result<CliRunOptions, String> {
    let mut opts = CliRunOptions {
        module: module.to_string(),
        ..Default::default()
    };

    let mut i = 0;
    while i < args.len() {
        let arg = args[i].as_str();
        let next_val = |idx: &mut usize, flag: &str| -> Result<String, String> {
            if *idx + 1 >= args.len() {
                return Err(format!("Missing value for option '{}'", flag));
            }
            *idx += 1;
            Ok(args[*idx].clone())
        };

        match arg {
            "-v" | "--video" | "--target" | "--folder-a" => {
                opts.video = next_val(&mut i, arg)?;
            }
            "-s" | "--sub" | "--source" | "--folder-b" => {
                opts.sub = next_val(&mut i, arg)?;
            }
            "-o" | "--output" => {
                opts.output = next_val(&mut i, arg)?;
            }
            "--opus" | "--opus-mode" => {
                let val = next_val(&mut i, arg)?.to_lowercase();
                if !["off", "always", "prompt"].contains(&val.as_str()) {
                    return Err(format!(
                        "Invalid --opus mode '{}'. Expected 'off', 'always', or 'prompt'.",
                        val
                    ));
                }
                opts.opus_mode = Some(val);
            }
            "--convert-opus" => {
                opts.opus_mode = Some("always".to_string());
            }
            "--opus-bitrate" => {
                let val = next_val(&mut i, arg)?;
                let parsed = val
                    .parse::<u32>()
                    .map_err(|_| format!("Invalid --opus-bitrate '{}'", val))?;
                opts.opus_bitrate = Some(parsed);
            }
            "--opus-downmix" => opts.opus_downmix = Some(true),
            "--no-opus-downmix" => opts.opus_downmix = Some(false),
            "--auto-audio" => opts.auto_audio = Some(true),
            "--no-auto-audio" => opts.auto_audio = Some(false),
            "--auto-subs" => opts.auto_subs = Some(true),
            "--no-auto-subs" => opts.auto_subs = Some(false),
            "--max-offset" => {
                let val = next_val(&mut i, arg)?;
                let parsed = val
                    .parse::<i64>()
                    .map_err(|_| format!("Invalid --max-offset '{}'", val))?;
                opts.max_offset = Some(parsed);
                opts.enable_max_offset = Some(true);
            }
            "--no-max-offset" => {
                opts.enable_max_offset = Some(false);
            }
            "--notify" => opts.notify_on_finish = Some(true),
            "--no-notify" => opts.notify_on_finish = Some(false),
            "--preview-mpv" => opts.preview_mpv = Some(true),
            "--no-preview-mpv" => opts.preview_mpv = Some(false),
            "-y" | "--yes" | "--non-interactive" => {
                opts.yes = true;
                opts.auto_match = true;
            }
            "--auto-match" => opts.auto_match = true,
            "--json" => opts.json_output = true,
            "--keep-tracks" => opts.keep_tracks = Some(next_val(&mut i, arg)?),
            "--keep-audio" => opts.keep_audio = Some(next_val(&mut i, arg)?),
            "--keep-subs" | "--keep-sub" => opts.keep_subs = Some(next_val(&mut i, arg)?),
            "--default-audio" => opts.default_audio = Some(next_val(&mut i, arg)?),
            "--default-sub" => opts.default_sub = Some(next_val(&mut i, arg)?),
            "--forced-sub" => opts.forced_sub = Some(next_val(&mut i, arg)?),
            "--audio-track" => opts.audio_track = Some(next_val(&mut i, arg)?),
            "--sub-track" => opts.sub_track = Some(next_val(&mut i, arg)?),
            "--ref-audio-track" => opts.ref_audio_track = Some(next_val(&mut i, arg)?),
            "--target-audio-track" => opts.target_audio_track = Some(next_val(&mut i, arg)?),
            "--target-sub-track" => opts.target_sub_track = Some(next_val(&mut i, arg)?),
            "--keep-target-audio" => opts.keep_target_audio = Some(true),
            "--no-keep-target-audio" => opts.keep_target_audio = Some(false),
            "--keep-target-subs" => opts.keep_target_subs = Some(true),
            "--no-keep-target-subs" => opts.keep_target_subs = Some(false),
            "--import-audio" => opts.import_audio = Some(true),
            "--no-import-audio" => opts.import_audio = Some(false),
            "--import-subs" => opts.import_subs = Some(true),
            "--no-import-subs" => opts.import_subs = Some(false),
            "--import-attachments" => opts.import_attachments = Some(true),
            "--no-import-attachments" => opts.import_attachments = Some(false),
            "--keep-a-audio" => opts.keep_a_audio = Some(next_val(&mut i, arg)?),
            "--keep-a-subs" => opts.keep_a_subs = Some(next_val(&mut i, arg)?),
            "--keep-b-audio" => opts.keep_b_audio = Some(next_val(&mut i, arg)?),
            "--keep-b-subs" => opts.keep_b_subs = Some(next_val(&mut i, arg)?),
            "--sync-audio" => opts.sync_audio = Some(true),
            "--no-sync-audio" => opts.sync_audio = Some(false),
            "--sync-subs" => opts.sync_subs = Some(true),
            "--no-sync-subs" => opts.sync_subs = Some(false),
            "--answer" => opts.answers.push(next_val(&mut i, arg)?),
            "--pair" => {
                let raw = next_val(&mut i, arg)?;
                if let Some((t, s)) = raw.split_once('=') {
                    opts.pairs.push((t.trim().to_string(), s.trim().to_string()));
                } else {
                    return Err(format!(
                        "Invalid --pair '{}'. Expected TARGET=SOURCE format.",
                        raw
                    ));
                }
            }
            _ => {
                return Err(format!(
                    "Unrecognized option '{}'. Run `syncforge-cli --help` for usage.",
                    arg
                ));
            }
        }
        i += 1;
    }

    Ok(opts)
}

pub fn parse_script_jobs(content: &str) -> Result<Vec<CliRunOptions>, String> {
    let val: Value = serde_json::from_str(content)
        .map_err(|e| format!("Invalid JSON in script file: {}", e))?;

    if val.is_array() {
        serde_json::from_value::<Vec<CliRunOptions>>(val)
            .map_err(|e| format!("Invalid job list in script file: {}", e))
    } else if let Some(jobs_val) = val.get("jobs") {
        serde_json::from_value::<Vec<CliRunOptions>>(jobs_val.clone())
            .map_err(|e| format!("Invalid 'jobs' array in script file: {}", e))
    } else {
        let single: CliRunOptions = serde_json::from_value(val)
            .map_err(|e| format!("Invalid job object in script file: {}", e))?;
        Ok(vec![single])
    }
}

pub fn run_cli_args(args: &[String]) -> i32 {
    setup_environment();

    if args.is_empty() {
        print_cli_help();
        return 0;
    }

    let subcmd = args[0].as_str();
    match subcmd {
        "-h" | "--help" | "help" => {
            print_cli_help();
            0
        }
        "-V" | "--version" | "version" => {
            println!("syncforge-cli {}", VERSION);
            0
        }
        "modules" => {
            let json_out = args[1..].iter().any(|a| a == "--json");
            let modules_info = json!([
                {
                    "id": "stream_manager",
                    "aliases": ["filter", "remove-tracks"],
                    "title": "Remove & Filter Tracks",
                    "needs": ["video", "output"],
                    "flags": ["--keep-tracks", "--keep-audio", "--keep-subs", "--opus", "--opus-bitrate", "--opus-downmix"]
                },
                {
                    "id": "set_default",
                    "aliases": ["flags", "default-flags"],
                    "title": "Set Default & Forced Flags",
                    "needs": ["video"],
                    "flags": ["--default-audio", "--default-sub", "--forced-sub"]
                },
                {
                    "id": "sync_subs",
                    "aliases": ["subs"],
                    "title": "Sync Subtitle Files to Audio",
                    "needs": ["video", "sub", "output"],
                    "flags": ["--auto-subs", "--max-offset"]
                },
                {
                    "id": "sync_subs_mkv",
                    "aliases": ["subs-mkv"],
                    "title": "Extract & Sync Subs from MKV",
                    "needs": ["video", "sub", "output"],
                    "flags": ["--sub-track", "--auto-subs", "--max-offset"]
                },
                {
                    "id": "injection",
                    "aliases": ["wavesync", "inject"],
                    "title": "Waveform Audio Sync & Merge",
                    "needs": ["video", "sub", "output"],
                    "flags": [
                        "--keep-target-audio",
                        "--keep-target-subs",
                        "--import-audio",
                        "--audio-track",
                        "--import-subs",
                        "--sub-track",
                        "--import-attachments",
                        "--auto-audio",
                        "--auto-subs",
                        "--max-offset",
                        "--opus"
                    ]
                },
                {
                    "id": "custom_merge",
                    "aliases": ["merge"],
                    "title": "Direct Track Merge (No Sync)",
                    "needs": ["video", "sub", "output"],
                    "flags": ["--keep-a-audio", "--keep-a-subs", "--keep-b-audio", "--keep-b-subs", "--opus"]
                },
                {
                    "id": "internal_sync",
                    "aliases": ["self-sync"],
                    "title": "Self-Sync Audio & Subtitles",
                    "needs": ["video", "output"],
                    "flags": [
                        "--sync-audio",
                        "--sync-subs",
                        "--ref-audio-track",
                        "--target-audio-track",
                        "--target-sub-track",
                        "--auto-audio",
                        "--auto-subs",
                        "--max-offset",
                        "--opus"
                    ]
                }
            ]);
            if json_out {
                println!("{}", serde_json::to_string_pretty(&modules_info).unwrap());
            } else {
                println!("Available SyncForge Modules:\n");
                if let Some(arr) = modules_info.as_array() {
                    for m in arr {
                        let id = m["id"].as_str().unwrap_or("");
                        let title = m["title"].as_str().unwrap_or("");
                        let flags: Vec<&str> = m["flags"]
                            .as_array()
                            .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
                            .unwrap_or_default();
                        println!("  {:16}  {}", id, title);
                        println!("                    Flags: {}\n", flags.join(", "));
                    }
                }
            }
            0
        }
        "tools" => {
            let json_out = args[1..].iter().any(|a| a == "--json");
            let tools = check_all_tools();
            if json_out {
                println!("{}", serde_json::to_string_pretty(&tools).unwrap());
            } else {
                println!("External CLI Tools Status:\n");
                let order = ["mkvmerge", "mkvextract", "mkvpropedit", "ffmpeg", "ffsubsync", "mpv"];
                for name in order {
                    if let Some(st) = tools.get(name) {
                        let badge = if st.found { "[OK]" } else { "[MISSING]" };
                        let path_str = st.path.as_deref().unwrap_or("Not found in PATH or portable dir");
                        println!("  {:10} {:14} {}", badge, name, path_str);
                    }
                }
            }
            0
        }
        "inspect" => {
            let mut target_path = String::new();
            let mut json_out = false;
            for a in &args[1..] {
                if a == "--json" {
                    json_out = true;
                } else if target_path.is_empty() {
                    target_path = a.clone();
                }
            }
            if target_path.is_empty() {
                eprintln!("Error: Missing path. Usage: syncforge-cli inspect <PATH> [--json]");
                return 2;
            }
            let api = Api::new();
            match api.inspect_media(&target_path) {
                Ok(val) => {
                    if val.is_null() {
                        eprintln!("Error: Path does not exist or cannot be inspected: {}", target_path);
                        return 1;
                    }
                    if json_out {
                        println!("{}", serde_json::to_string_pretty(&val).unwrap());
                    } else {
                        let kind = val.get("kind").and_then(|v| v.as_str()).unwrap_or("file");
                        let name = val.get("name").and_then(|v| v.as_str()).unwrap_or(&target_path);
                        println!("Media Inspection: {} ({})", name, kind);
                        if kind == "folder" {
                            println!(
                                "  Videos: {} | Subtitles: {}",
                                val.get("video_count").and_then(|v| v.as_u64()).unwrap_or(0),
                                val.get("sub_count").and_then(|v| v.as_u64()).unwrap_or(0)
                            );
                        } else {
                            println!(
                                "  Container: {} | Size: {} bytes | Attachments: {}",
                                val.get("container").and_then(|v| v.as_str()).unwrap_or("Unknown"),
                                val.get("size_bytes").and_then(|v| v.as_u64()).unwrap_or(0),
                                val.get("has_attachments").and_then(|v| v.as_bool()).unwrap_or(false)
                            );
                        }
                        if let Some(tracks) = val.get("tracks").and_then(|v| v.as_array()) {
                            println!("  Tracks ({}):", tracks.len());
                            for t in tracks {
                                let id = t.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
                                let t_type = t.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                let codec = t.get("codec").and_then(|v| v.as_str()).unwrap_or("Unknown");
                                let props = t.get("properties");
                                let lang = props
                                    .and_then(|p| p.get("language"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("und");
                                let t_name = props
                                    .and_then(|p| p.get("track_name"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                let def = props
                                    .and_then(|p| p.get("default_track"))
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false);
                                let forced = props
                                    .and_then(|p| p.get("forced_track"))
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false);
                                println!(
                                    "    [ID: {:2}] {:10} | {:4} | {:14} | Default: {:5} | Forced: {:5} | {}",
                                    id,
                                    t_type,
                                    lang.to_uppercase(),
                                    codec,
                                    def,
                                    forced,
                                    t_name
                                );
                            }
                        }
                    }
                    0
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                    1
                }
            }
        }
        "delay" => {
            let mut ref_path = String::new();
            let mut tgt_path = String::new();
            let mut start_time = "00:05:00".to_string();
            let mut duration = "00:02:00".to_string();
            let mut json_out = false;

            let mut i = 1;
            while i < args.len() {
                match args[i].as_str() {
                    "--json" => json_out = true,
                    "--start" => {
                        if i + 1 < args.len() {
                            i += 1;
                            start_time = args[i].clone();
                        }
                    }
                    "--duration" => {
                        if i + 1 < args.len() {
                            i += 1;
                            duration = args[i].clone();
                        }
                    }
                    other => {
                        if ref_path.is_empty() {
                            ref_path = other.to_string();
                        } else if tgt_path.is_empty() {
                            tgt_path = other.to_string();
                        }
                    }
                }
                i += 1;
            }

            if ref_path.is_empty() || tgt_path.is_empty() {
                eprintln!("Error: Usage: syncforge-cli delay <REFERENCE_MEDIA> <TARGET_MEDIA> [--start 00:05:00] [--duration 00:02:00] [--json]");
                return 2;
            }
            if json_out {
                set_log_to_stderr(true);
            }

            let Ok(temp_dir) = Builder::new().prefix("syncforge_delay_").tempdir() else {
                eprintln!("Error: Could not create temporary directory.");
                return 1;
            };
            let wav_ref = temp_dir.path().join("ref.wav").to_string_lossy().to_string();
            let wav_tgt = temp_dir.path().join("tgt.wav").to_string_lossy().to_string();

            if let Err(e) = extract_audio_segment(&ref_path, &wav_ref, &start_time, &duration) {
                eprintln!("Error extracting reference audio: {}", e);
                return 1;
            }
            if let Err(e) = extract_audio_segment(&tgt_path, &wav_tgt, &start_time, &duration) {
                eprintln!("Error extracting target audio: {}", e);
                return 1;
            }
            match find_audio_delay(&wav_ref, &wav_tgt) {
                Ok(delay_ms) => {
                    if json_out {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&json!({
                                "status": "ok",
                                "delay_ms": delay_ms,
                                "reference": ref_path,
                                "target": tgt_path,
                                "start": start_time,
                                "duration": duration
                            }))
                            .unwrap()
                        );
                    } else {
                        println!("Calculated Audio Delay: {:+} ms", delay_ms);
                    }
                    0
                }
                Err(e) => {
                    eprintln!("Error calculating waveform delay: {}", e);
                    1
                }
            }
        }
        "preview" => {
            let mut target = String::new();
            let mut audio_file: Option<String> = None;
            let mut audio_delay: Option<i64> = None;
            let mut sub_file: Option<String> = None;
            let mut sub_delay: Option<i64> = None;
            let mut start_time: Option<String> = None;
            let mut json_out = false;

            let mut i = 1;
            while i < args.len() {
                match args[i].as_str() {
                    "-v" | "--video" | "--target" => {
                        if i + 1 < args.len() {
                            i += 1;
                            target = args[i].clone();
                        }
                    }
                    "--audio" | "--audio-file" => {
                        if i + 1 < args.len() {
                            i += 1;
                            audio_file = Some(args[i].clone());
                        }
                    }
                    "--audio-delay" => {
                        if i + 1 < args.len() {
                            i += 1;
                            audio_delay = args[i].parse().ok();
                        }
                    }
                    "-s" | "--sub" | "--sub-file" => {
                        if i + 1 < args.len() {
                            i += 1;
                            sub_file = Some(args[i].clone());
                        }
                    }
                    "--sub-delay" => {
                        if i + 1 < args.len() {
                            i += 1;
                            sub_delay = args[i].parse().ok();
                        }
                    }
                    "--start" => {
                        if i + 1 < args.len() {
                            i += 1;
                            start_time = Some(args[i].clone());
                        }
                    }
                    "--json" => json_out = true,
                    other => {
                        if target.is_empty() && !other.starts_with('-') {
                            target = other.to_string();
                        }
                    }
                }
                i += 1;
            }
            if target.is_empty() {
                eprintln!("Error: Usage: syncforge-cli preview --target <VIDEO> [--audio <FILE>] [--audio-delay <MS>] [--sub <FILE>] [--sub-delay <MS>] [--start <HH:MM:SS>]");
                return 2;
            }
            match preview_sync_mpv(
                &target,
                audio_file.as_deref(),
                audio_delay,
                sub_file.as_deref(),
                sub_delay,
                start_time.as_deref(),
            ) {
                Ok(cmd) => {
                    if json_out {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&json!({ "status": "ok", "cmd": cmd }))
                                .unwrap()
                        );
                    } else {
                        println!("Launched mpv preview: {}", cmd.join(" "));
                    }
                    0
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                    1
                }
            }
        }
        "config" => {
            let action = args.get(1).map(|s| s.as_str()).unwrap_or("show");
            match action {
                "path" => {
                    if let Some(p) = get_config_path() {
                        println!("{}", p.to_string_lossy());
                        0
                    } else {
                        eprintln!("Error: Could not resolve config path.");
                        1
                    }
                }
                "reset" => {
                    if let Err(e) = save_user_config(&json!({})) {
                        eprintln!("Error resetting config: {}", e);
                        1
                    } else {
                        println!("Configuration reset to defaults.");
                        0
                    }
                }
                "set" => {
                    if args.len() < 4 {
                        eprintln!("Error: Usage: syncforge-cli config set <KEY> <VALUE>");
                        return 2;
                    }
                    let key = &args[2];
                    let raw_val = &args[3];
                    let mut cfg = load_user_config();
                    if !cfg.is_object() {
                        cfg = json!({});
                    }
                    let parsed_val: Value = if raw_val == "true" {
                        json!(true)
                    } else if raw_val == "false" {
                        json!(false)
                    } else if let Ok(n) = raw_val.parse::<i64>() {
                        json!(n)
                    } else {
                        json!(raw_val)
                    };
                    cfg.as_object_mut()
                        .unwrap()
                        .insert(key.clone(), parsed_val);
                    if let Err(e) = save_user_config(&cfg) {
                        eprintln!("Error saving config: {}", e);
                        1
                    } else {
                        println!("Updated {} in user configuration.", key);
                        0
                    }
                }
                _ => {
                    let cfg = load_user_config();
                    println!("{}", serde_json::to_string_pretty(&cfg).unwrap());
                    0
                }
            }
        }
        "script" => {
            let mut script_path = String::new();
            let mut json_out = false;
            for a in &args[1..] {
                if a == "--json" {
                    json_out = true;
                } else if script_path.is_empty() {
                    script_path = a.clone();
                }
            }
            if script_path.is_empty() {
                eprintln!("Error: Missing script file. Usage: syncforge-cli script <FILE.json> [--json]");
                return 2;
            }
            let content = match fs::read_to_string(&script_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Error reading script file '{}': {}", script_path, e);
                    return 1;
                }
            };
            let jobs = match parse_script_jobs(&content) {
                Ok(j) => j,
                Err(e) => {
                    eprintln!("Error: {}", e);
                    return 2;
                }
            };
            let mut results = Vec::new();
            let mut overall_code = 0;
            for mut job in jobs {
                if json_out {
                    job.json_output = true;
                }
                let (res, code) = execute_cli_run(job);
                if code != 0 && overall_code == 0 {
                    overall_code = code;
                }
                results.push(res);
                if code != 0 {
                    break;
                }
            }
            if json_out {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&json!({
                        "status": if overall_code == 0 { "ok" } else { "error" },
                        "results": results
                    }))
                    .unwrap()
                );
            }
            overall_code
        }
        "run" => {
            if args.len() < 2 {
                eprintln!("Error: Missing module name. Usage: syncforge-cli run <MODULE> [OPTIONS]");
                return 2;
            }
            let module = &args[1];
            if module == "-h" || module == "--help" {
                print_cli_help();
                return 0;
            }
            match parse_run_args(module, &args[2..]) {
                Ok(opts) => {
                    let json_out = opts.json_output;
                    let (res, code) = execute_cli_run(opts);
                    if json_out {
                        println!("{}", serde_json::to_string_pretty(&res).unwrap());
                    }
                    code
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                    2
                }
            }
        }
        other => {
            // Allow shorthand `syncforge-cli <MODULE> [OPTIONS]`
            if normalize_module_id(other).is_some() {
                match parse_run_args(other, &args[1..]) {
                    Ok(opts) => {
                        let json_out = opts.json_output;
                        let (res, code) = execute_cli_run(opts);
                        if json_out {
                            println!("{}", serde_json::to_string_pretty(&res).unwrap());
                        }
                        code
                    }
                    Err(e) => {
                        eprintln!("Error: {}", e);
                        2
                    }
                }
            } else {
                eprintln!(
                    "Error: Unknown subcommand or module '{}'. Run `syncforge-cli --help` for usage.",
                    other
                );
                2
            }
        }
    }
}

pub fn run_from_env() -> i32 {
    let args: Vec<String> = std::env::args().skip(1).collect();
    run_cli_args(&args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_module_id_aliases() {
        assert_eq!(normalize_module_id("stream_manager"), Some("stream_manager"));
        assert_eq!(normalize_module_id("filter"), Some("stream_manager"));
        assert_eq!(normalize_module_id("set-default"), Some("set_default"));
        assert_eq!(normalize_module_id("flags"), Some("set_default"));
        assert_eq!(normalize_module_id("wavesync"), Some("injection"));
        assert_eq!(normalize_module_id("self-sync"), Some("internal_sync"));
        assert_eq!(normalize_module_id("merge"), Some("custom_merge"));
        assert_eq!(normalize_module_id("invalid_mod"), None);
    }

    #[test]
    fn test_resolve_track_spec_by_id_and_language() {
        let tracks = vec![
            json!({
                "id": 1,
                "type": "audio",
                "codec": "AAC",
                "properties": { "language": "jpn", "track_name": "Japanese" }
            }),
            json!({
                "id": 2,
                "type": "audio",
                "codec": "AC-3",
                "properties": { "language": "ita", "track_name": "Italiano" }
            }),
            json!({
                "id": 3,
                "type": "subtitles",
                "codec": "SubRip/SRT",
                "properties": { "language": "eng", "track_name": "English Signs" }
            }),
            json!({
                "id": 4,
                "type": "subtitles",
                "codec": "SubStationAlpha",
                "properties": { "language": "jpn", "track_name": "Japanese (SDH)" }
            }),
            json!({
                "id": 5,
                "type": "subtitles",
                "codec": "SubStationAlpha",
                "properties": { "language": "ita", "track_name": "Italian" }
            }),
        ];

        assert_eq!(resolve_track_spec("ita", &tracks, false), "2");
        assert_eq!(resolve_track_spec("jpn,ita", &tracks, true), "1,4,2,5");
        assert_eq!(resolve_track_spec("all", &tracks, true), "");
        assert_eq!(resolve_track_spec("none", &tracks, true), "n");
        assert_eq!(resolve_track_spec("none", &tracks, false), "");
        assert_eq!(resolve_track_spec("1,3", &tracks, true), "1,3");

        // Filtered by audio/subtitles
        assert_eq!(resolve_track_spec_filtered("jpn", &tracks, true, Some("audio")), "1");
        assert_eq!(resolve_track_spec_filtered("jpn", &tracks, true, Some("subtitles")), "4");
        assert_eq!(resolve_track_spec_filtered("ita", &tracks, true, Some("audio")), "2");
        assert_eq!(resolve_track_spec_filtered("ita", &tracks, true, Some("subtitles")), "5");
        assert_eq!(resolve_track_spec_filtered("all", &tracks, true, Some("audio")), "1,2");
        assert_eq!(resolve_track_spec_filtered("all", &tracks, true, Some("subtitles")), "3,4,5");

        // Inline type prefix support
        assert_eq!(resolve_track_spec("a:jpn,s:ita", &tracks, true), "1,5");
        assert_eq!(resolve_track_spec("audio:ita,subs:jpn", &tracks, true), "2,4");
    }

    #[test]
    fn test_parse_run_args_keep_audio_and_subs() {
        let args = vec![
            "-v".to_string(),
            "./video.mkv".to_string(),
            "-o".to_string(),
            "./out".to_string(),
            "--keep-audio".to_string(),
            "jpn".to_string(),
            "--keep-subs".to_string(),
            "ita".to_string(),
            "-y".to_string(),
        ];
        let parsed = parse_run_args("stream_manager", &args).unwrap();
        assert_eq!(parsed.keep_audio.as_deref(), Some("jpn"));
        assert_eq!(parsed.keep_subs.as_deref(), Some("ita"));
        assert!(parsed.yes);
    }

    #[test]
    fn test_match_semantic_answer_keep_audio_and_subs() {
        let tracks = vec![
            json!({
                "id": 1,
                "type": "audio",
                "codec": "AAC",
                "properties": { "language": "jpn", "track_name": "Japanese" }
            }),
            json!({
                "id": 2,
                "type": "audio",
                "codec": "AC-3",
                "properties": { "language": "ita", "track_name": "Italiano" }
            }),
            json!({
                "id": 3,
                "type": "subtitles",
                "codec": "SubStationAlpha",
                "properties": { "language": "jpn", "track_name": "Japanese (SDH)" }
            }),
            json!({
                "id": 4,
                "type": "subtitles",
                "codec": "SubStationAlpha",
                "properties": { "language": "ita", "track_name": "Italian" }
            }),
        ];

        let payload = json!({
            "kind": "multiple",
            "tracks": tracks
        });

        // Case A: keep_audio jpn, keep_subs ita -> 1,4 (ignores jpn subtitle 3 and ita audio 2)
        let mut opts = CliRunOptions::default();
        opts.keep_audio = Some("jpn".to_string());
        opts.keep_subs = Some("ita".to_string());
        let bridge = CliBridge::new(Api::new(), opts);
        let ans = bridge.match_semantic_answer("Choose the audio and subtitle tracks to keep", &payload);
        assert_eq!(ans.as_deref(), Some("1,4"));

        // Case B: keep_audio jpn, keep_subs none -> 1
        let mut opts = CliRunOptions::default();
        opts.keep_audio = Some("jpn".to_string());
        opts.keep_subs = Some("none".to_string());
        let bridge = CliBridge::new(Api::new(), opts);
        let ans = bridge.match_semantic_answer("Choose the audio and subtitle tracks to keep", &payload);
        assert_eq!(ans.as_deref(), Some("1"));

        // Case C: keep_audio none, keep_subs ita -> 4
        let mut opts = CliRunOptions::default();
        opts.keep_audio = Some("none".to_string());
        opts.keep_subs = Some("ita".to_string());
        let bridge = CliBridge::new(Api::new(), opts);
        let ans = bridge.match_semantic_answer("Choose the audio and subtitle tracks to keep", &payload);
        assert_eq!(ans.as_deref(), Some("4"));

        // Case D: keep_audio jpn only -> audio 1, plus all subs (3, 4)
        let mut opts = CliRunOptions::default();
        opts.keep_audio = Some("jpn".to_string());
        let bridge = CliBridge::new(Api::new(), opts);
        let ans = bridge.match_semantic_answer("Choose the audio and subtitle tracks to keep", &payload);
        assert_eq!(ans.as_deref(), Some("1,3,4"));
    }

    #[test]
    fn test_parse_run_args_comprehensive() {
        let args = vec![
            "-v".to_string(),
            "/media/video".to_string(),
            "-s".to_string(),
            "/media/source".to_string(),
            "-o".to_string(),
            "/media/out".to_string(),
            "--opus".to_string(),
            "always".to_string(),
            "--opus-bitrate".to_string(),
            "192".to_string(),
            "--no-opus-downmix".to_string(),
            "--max-offset".to_string(),
            "45".to_string(),
            "--keep-target-audio".to_string(),
            "--import-audio".to_string(),
            "--audio-track".to_string(),
            "ita".to_string(),
            "-y".to_string(),
            "--json".to_string(),
        ];

        let parsed = parse_run_args("injection", &args).unwrap();
        assert_eq!(parsed.module, "injection");
        assert_eq!(parsed.video, "/media/video");
        assert_eq!(parsed.sub, "/media/source");
        assert_eq!(parsed.output, "/media/out");
        assert_eq!(parsed.opus_mode.as_deref(), Some("always"));
        assert_eq!(parsed.opus_bitrate, Some(192));
        assert_eq!(parsed.opus_downmix, Some(false));
        assert_eq!(parsed.max_offset, Some(45));
        assert_eq!(parsed.enable_max_offset, Some(true));
        assert_eq!(parsed.keep_target_audio, Some(true));
        assert_eq!(parsed.import_audio, Some(true));
        assert_eq!(parsed.audio_track.as_deref(), Some("ita"));
        assert!(parsed.yes);
        assert!(parsed.auto_match);
        assert!(parsed.json_output);
    }

    #[test]
    fn test_parse_script_jobs_single_and_multi() {
        let single_json = r#"{
            "module": "stream_manager",
            "video": "./in",
            "output": "./out",
            "keep_tracks": "1,2",
            "yes": true
        }"#;
        let single_jobs = parse_script_jobs(single_json).unwrap();
        assert_eq!(single_jobs.len(), 1);
        assert_eq!(single_jobs[0].module, "stream_manager");
        assert_eq!(single_jobs[0].keep_tracks.as_deref(), Some("1,2"));

        let multi_json = r#"{
            "jobs": [
                { "module": "set_default", "video": "./ep1.mkv", "default_audio": "ita", "yes": true },
                { "module": "sync_subs", "video": "./ep1.mkv", "sub": "./ep1.srt", "yes": true }
            ]
        }"#;
        let multi_jobs = parse_script_jobs(multi_json).unwrap();
        assert_eq!(multi_jobs.len(), 2);
        assert_eq!(multi_jobs[0].module, "set_default");
        assert_eq!(multi_jobs[1].module, "sync_subs");
    }
}
