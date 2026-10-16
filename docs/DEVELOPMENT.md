# Development

Backend application code lives in `src-tauri/src` (Rust + Tauri v2). `core` contains
shared media, audio FFT cross-correlation, process, notification, and task utilities;
`features` contains the six processing modes; `ui` implements the desktop state
manager and frontend bridge. `lib.rs` and `main.rs` wire Tauri v2 IPC commands and
window lifecycle events.

The frontend source is in `web/src`. Vite builds into `web/dist`, which Tauri embeds
into the native binary.

## Source setup

Install Rust (`rustup`) and Node.js, then run:

```sh
cd web
npm ci
npm run build
npx tauri dev
```

MKVToolNix (`mkvmerge`, `mkvextract`, `mkvpropedit`), FFmpeg (`ffmpeg`), and
`ffsubsync` must be available on `PATH`.

## Verification

```sh
cd web
npm run lint
npm run build
npx playwright install --only-shell chromium
npm test
cd ..
cargo test --workspace
```

Browser tests cover file/folder selection, dialogs, source ordering, sidebar
collapse/resize, terminal scrolling, module-specific settings, and Tauri v2 IPC.
Rust tests verify task lifecycle, cancellation, staged muxing, metadata caching,
pure-Rust FFT waveform alignment, and all six processing modes.

## Distributions

Build the standalone desktop executable with Tauri:

```sh
cd web
npm ci
npm run build
npx tauri build --no-bundle
```

The compiled binary is written to `target/release/SyncForge` (or `SyncForge.exe` on Windows).
