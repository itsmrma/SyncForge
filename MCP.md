# 🤖 SyncForge MCP Server — Model Context Protocol for AI Agents

SyncForge includes a **Model Context Protocol (MCP)** server that exposes media inspection, waveform audio delay calculation, subtitle synchronization, stream filtering, and lossless remuxing capabilities to AI agents.

This allows agents in **Claude Desktop**, **Claude Code**, **Cursor**, **Antigravity**, **Cline**, **Roo Code**, **Windsurf**, and **Goose** to autonomously inspect, synchronize, and process media files using SyncForge's engine.

---

## 🚀 Quick Start

### 1. Requirements
Ensure Node.js (v18+) is installed. Install MCP dependencies:
```bash
cd mcp && npm install && cd ..
```

### 2. Verify with Integration Tests
```bash
npm run mcp:test
```

### 3. Run MCP Server
```bash
npm run mcp
# or: node mcp/index.js
```

---

## ⚙️ Client Configuration Examples

### 1. Claude Desktop
Add to your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "syncforge": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/SyncForge/mcp/index.js"
      ]
    }
  }
}
```

### 2. Cursor (`.cursor/mcp.json` or Global Settings)
```json
{
  "mcpServers": {
    "syncforge": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/SyncForge/mcp/index.js"
      ]
    }
  }
}
```

### 3. Claude Code CLI
```bash
claude mcp add syncforge node /ABSOLUTE/PATH/TO/SyncForge/mcp/index.js
```

### 4. Cline / Roo Code (VS Code Extension)
In `cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "syncforge": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/SyncForge/mcp/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

## 🛠️ Available MCP Tools

| Tool Name | Description | Key Parameters |
|---|---|---|
| `syncforge_check_dependencies` | Detects installed media tools (`mkvmerge`, `mkvextract`, `mkvpropedit`, `ffmpeg`, `ffprobe`, `ffsubsync`, `mpv`) and returns versions and install commands. | _None_ |
| `syncforge_inspect_media` | Deep analysis of media files (video/audio/subtitle streams, track IDs, codecs, languages, default/forced flags, font attachments) or directories. | `path` (file or folder path) |
| `syncforge_calculate_audio_delay` | Calculates millisecond audio waveform offset between two files using FFT cross-correlation. | `reference_media`, `source_media`, `start_time`, `duration` |
| `syncforge_sync_subtitles` | Automatically aligns external subtitle files (`.srt`, `.ass`) to reference video audio speech with `ffsubsync`. | `reference_video`, `subtitle_file`, `output_file`, `max_offset_seconds` |
| `syncforge_set_track_flags` | Directly modifies Default and Forced track metadata flags in an MKV file using `mkvpropedit` (lossless, instantaneous). | `mkv_file`, `default_audio_id`, `default_sub_id`, `forced_audio_id`, `forced_sub_id` |
| `syncforge_extract_track` | Extracts a specific audio or subtitle stream from an MKV file to disk using `mkvextract`. | `mkv_file`, `track_id`, `output_path` |
| `syncforge_filter_and_clean_tracks` | Remuxes an MKV file keeping only specified video, audio, and subtitle track IDs (removing unwanted dubs or commentary). | `input_mkv`, `output_mkv`, `video_ids`, `audio_ids`, `sub_ids` |
| `syncforge_merge_tracks` | Losslessly merges selected audio and subtitle tracks from source into target MKV, applying millisecond delay offsets. | `target_video`, `source_media`, `output_mkv`, `audio_delay_ms`, `sub_delay_ms` |
| `syncforge_wavesync_injection` | Complete WaveSync Injection (Module 5): calculates waveform delay, syncs audio and subs, copies font attachments, optional Opus conversion, and muxes losslessly. | `target_video`, `source_media`, `output_mkv`, `convert_opus`, `import_subtitles`, `import_attachments` |
| `syncforge_sync_subs_from_mkv` | Subtitle extraction and alignment from MKV (Module 4): extracts subtitle from source MKV, syncs to target speech with ffsubsync, copies fonts, and muxes. | `target_video`, `source_mkv`, `output_mkv`, `sub_track_id`, `max_offset_seconds` |
| `syncforge_convert_audio_opus` | Converts any audio track or file to Opus (`.opus`) with custom bitrate (64k to 320k) and optional stereo downmix. | `input_file`, `output_file`, `bitrate`, `downmix`, `audio_track_index` |
| `syncforge_extract_attachments` | Extracts font files (`.ttf`, `.otf`) and attachments from an MKV file using `mkvextract`. | `mkv_file`, `output_dir` |
| `syncforge_match_episodes` | Matches TV show episodes and subtitles across two directories by episode key (`S01E01`, `1x01`, `EP01`), identifying matched pairs and missing episodes. | `target_paths`, `source_paths` |
| `syncforge_run_batch` | Executes any of the 6 SyncForge modes on an entire season or directory of files with automatic episode matching. | `module_id`, `target_folder`, `source_folder`, `output_folder`, `options` |
| `syncforge_preview_mpv` | Generates or executes an MPV preview command with real-time audio/subtitle offset flags. | `target_video`, `audio_file`, `audio_delay_ms`, `sub_file`, `sub_delay_ms` |
| `syncforge_list_modules` | Lists all 6 core SyncForge GUI/batch processing modes, input requirements, and applicable options. | _None_ |
| `syncforge_search_subtitles_online` | Searches OpenSubtitles.com REST API v1 by movie/show title, IMDb ID, TMDb ID, season/episode, or exact video 64-bit moviehash. | `query`, `file_path`, `languages`, `imdb_id`, `season_number`, `episode_number`, `api_key` |
| `syncforge_download_subtitle_online` | Downloads a subtitle file directly from OpenSubtitles.com by its `file_id`. | `file_id`, `output_path`, `sub_format`, `api_key` |
| `syncforge_auto_fetch_and_sync_subtitle` | End-to-end subtitle locator: computes video moviehash, queries OpenSubtitles, downloads the best match, and aligns it to audio with `ffsubsync`. | `video_path`, `output_sub_path`, `languages`, `max_offset_seconds`, `api_key` |
| `syncforge_configure_opensubtitles` | Configures and saves the OpenSubtitles API key and optional token to the shared user config (`~/.config/syncforge/config.json`). | `api_key`, `user_token` |

