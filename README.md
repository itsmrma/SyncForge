# SyncForge

SyncForge batch-processes video files with MKVToolNix, FFmpeg, and `ffsubsync`,
powered by a native **Rust** backend and **Tauri v2** desktop interface.

<p align="center">
  <img src="assets/syncforge-preview.gif" alt="SyncForge Preview" width="100%" />
</p>

**[3.3 — Side-by-Side Workstation, Dual-Theme Anti-Slop & mpv Sync Preview](https://github.com/itsmrma/SyncForge/releases/tag/v3.3)**
adds interactive pre-mux audio & subtitle synchronization previewing in `mpv` with millisecond micro-nudge controls and sample window recalculation, a side-by-side dockable Developer Console and live Stream & Telemetry Inspector, inline CLI sub-task transparency (`[ffmpeg]`, `[rustfft]`, `[ffsubsync]`), a Dual-Theme system (*Carbon-Slate Dark*, *Anodized Slate Light*, and *System*), RAF-batched terminal streaming, and inline pre-flight form validation. See [CHANGELOG.md](CHANGELOG.md).

> [!NOTE]
> **Personal Project & Disclaimer**: SyncForge is a personal project developed for individual media workflows. The pre-compiled executables and release bundles are provided "as is", without any guarantee or warranty of correct functioning, stability, or compatibility with your setup. Use at your own discretion, and always maintain backups of your original media files before modifying them.

## Features

- **Remove & Filter Tracks:** remove unwanted audio/subtitle tracks and optionally convert audio to Opus.
- **Set Default & Forced Flags:** edit MKV metadata in-place without remuxing.
- **Sync Subtitle Files to Audio:** align external subtitle files (.srt, .ass) to video speech/audio using the `ffsubsync` executable.
- **Extract & Sync Subs from MKV:** extract, synchronize, and inject subtitles from another video.
- **Waveform Audio Sync & Merge:** synchronize and merge source audio/subtitles using native Rust FFT waveform analysis.
- **Direct Track Merge (No Sync):** combine selected tracks from two videos or batches of videos (direct lossless remux without sync).

Track dialogs show MKVToolNix IDs, language, codec, names, and flags. The sidebar
collapses to an icon rail and restores its width when expanded. Use **File** or
**Folder** to select each target/source; external subtitles also accept a single
subtitle file. File and folder inputs can be combined. Output remains a folder;
leave it empty to use the target file's parent folder or the target folder.
**Repeat Last** restores files, folders, and the confirmed source ordering, with new files appended for
review. Scroll up to pause terminal following; scroll down or press **Go to end**
to resume. Task results appear in the app and optional desktop notifications.

**Stop task** interrupts analysis and tool processes. Completed mux outputs are
kept and partial output is removed. In-place metadata edits finish their current
write before stopping. Keep backups of media you intend to modify.

## Download and requirements

Download standalone Windows, Linux, and macOS builds from
[GitHub Releases](https://github.com/itsmrma/SyncForge/releases).

SyncForge interfaces with external CLI tools. You have two convenient options:
1. **Portable Mode (No installation required)**: Simply drop the executables (`mkvmerge`, `mkvextract`, `mkvpropedit`, `ffmpeg`, `ffsubsync`, `mpv` or their folders `tools/`, `bin/`) directly in the same folder as the `SyncForge` executable (or next to `SyncForge.app` on macOS).
2. **System Installation**: Install them via your package manager (`winget`, `choco`, `brew`, `apt`, `pip`) and make them available on `PATH`.

- **MKVToolNix** (`mkvmerge`, `mkvextract`, `mkvpropedit`) — for MKV remuxing, metadata editing, and track extraction.
- **FFmpeg** (`ffmpeg`) — for audio waveform extraction and Opus audio encoding.
- **ffsubsync** (`ffsubsync`) — for speech-to-subtitle synchronization (install via `pip install ffsubsync`, `brew install ffsubsync`, or place the executable in the app folder).
- **mpv** (`mpv`, optional) — for real-time audio and subtitle synchronization auditioning before muxing (`Preview sync with mpv before muxing`).

*(Note: Audio delay cross-correlation in WaveSync Injection is computed natively by SyncForge's built-in Rust FFT engine without external dependencies).*

## Run from source

Install [Rust](https://rustup.rs/) and [Node.js](https://nodejs.org/), then:

```sh
git clone https://github.com/itsmrma/SyncForge.git
cd SyncForge/web
npm ci
npm run build
npx tauri dev
```

To build an optimized standalone executable/bundle:

```sh
cd web
npx tauri build
```

## Development

Rust backend code is under `src-tauri/src`, separated into `core`, `features`, and `ui`.
React frontend source is under `web/src`, with separate components, module definitions,
IPC bridge, and theme. Rust regression, cancellation, and integration tests are in
`src-tauri/tests`; browser integration tests are in `web/tests`.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for structure, test, and build commands.

## Licenses and Third-Party Credits

SyncForge is licensed under the [MIT License](LICENSE).

### Bundled & Embedded Assets
- **Inter Font Family**: Copyright (c) 2016 The Inter Project Authors, licensed under the [SIL Open Font License 1.1](web/public/Inter-LICENSE.txt). Included in builds and distributions.
- **Material Design Icons & MUI**: Copyright (c) Google LLC ([Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)) and Material-UI SAS ([MIT License](https://github.com/mui/material-ui/blob/master/LICENSE)).

### External Tools (System Dependencies)
SyncForge interfaces with the following open-source CLI media utilities when installed on your system `PATH` or placed in the application folder:
- **MKVToolNix** (`mkvmerge`, `mkvextract`, `mkvpropedit`): Copyright (c) Moritz Bunkus, licensed under the [GNU General Public License v2 (GPL-2.0)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html).
- **FFmpeg** (`ffmpeg`): Copyright (c) FFmpeg developers, licensed under the [GNU LGPL v2.1+ or GPL v2+](https://ffmpeg.org/legal.html) depending on configuration.
- **ffsubsync**: Copyright (c) 2018 Stephen Macke, licensed under the [MIT License](web/public/ffsubsync-LICENSE.txt).
