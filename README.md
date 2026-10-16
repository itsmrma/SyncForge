# SyncForge

SyncForge batch-processes video files with MKVToolNix, FFmpeg, and `ffsubsync`,
powered by a native **Rust** backend and **Tauri v2** desktop interface.

**[3.0.0 — Native Rust & Tauri v2 Rewrite](https://github.com/itsmrma/SyncForge/releases/tag/v3.0.0)**
brings a complete Rust + Tauri v2 architecture, pure-Rust FFT waveform synchronization, direct `ffsubsync` executable integration, and a modern desktop UI. See [CHANGELOG.md](CHANGELOG.md).

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

Inter fonts are distributed with their
[SIL Open Font License notice](web/public/Inter-LICENSE.txt), also included in builds.
