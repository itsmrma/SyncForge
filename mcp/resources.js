import { VERSION } from './version.js';
import { getSystemHealth } from './media.js';
import { getConfigFilePath, getSavedOpenSubtitlesConfig } from './opensubtitles.js';

export const MODULES_INFO = [
  {
    id: 'stream_manager',
    title: 'Remove & Filter Tracks',
    description: 'Remove unwanted audio or subtitle tracks from one video or a batch. Remux losslessly or optionally convert audio to Opus.',
    inputs: ['video (file or folder)', 'output (folder)'],
    applicable_settings: ['opus_mode', 'opus_bitrate', 'opus_downmix', 'notify_on_finish'],
  },
  {
    id: 'set_default',
    title: 'Set Default & Forced Flags',
    description: 'Modify Default and Forced track metadata flags in MKV files directly without remuxing.',
    inputs: ['video (file or folder)'],
    applicable_settings: ['notify_on_finish'],
  },
  {
    id: 'sync_subs',
    title: 'Sync Subtitle Files to Audio',
    description: 'Automatically align external subtitle files (.srt, .ass) to video speech/audio with FFsubsync.',
    inputs: ['video (file or folder)', 'sub (file or folder)', 'output (folder)'],
    applicable_settings: ['auto_subs', 'enable_max_offset', 'max_offset', 'notify_on_finish'],
  },
  {
    id: 'sync_subs_mkv',
    title: 'Extract & Sync Subs from MKV',
    description: 'Extract subtitles from a Source MKV and realign them to the audio of a Target MKV.',
    inputs: ['target video (file or folder)', 'source video (file or folder)', 'output (folder)'],
    applicable_settings: ['auto_subs', 'enable_max_offset', 'max_offset', 'notify_on_finish'],
  },
  {
    id: 'injection',
    title: 'Waveform Audio Sync & Merge',
    description: 'Calculate audio waveform delay between source and target videos, synchronize tracks, and merge them losslessly.',
    inputs: ['target file or folder', 'source file or folder', 'output (folder)'],
    applicable_settings: ['auto_audio', 'auto_subs', 'enable_max_offset', 'max_offset', 'opus_mode', 'opus_bitrate', 'opus_downmix', 'notify_on_finish'],
  },
  {
    id: 'custom_merge',
    title: 'Direct Track Merge (No Sync)',
    description: 'Combine selected tracks from two videos or batches without re-syncing (direct lossless remux).',
    inputs: ['file or folder A', 'file or folder B', 'output (folder)'],
    applicable_settings: ['opus_mode', 'opus_bitrate', 'opus_downmix', 'notify_on_finish'],
  },
  {
    id: 'internal_sync',
    title: 'Self-Sync Audio & Subtitles',
    description: 'Synchronize audio tracks, subtitle tracks, or both within an existing video against reference audio/speech without external files.',
    inputs: ['video (file or folder)', 'output (folder)'],
    applicable_settings: ['auto_audio', 'auto_subs', 'enable_max_offset', 'max_offset', 'opus_mode', 'opus_bitrate', 'opus_downmix', 'notify_on_finish'],
  },
];

export async function getResource(uri) {
  if (uri === 'syncforge://modules') {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(MODULES_INFO, null, 2),
    };
  }

  if (uri === 'syncforge://status') {
    const health = await getSystemHealth();
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(health, null, 2),
    };
  }

  if (uri === 'syncforge://config') {
    const health = await getSystemHealth();
    const configPath = getConfigFilePath();
    const subConfig = getSavedOpenSubtitlesConfig();
    const config = {
      version: VERSION,
      config_file_path: configPath,
      opensubtitles: {
        configured: Boolean(subConfig.apiKey),
        key_preview: subConfig.apiKey
          ? `${subConfig.apiKey.slice(0, 4)}...${subConfig.apiKey.slice(-4)}`
          : null,
        has_token: Boolean(subConfig.userToken),
      },
      default_settings: {
        max_offset: 60,
        enable_max_offset: false,
        auto_audio: true,
        auto_subs: true,
        opus_mode: 'off',
        opus_bitrate: 128,
        opus_downmix: true,
        notify_on_finish: true,
      },
      available_tools: health.tools,
    };
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(config, null, 2),
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}

export const RESOURCES_LIST = [
  {
    uri: 'syncforge://modules',
    name: 'SyncForge Processing Modules Matrix',
    description: 'Machine-readable specifications for all 6 SyncForge media synchronization and processing modes.',
    mimeType: 'application/json',
  },
  {
    uri: 'syncforge://config',
    name: 'SyncForge Configuration & Defaults',
    description: 'Current global default configurations and media tool paths.',
    mimeType: 'application/json',
  },
  {
    uri: 'syncforge://status',
    name: 'SyncForge System Status & Tool Discovery',
    description: 'Detection status and paths for mkvmerge, mkvextract, mkvpropedit, ffmpeg, ffsubsync, and mpv.',
    mimeType: 'application/json',
  },
];
