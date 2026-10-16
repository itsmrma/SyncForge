# SyncForge

SyncForge batch-processes video files with MKVToolNix, FFmpeg, and `ffsubsync`,
powered by a native **Rust** backend and **Tauri v2** desktop interface.

**[3.1 — Quality of Life Improvements & Production Bundle Fix](https://github.com/itsmrma/SyncForge/releases/tag/v3.1)**
adds drag-and-drop paths, smart TV episode auto-matching, track search & language presets, live ETA & taskbar progress, settings persistence, terminal log filters, and standalone production bundle fixes. See [CHANGELOG.md](CHANGELOG.md).

> [!NOTE]
> **Personal Project & Disclaimer**: SyncForge is a personal project developed for individual media workflows. The pre-compiled executables and release bundles are provided "as is", without any guarantee or warranty of correct functioning, stability, or compatibility with your setup. Use at your own discretion, and always maintain backups of your original media files before modifying them.

## Features

- **Stream Manager:** remove unwanted audio/subtitle tracks and optionally convert audio to Opus.
- **Default and forced flags:** edit MKV metadata in-place without remuxing.
- **External subtitles:** align subtitle files to video audio using the `ffsubsync` executable.
- **Subtitles from MKV:** extract, synchronize, and inject subtitles from another video.
- **WaveSync Injection:** synchronize and merge source audio/subtitles using native Rust FFT waveform analysis.
- **Custom Track Merge:** combine selected tracks from two videos or batches of videos (direct lossless remux without sync).

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
Install **MKVToolNix** (`mkvmerge`, `mkvextract`, `mkvpropedit`), **FFmpeg** (`ffmpeg`),
and **ffsubsync** (`ffsubsync`), and make them available on `PATH`.

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
- **ffsubsync**: Copyright (c) 2018 Stephen Macke, licensed under the [MIT License](web/public/ffsubsync-LICENSE.txt). Included in builds and distributions.
- **Inter Font Family**: Copyright (c) 2016 The Inter Project Authors, licensed under the [SIL Open Font License 1.1](web/public/Inter-LICENSE.txt). Included in builds and distributions.
- **Material Design Icons & MUI**: Copyright (c) Google LLC ([Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)) and Material-UI SAS ([MIT License](https://github.com/mui/material-ui/blob/master/LICENSE)).

### External Tools (System Dependencies)
SyncForge interfaces with the following open-source CLI media utilities when installed on your system `PATH`:
- **MKVToolNix** (`mkvmerge`, `mkvextract`, `mkvpropedit`): Copyright (c) Moritz Bunkus, licensed under the [GNU General Public License v2 (GPL-2.0)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html).
- **FFmpeg** (`ffmpeg`): Copyright (c) FFmpeg developers, licensed under the [GNU LGPL v2.1+ or GPL v2+](https://ffmpeg.org/legal.html) depending on configuration.
