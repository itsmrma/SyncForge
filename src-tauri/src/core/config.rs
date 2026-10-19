use std::sync::RwLock;

pub const VIDEO_EXT: &[&str] = &[".mkv", ".mp4", ".avi", ".mov", ".flv", ".webm"];
pub const SUB_EXT: &[&str] = &[".srt", ".ass", ".vtt", ".ssa"];
pub const MAX_AUDIO_DELAY_MS: i64 = 3000;

#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub max_offset_seconds: i64,
    pub enable_max_offset: bool,
    pub auto_sync_audio: bool,
    pub auto_sync_subs: bool,
    pub opus_mode: String,
    pub opus_bitrate: u32,
    pub opus_downmix: bool,
    pub default_output_dir: Option<String>,
    pub preview_mpv: bool,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            max_offset_seconds: 1,
            enable_max_offset: false,
            auto_sync_audio: true,
            auto_sync_subs: true,
            opus_mode: "off".to_string(),
            opus_bitrate: 128,
            opus_downmix: true,
            default_output_dir: None,
            preview_mpv: false,
        }
    }
}

static CONFIG: RwLock<RuntimeConfig> = RwLock::new(RuntimeConfig {
    max_offset_seconds: 1,
    enable_max_offset: false,
    auto_sync_audio: true,
    auto_sync_subs: true,
    opus_mode: String::new(),
    opus_bitrate: 128,
    opus_downmix: true,
    default_output_dir: None,
    preview_mpv: false,
});

pub fn get_config() -> RuntimeConfig {
    CONFIG.read().unwrap().clone()
}

pub fn set_config(cfg: RuntimeConfig) {
    *CONFIG.write().unwrap() = cfg;
}

pub fn get_config_path() -> Option<std::path::PathBuf> {
    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = std::path::PathBuf::from(appdata).join("syncforge").join("config.json");
            return Some(p);
        }
    }
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        return Some(std::path::PathBuf::from(home).join(".config").join("syncforge").join("config.json"));
    }
    None
}

pub fn load_user_config() -> serde_json::Value {
    let Some(path) = get_config_path() else {
        return serde_json::json!({});
    };
    if !path.exists() {
        return serde_json::json!({});
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    }
}

pub fn save_user_config(val: &serde_json::Value) -> Result<(), String> {
    let Some(path) = get_config_path() else {
        return Err("Unable to determine user config directory.".to_string());
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let formatted = serde_json::to_string_pretty(val).map_err(|e| e.to_string())?;
    std::fs::write(&path, formatted).map_err(|e| e.to_string())?;
    Ok(())
}
