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
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            max_offset_seconds: 1,
            enable_max_offset: false,
            auto_sync_audio: true,
            auto_sync_subs: true,
        }
    }
}

static CONFIG: RwLock<RuntimeConfig> = RwLock::new(RuntimeConfig {
    max_offset_seconds: 1,
    enable_max_offset: false,
    auto_sync_audio: true,
    auto_sync_subs: true,
});

pub fn get_config() -> RuntimeConfig {
    CONFIG.read().unwrap().clone()
}

pub fn set_config(cfg: RuntimeConfig) {
    *CONFIG.write().unwrap() = cfg;
}
