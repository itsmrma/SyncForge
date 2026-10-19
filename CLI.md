# 🖥️ SyncForge CLI (`syncforge-cli`) — Headless Automation & Scripting Wiki

`syncforge-cli` is the standalone, headless command-line runner for **SyncForge**. Compiled with `--no-default-features`, it excludes all GUI, Tauri, and WebView dependencies—producing a fast, lightweight executable ideal for shell scripts, cron jobs, NAS/headless Linux servers, and automated media pipelines.

In addition to the standalone `syncforge-cli` binary, the standard desktop executable (`SyncForge`) also supports the exact same CLI arguments when launched from a terminal.

---

## 📦 Installation & Quick Start

### 1. Pre-compiled Binaries (GitHub Releases)
Download the standalone CLI binary for your platform from [GitHub Releases](https://github.com/itsmrma/SyncForge/releases):
- **Windows**: `syncforge-cli-Windows-3.5.0.exe` (rename to `syncforge-cli.exe` and place in your `PATH` or portable folder)
- **Linux**: `syncforge-cli-Linux-3.5.0` / `syncforge-cli-Linux-3.5.0.tar.gz`
- **macOS**: `syncforge-cli-macOS-3.5.0` / `syncforge-cli-macOS-3.5.0.tar.gz`

### 2. Build from Source (Rust)
To compile `syncforge-cli` without any GUI/WebView dependencies:
```bash
cargo build --release --no-default-features --bin syncforge-cli
```
The resulting binary will be located at `target/release/syncforge-cli` (or `target\release\syncforge-cli.exe` on Windows).

### 3. Verify External Tools
`syncforge-cli` uses the same portable tool discovery as the desktop app (searching its own directory, `tools/`, `bin/`, and system `PATH`):
```bash
syncforge-cli tools
# Or machine-readable JSON:
syncforge-cli tools --json
```

---

## 🧭 Subcommands Overview

| Subcommand | Syntax | Description |
|---|---|---|
| `run` | `syncforge-cli run <MODULE> [OPTIONS]` | Execute any of the 7 core media processing modules (note: `run` can also be omitted, e.g. `syncforge-cli injection ...`). |
| `script` | `syncforge-cli script <FILE.json> [--json]` | Execute a single job or a multi-step batch pipeline defined in a JSON workflow file. |
| `inspect` | `syncforge-cli inspect <PATH> [--json]` | Inspect a media file (tracks, IDs, languages, codecs, default/forced flags, attachments) or folder summary. |
| `delay` | `syncforge-cli delay <REF> <TGT> [OPTIONS]` | Calculate the exact millisecond audio offset between two media files using pure-Rust FFT cross-correlation. |
| `preview` | `syncforge-cli preview --target <VIDEO> [OPTIONS]` | Launch `mpv` with real-time audio and subtitle delay offsets to audition synchronization. |
| `tools` | `syncforge-cli tools [--json]` | Check availability and resolved paths of `mkvmerge`, `mkvextract`, `mkvpropedit`, `ffmpeg`, `ffsubsync`, and `mpv`. |
| `modules` | `syncforge-cli modules [--json]` | List all 7 processing modules, their aliases, required inputs, and applicable CLI flags. |
| `config` | `syncforge-cli config [show\|path\|set\|reset]` | Read or modify the persistent SyncForge user configuration (`config.json`). |

---

## ⚡ Execution Modes: Automated vs. Interactive

`syncforge-cli` supports three flexible ways to run workflows:

1. **100% Automated via CLI Flags (`-y` / `--yes`)**:
   Pass semantic flags for track selection (by numeric Track ID like `1,2` or by ISO language code like `ita`, `eng`, `jpn`) and add `-y` (`--yes` / `--non-interactive`). Any unspecified prompt automatically uses safe defaults and 1:1 sorted file matching without ever blocking on `stdin`.
2. **Hybrid Interactive Terminal Mode (Fallback to `stdin`)**:
   If you omit `-y` and do not specify a required track choice on the command line, `syncforge-cli` prints the detected track table in the terminal and prompts you interactively via `stdin`.
3. **Declarative JSON Workflow Scripts (`syncforge-cli script`)**:
   Define one or multiple sequential jobs in a `.json` file (which can also be generated directly from the GUI via the **CLI Command** button) and run `syncforge-cli script workflow.json`.

---

## 🎬 The 7 Core Processing Modules

### 1. Remove & Filter Tracks (`stream_manager`)
**Aliases**: `filter`, `remove-tracks`, `stream`  
Filters audio and subtitle tracks in a single video or batch folder, with optional Opus audio transcoding.

| Flag | Description |
|---|---|
| `-v, --video <PATH>` | Input video file or folder. |
| `-o, --output <PATH>` | Output folder (optional; defaults to configured output dir or input folder). |
| `--keep-tracks <SPEC>` | Comma-separated track IDs (`1,3`), language codes (`ita,eng`), `all`, `none`, or `skip`. |
| `--opus <off\|always\|prompt>` | Convert kept audio tracks to Opus (`--convert-opus` is shorthand for `--opus always`). |
| `--opus-bitrate <KBPS>` | Opus bitrate in kbps (default: `128`). |
| `--opus-downmix` / `--no-opus-downmix` | Downmix to 2.0 stereo (default) or preserve original channels. |

**Examples:**
```bash
# Keep only Italian and Japanese tracks, convert audio to 160k stereo Opus, non-interactive:
syncforge-cli run stream_manager -v ./Anime_Raw -o ./Anime_Clean --keep-tracks jpn,ita --opus always --opus-bitrate 160 -y

# Keep track IDs 1 and 2 without audio re-encoding:
syncforge-cli filter -v ./movie.mkv -o ./out --keep-tracks 1,2 -y
```

---

### 2. Set Default & Forced Flags (`set_default`)
**Aliases**: `flags`, `default-flags`, `default`  
Edits Matroska track header flags in-place using `mkvpropedit` (instantaneous, no remuxing).

| Flag | Description |
|---|---|
| `-v, --video <PATH>` | Video file or folder to modify in-place. |
| `--default-audio <ID\|LANG\|none>` | Track ID or language code (e.g. `1` or `ita`) to mark as Default audio. |
| `--default-sub <ID\|LANG\|none>` | Track ID or language code (e.g. `2` or `ita`) to mark as Default subtitle. |
| `--forced-sub <ID\|LANG\|none>` | Track ID or language code (e.g. `3` or `ita`) to mark as Forced subtitle. |

**Example:**
```bash
# Set Italian audio as default and Italian subtitle track as default across an entire season folder:
syncforge-cli run set_default -v ./Season_01 --default-audio ita --default-sub ita --forced-sub none -y
```

---

### 3. Sync Subtitle Files to Audio (`sync_subs`)
**Aliases**: `subs`, `sub-sync`  
Aligns external subtitle files (`.srt`, `.ass`, `.ssa`, `.vtt`) to video dialogue using `ffsubsync` and muxes them into `*_subbed.mkv`.

| Flag | Description |
|---|---|
| `-v, --video <PATH>` | Target video file or folder. |
| `-s, --sub <PATH>` | External subtitle file or folder. |
| `-o, --output <PATH>` | Output folder. |
| `--auto-subs` / `--no-auto-subs` | Enable (default) or disable `ffsubsync` alignment before muxing. |
| `--max-offset <SECONDS>` | Maximum offset limit in seconds for `ffsubsync` (e.g. `60`). |

**Example:**
```bash
syncforge-cli run sync_subs -v ./Show_S01 -s ./Subs_ITA -o ./Output --max-offset 60 -y
```

---

### 4. Extract & Sync Subs from MKV (`sync_subs_mkv`)
**Aliases**: `subs-mkv`, `extract-subs`  
Extracts a subtitle track (and fonts) from a source MKV, aligns it to the target video with `ffsubsync`, and muxes it into the target container.

| Flag | Description |
|---|---|
| `-v, --video <PATH>` | Target video file or folder (high-quality video to receive subtitles). |
| `-s, --sub <PATH>` | Source MKV file or folder (containing the subtitle track to extract). |
| `-o, --output <PATH>` | Output folder. |
| `--sub-track <ID\|LANG>` | Subtitle track ID or language code to extract from the source MKV (e.g. `2` or `ita`). |
| `--auto-subs` / `--no-auto-subs` | Enable (default) or disable `ffsubsync` alignment. |
| `--max-offset <SECONDS>` | Maximum offset limit in seconds for `ffsubsync`. |

**Example:**
```bash
syncforge-cli run sync_subs_mkv -v ./BDRip -s ./WEBDL -o ./Muxed --sub-track ita --max-offset 45 -y
```

---

### 5. Waveform Audio Sync & Merge (`injection`)
**Aliases**: `wavesync`, `inject`  
Extracts audio segments from both target and source videos, computes the exact millisecond delay via pure-Rust FFT cross-correlation (`WaveSync`), optionally aligns subtitles via `ffsubsync`, imports font attachments, and muxes into `*_final.mkv`.

| Flag | Description |
|---|---|
| `-v, --video <PATH>` | Target video file or folder (High Quality video). |
| `-s, --sub <PATH>` | Source video file or folder (Audio/Subtitles to extract and inject). |
| `-o, --output <PATH>` | Output folder. |
| `--keep-target-audio` / `--no-keep-target-audio` | Keep or strip original audio tracks from the target video. |
| `--keep-target-subs` / `--no-keep-target-subs` | Keep or strip original subtitle tracks from the target video. |
| `--import-audio` / `--no-import-audio` | Import audio track from the source video. |
| `--audio-track <ID\|LANG>` | Source audio track ID or language code to inject (implies `--import-audio`). |
| `--import-subs` / `--no-import-subs` | Import subtitle track from the source video. |
| `--sub-track <ID\|LANG>` | Source subtitle track ID or language code to inject (implies `--import-subs`). |
| `--import-attachments` / `--no-import-attachments` | Import font attachments from the source MKV (default: enabled when importing subs). |
| `--auto-audio` / `--no-auto-audio` | Enable (default) or disable FFT waveform delay calculation. |
| `--auto-subs` / `--no-auto-subs` | Enable (default) or disable `ffsubsync` alignment on imported subtitles. |
| `--opus <off\|always\|prompt>` | Optionally encode the injected audio track to Opus. |

**Example:**
```bash
syncforge-cli run injection \
  -v ./BDRip_1080p \
  -s ./TV_ITA \
  -o ./Final_Mux \
  --keep-target-audio \
  --keep-target-subs \
  --import-audio --audio-track ita \
  --import-subs --sub-track ita \
  --import-attachments \
  -y
```

---

### 6. Direct Track Merge — No Sync (`custom_merge`)
**Aliases**: `merge`, `direct-merge`  
Losslessly remuxes selected audio and subtitle tracks from Folder/File A and Folder/File B without altering track delays or running waveform/subtitle synchronization.

| Flag | Description |
|---|---|
| `-v, --video, --folder-a <PATH>` | Base video file or Folder A. |
| `-s, --sub, --folder-b <PATH>` | Secondary source file or Folder B. |
| `-o, --output <PATH>` | Output folder. |
| `--keep-a-audio <IDS\|LANG\|all\|none>` | Audio tracks to keep from Source A (e.g. `1`, `jpn`, `all`, `none`). |
| `--keep-a-subs <IDS\|LANG\|all\|none>` | Subtitle tracks to keep from Source A. |
| `--keep-b-audio <IDS\|LANG\|all\|none>` | Audio tracks to merge from Source B (e.g. `ita`). |
| `--keep-b-subs <IDS\|LANG\|all\|none>` | Subtitle tracks to merge from Source B (e.g. `ita`). |
| `--opus <off\|always\|prompt>` | Optionally convert merged audio tracks to Opus. |

**Example:**
```bash
syncforge-cli run custom_merge \
  --folder-a ./Video_A \
  --folder-b ./Audio_B \
  -o ./Merged \
  --keep-a-audio jpn \
  --keep-a-subs eng \
  --keep-b-audio ita \
  --keep-b-subs ita \
  -y
```

---

### 7. Self-Sync Audio & Subtitles (`internal_sync`)
**Aliases**: `self-sync`, `inplace-sync`  
Synchronizes an out-of-sync audio track and/or subtitle track **already inside** a standalone video file against a reference audio track in the same container.

| Flag | Description |
|---|---|
| `-v, --video <PATH>` | Video file or folder to self-synchronize. |
| `-o, --output <PATH>` | Output folder (saves `*_synced.mkv`). |
| `--sync-audio` / `--no-sync-audio` | Enable or disable internal audio track synchronization. |
| `--sync-subs` / `--no-sync-subs` | Enable or disable internal subtitle track synchronization. |
| `--ref-audio-track <ID\|LANG>` | Reference audio track ID or language code (already in sync with video, e.g. `jpn` or `1`). |
| `--target-audio-track <ID\|LANG>` | Target audio track ID or language code to align via FFT (e.g. `ita` or `2`). |
| `--target-sub-track <ID\|LANG>` | Target subtitle track ID or language code to align via `ffsubsync` (e.g. `ita` or `3`). |

**Example:**
```bash
syncforge-cli run internal_sync \
  -v ./movie_unsynced.mkv \
  -o ./fixed \
  --ref-audio-track jpn \
  --sync-audio --target-audio-track ita \
  --sync-subs --target-sub-track ita \
  -y
```

---

## 📜 JSON Workflow Scripts (`syncforge-cli script`)

For repeatable pipelines or multi-step batch jobs, you can define a JSON file containing either a single job object or a `"jobs": [...]` array.

> [!TIP]
> You can generate and download a ready-to-use `.json` workflow file directly from the SyncForge desktop GUI by clicking the **CLI Command** button next to **Launch Module**.

### Example `workflow.json` (Multi-Step Pipeline)
```json
{
  "jobs": [
    {
      "module": "injection",
      "video": "./Season_01_BDRip",
      "sub": "./Season_01_WEBDL_ITA",
      "output": "./Season_01_Muxed",
      "keep_target_audio": true,
      "keep_target_subs": true,
      "import_audio": true,
      "audio_track": "ita",
      "import_subs": true,
      "sub_track": "ita",
      "import_attachments": true,
      "opus_mode": "off",
      "yes": true
    },
    {
      "module": "set_default",
      "video": "./Season_01_Muxed",
      "default_audio": "ita",
      "default_sub": "ita",
      "forced_sub": "none",
      "yes": true
    }
  ]
}
```

### Execute the Workflow
```bash
syncforge-cli script workflow.json

# Or emit structured JSON results on stdout (while human progress logs stream to stderr):
syncforge-cli script workflow.json --json
```

---

## 🔍 Utility & Diagnostic Commands

### 1. Inspect Media Files or Folders (`inspect`)
```bash
# Human-readable track table:
syncforge-cli inspect ./episode_01.mkv

# Structured JSON output for shell/Python scripts (jq-friendly):
syncforge-cli inspect ./episode_01.mkv --json
```

### 2. Standalone FFT Audio Delay Calculator (`delay`)
Calculates the exact millisecond offset between a reference media file and a target media file using SyncForge's built-in Rust FFT cross-correlation engine:
```bash
syncforge-cli delay ./bdrip.mkv ./webdl.mkv --start 00:05:00 --duration 00:02:00
# Output: Calculated Audio Delay: +420 ms

# JSON output:
syncforge-cli delay ./bdrip.mkv ./webdl.mkv --json
```

### 3. Audition Sync in `mpv` (`preview`)
```bash
syncforge-cli preview --target ./bdrip.mkv --audio ./webdl.mkv --audio-delay 420 --sub ./subs.srt --sub-delay -150 --start 00:05:00
```

### 4. Manage Persistent User Configuration (`config`)
```bash
# Show current config JSON:
syncforge-cli config show

# Print path to config.json:
syncforge-cli config path

# Update a persistent setting:
syncforge-cli config set opus_bitrate 160
syncforge-cli config set default_output_dir "D:/Muxed"

# Reset configuration to defaults:
syncforge-cli config reset
```

---

## 🔢 Exit Codes

| Exit Code | Meaning |
|---|---|
| `0` | Success (`ok` or completed with non-fatal `warning`). |
| `1` | Processing or runtime error (missing file, tool failure, invalid media). |
| `2` | Invalid CLI arguments, unknown module, or malformed JSON script. |
| `130` | Task cancelled by user or no files processed (`cancelled`). |
