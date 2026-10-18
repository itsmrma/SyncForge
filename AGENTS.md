# AGENTS.md — Development Guidelines for AI Agents

SyncForge is a native desktop media application written in **Rust** with **Tauri v2** (`https://v2.tauri.app/`) that merges and synchronizes video, audio, and subtitle streams using MKVToolNix, FFmpeg, and the `ffsubsync` CLI executable with a modern React/Vite GUI.

---

## 🏗️ Architecture Overview

- **Backend (`src-tauri/src/`)**:
  - `core/`: Shared Rust utilities:
    - `audio_sync.rs`: Audio waveform segment extraction (`ffmpeg`) and pure-Rust FFT cross-correlation delay calculation (`hound` + `rustfft`).
    - `mkv_tools.rs`: Wrappers around MKVToolNix tools (`mkvmerge`, `mkvextract`, `mkvpropedit`) with metadata caching.
    - `tasks.rs`: Thread-safe cancellation and progress primitives (`TaskProgress`, `check_cancelled()`, `TaskError`).
    - `processes.rs`: Hidden, cancellable process-group spawning and termination across Windows, macOS, and Linux.
    - `utils.rs`: Subprocess line streaming, staged `.syncforge-part-<uuid>.mkv` atomic muxing, recursive file discovery, and dialog callbacks.
    - `notifications.rs`: Cross-platform desktop notifications (`osascript`, `notify-send`, Windows Toast).
    - `config.rs`: Global runtime configurations and defaults.
  - `features/`: The processing mode handlers:
    - `stream_manager.rs`: Track removal (`run_stream_manager`), optional Opus conversion, and in-place Default/Forced flag editing (`run_set_default_tracks`).
    - `sub_sync.rs`: Subtitle synchronization from external files (`run_sync_subs`) or extracted from MKV (`run_sync_subs_from_mkv`) using the `ffsubsync` executable.
    - `injection.rs`: WaveSync Injection (audio waveform delay calculation + subtitle alignment + font attachment import + muxing).
    - `custom_merge.rs`: Custom Track Merge (direct lossless muxing of selected tracks without re-syncing).
  - `ui/backend.rs`: Thread-safe `Api` state manager, callback coordination, and repeat-last state.
  - `lib.rs` & `main.rs`: Tauri v2 application setup, IPC commands (`#[tauri::command]`), and native window/dialog bridge (`rfd`).

- **Frontend (`web/`)**:
  - `web/src/`: React 19 + MUI v9 + Framer Motion styled with a modern Rust/Tauri dark carbon-slate desktop theme.
  - `web/src/bridge.js`: Unified IPC bridge supporting Tauri v2 (`@tauri-apps/api/core` `invoke`) and Playwright test mocks.
  - `web/src/modules.js`: Definitions of the six core modules, requirements, and labels.
  - `web/src/components/`:
    - `Sidebar.jsx`: Collapsible and resizable navigation rail.
    - `SettingsPanel.jsx`: Contextual application settings accordion (disabled/annotated based on active module).
    - `Terminal.jsx`: Live developer console with auto-follow pause/resume.
    - `InputDialog.jsx` & `MatcherDialog.jsx`: Interactive track selection and drag-and-drop batch file matching.
  - `web/vite.config.js`: Builds distribution bundle into `web/dist/` consumed by Tauri v2.

---

## ⚙️ Modules & Settings Applicability Matrix

Never assume a setting applies to all modules. The backend only reads specific flags in corresponding modules:

| Module ID | Title | Purpose | Applicable Settings |
|---|---|---|---|
| `stream_manager` | Remove & Filter Tracks | Track removal, Opus conversion | `opus_mode`, `notify_on_finish` |
| `set_default` | Set Default & Forced Flags | Metadata editing with `mkvpropedit` | `notify_on_finish` |
| `sync_subs` | Sync Subtitle Files to Audio | Align subtitle files with `ffsubsync` | `auto_subs`, `enable_max_offset`, `max_offset`, `notify_on_finish` |
| `sync_subs_mkv` | Extract & Sync Subs from MKV | Extract + align subtitles from MKV | `auto_subs`, `enable_max_offset`, `max_offset`, `notify_on_finish` |
| `injection` | Waveform Audio Sync & Merge | Full audio delay sync + subtitle sync | `auto_audio`, `auto_subs`, `enable_max_offset`, `max_offset`, `opus_mode`, `notify_on_finish` |
| `custom_merge` | Direct Track Merge (No Sync) | Direct lossless remux of chosen tracks | `opus_mode`, `notify_on_finish` |

> [!IMPORTANT]
> **Direct Track Merge vs. Waveform Audio Sync & Merge**:
> - `custom_merge` does **NOT** alter track delays or run waveform sync/`ffsubsync`; it runs direct `mkvmerge`.
> - If audio synchronization (waveform cross-correlation) is needed, use `injection`.

---

## 🛠️ Development & Verification Commands

### Environment Setup
```sh
cd web
npm ci
npm run build
cd ..
```

### Running the App Locally (Tauri v2)
```sh
# From the project root (SyncForge/):
npm run dev
# or: npm run tauri dev
```

### Frontend Checks
```sh
cd web
npm run lint         # oxlint
npm run build        # compiles to web/dist
npm test             # Playwright browser integration suite
cd ..
```

### Backend Checks (Rust)
```sh
cargo test --workspace
```

---

## 📦 Release & Versioning Guidelines

- **Version Synchrony**: When bumping versions, update:
  1. `src-tauri/Cargo.toml` (`version = "..."`)
  2. `src-tauri/tauri.conf.json` (`"version": "..."`)
  3. `web/package.json` (`"version": "..."`)
  4. `CHANGELOG.md`
  5. `README.md` (top release badge and link)
- **Changelog Convention**: `CHANGELOG.md` maintains notes for the **current release only** under `## <version> - <Title>`.
- **Git Tags**: Tags follow `vX.Y.Z` (e.g., `v3.0.0`).

---

## 🎨 UI & Design Guidelines

- **Icons & Visuals**: Always use **Material Design icons** (`@mui/icons-material/*`). **Never use emojis or unicode emotes** in the user interface, modals, tooltips, alerts, status messages, or settings cards.
- **Alignment & Layout**: Always ensure form inputs and action buttons maintain pixel-perfect vertical alignment (e.g., using `alignItems: 'flex-start'` on containers where input fields have `helperText`, with buttons matching the 40px small input height).
- **Clear Buttons**: Input clear actions (`X`) must be integrated inside the input box as an `InputAdornment` (`slotProps.input.endAdornment`), never floating disconnected outside adjacent action buttons.