---

## 📜 OpenSubtitles Licensing, Terms of Use & API Keys

SyncForge is distributed under the permissive **MIT License**. When integrating OpenSubtitles.com capabilities, the following legal and operational terms apply:

1. **Personal & Open-Source Use**: OpenSubtitles.com permits open-source, non-commercial desktop applications and personal media management tools (such as Bazarr, Kodi, and SyncForge) to query their REST API v1.
2. **Commercial Restriction**: Using the OpenSubtitles.com database in paid commercial software without an explicit commercial developer agreement is strictly prohibited by their Terms of Service.
3. **API Key & Rate Limits**:
   - The modern REST API v1 (`https://api.opensubtitles.com/api/v1`) requires an `Api-Key` and an identified `User-Agent`.
   - Users can obtain a free API key by creating an account at [OpenSubtitles.com Consumer Registration](https://www.opensubtitles.com/en/consumers).
   - Free accounts include 5–20 downloads/day; VIP accounts support up to 1,000 downloads/day.
4. **Shared Configuration with Desktop GUI**:
   - When entered into the SyncForge GUI Settings (**Settings → Subtitles & Synchronization → OpenSubtitles.com API Integration**), the API key is automatically saved to your user configuration (`~/.config/syncforge/config.json` on macOS/Linux or `%APPDATA%\syncforge\config.json` on Windows).
   - MCP tools and AI agents automatically read the key from this file without requiring any manual environment configuration.
   - Alternatively, you can configure it via the `syncforge_configure_opensubtitles` MCP tool, pass the `api_key` argument directly, or set the environment variable:
   ```bash
   export OPENSUBTITLES_API_KEY="your_api_key_here"
   # Optional user token for personal VIP quotas:
   export OPENSUBTITLES_TOKEN="your_jwt_user_token"
   ```
5. **No Hardcoded Keys**: In compliance with security best practices and OpenSubtitles API policies, SyncForge does **not** hardcode a shared master key. Each user or agent supplies their own key, ensuring personal quota management and preventing unexpected account bans.

## 📦 MCP Resources

Agents can read these read-only context resources:
- `syncforge://modules`: Machine-readable matrix of all 6 processing modes, descriptions, and settings.
- `syncforge://config`: Global configuration, default thresholds, and detected tool paths.
- `syncforge://status`: Real-time system health, platform architecture, and binary paths.

---

## 💬 MCP Prompts (Workflow Templates)

Agents can use structured prompt templates for common user tasks:
- `inspect_and_clean_mkv`: Guides the agent to inspect streams, select target languages, filter unwanted audio/commentaries, and verify default flags.
- `sync_and_embed_subtitles`: Guides the agent to align an out-of-sync subtitle file with video speech using `ffsubsync` and embed it into a clean MKV container.
- `waveform_audio_sync`: Guides the agent to compute cross-correlation waveform delay between dual audio releases and mux them losslessly.
