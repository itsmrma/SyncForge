# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Media curators, home-server (Plex, Jellyfin, Emby) archivists, fansub collectors, and video enthusiasts who maintain multi-track, multi-language libraries and need to batch-synchronize, extract, filter, or merge video, audio, and subtitle streams without re-encoding video.

## Product Purpose

SyncForge eliminates manual Non-Linear Editor (NLE) timeline work and error-prone shell scripting for media library maintenance. It provides automated, high-precision audio delay synchronization via native FFT waveform cross-correlation, speech-to-subtitle alignment, and lossless MKV remuxing/metadata editing in a fast, robust desktop interface. Success means reliable batch processing across entire seasons or movie libraries without media corruption, desync, or quality loss.

## Positioning

Unlike generic MKV remuxers (such as standard MKVToolNix GUI) that require manual delay calculations and offset guessing, or heavyweight NLEs that re-encode video, SyncForge combines pure-Rust FFT waveform cross-correlation (computing audio track offsets down to the millisecond) and `ffsubsync` speech alignment with native MKVToolNix stream extraction and staged atomic remuxing in an integrated batch pipeline.

## Operating Context

- Desktop application built with Tauri v2 (Rust backend with React 19/Vite frontend in an OS webview window).
- Operates directly on local media files and storage volumes (NAS mounts, internal/external drives).
- Integrates with system-installed or portable media CLI utilities: MKVToolNix (`mkvmerge`, `mkvextract`, `mkvpropedit`), FFmpeg (`ffmpeg`), and `ffsubsync`.
- Relies on native desktop ergonomics: file/folder pickers (`rfd`), draggable batch matcher pairing, global keyboard shortcuts, live subprocess log streaming, desktop notifications, and foreground-aware completion toasts.

## Capabilities and Constraints

### Capabilities
- **6 Dedicated Processing Modules**:
  1. `stream_manager` (Remove & Filter Tracks): Delete unwanted audio/subtitle streams, with optional Opus audio transcoding (bitrates, downmixing).
  2. `set_default` (Set Default & Forced Flags): Fast, lossless in-place MKV track metadata modification via `mkvpropedit` without rewriting video payloads.
  3. `sync_subs` (Sync Subtitle Files to Audio): Align external `.srt` and `.ass` subtitles against reference video audio using `ffsubsync`.
  4. `sync_subs_mkv` (Extract & Sync Subs from MKV): Automatically extract subtitle tracks from a source MKV, synchronize against target audio, and inject back into the target.
  5. `injection` (Waveform Audio Sync & Merge): Compute audio delay offsets via pure-Rust FFT cross-correlation, align subtitles, import font attachments, and merge into target container.
  6. `custom_merge` (Direct Track Merge): Direct lossless remux of selected tracks from target and source files without running waveform or subtitle sync.
- **Safety & Process Control**:
  - Staged atomic muxing using temporary `.syncforge-part-<uuid>.mkv` files to prevent partial or corrupted media writes on cancellation or failure.
  - Process tree lifecycle management with clean interruption of running subprocesses.
  - Live terminal console with auto-follow pause on scroll-up and instant resume.
  - Batch matcher with episode sequence diagnostics and slot-shifting.
  - "Repeat Last" workflow state restoration.

### Constraints
- Settings applicability is strictly per-module (e.g. `custom_merge` never applies delay or audio auto-matching).
- Requires external CLI binaries (`mkvmerge`, `ffmpeg`, `ffsubsync`) available on system `PATH` or in portable application directories (`tools/`, `bin/`).

## Brand Commitments

- **Name**: SyncForge.
- **Visual Identity**: Dark carbon-slate desktop aesthetic inspired by modern Rust and Tauri development environments.
- **Iconography**: Material Design icons only (`@mui/icons-material/*`). Strict ban on emojis or unicode emotes anywhere in the user interface, modals, tooltips, toasts, or logs.
- **Typography**: Inter font family across all desktop typography.
- **Form Controls & Layout**: Pixel-perfect vertical alignment; input clear buttons integrated inside input adornments rather than floating disconnected.
- **Voice**: Technical, precise, utilitarian, and predictable. Clear status messages, explicit track parameters, and zero marketing fluff.

## Evidence on Hand

- Fully functional Tauri v2 + React 19 + MUI v9 desktop application in `src-tauri/` and `web/src/`.
- Documented development guidelines and invariants in `AGENTS.md`.
- Preview GIF demonstrating application UI and batch workflow at `assets/syncforge-preview.gif`.
- Release notes for version 3.2 in `CHANGELOG.md` and `README.md`.
- Test suites: Rust unit/integration tests in `src-tauri/tests` and Playwright browser integration tests in `web/tests`.

## Product Principles

1. **Non-Destructive & Safe Operations**: Never risk corrupting the user's media library. All file-writing operations must use staged atomic muxing, clean cancellation safeguards, or validated in-place header edits.
2. **Deterministic & Transparent**: Provide complete visibility into operations through real-time subprocess log streaming, explicit MKV track IDs/codecs/languages, and strict module settings separation with no unexpected automatic side effects.
3. **High-Throughput Batch Ergonomics**: Optimize for batch curator efficiency through drag-and-drop batch matching, episode index alignment, keyboard shortcuts, and "Repeat Last" state restoration.
4. **Zero Gimmicks, Utilitarian Craft**: Maintain a focused, dark carbon-slate desktop interface with pure Material Design icons, clear typographic hierarchy, and rock-solid native desktop reliability.
