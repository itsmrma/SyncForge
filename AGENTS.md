# AGENTS.md — Development Guidelines for AI Agents

SyncForge is a desktop media application that merges and synchronizes video, audio, and subtitle streams using MKVToolNix, FFmpeg, and FFsubsync with a React/Vite GUI hosted inside `pywebview`.

---

## 🏗️ Architecture Overview

- **Backend (`src/syncforge/`)**:
  - `core/`: Shared utilities:
    - `audio_sync.py`: Audio waveform extraction and cross-correlation delay calculation using `numpy` and `scipy`.
    - `mkv_tools.py`: Wrappers around MKVToolNix tools (`mkvmerge`, `mkvextract`, `mkvpropedit`).
    - `tasks.py`: Cancellation primitives (`current_task`, `check_cancelled()`, `TaskCancelled`).
    - `utils.py`: Subprocess handling, path resolution, and input/dialog bridging.
    - `config.py`: Global runtime configurations and defaults.
  - `features/`: The processing mode handlers:
    - `stream_manager.py`: Track removal and optional Opus conversion.
    - `sub_sync.py`: Subtitle synchronization from external files (`run_sync_subs`) or extracted from MKV (`run_sync_subs_from_mkv`).
    - `injection.py`: WaveSync Injection (audio waveform delay calculation + subtitle alignment + muxing).
    - `custom_merge.py`: Custom Track Merge (direct lossless muxing of selected tracks without re-syncing).
  - `ui/backend.py`: Python API class exposed to `pywebview` JavaScript runtime, callback routers, and terminal stream interceptor.
  - `app.py`: Application entry point initializing GUI window and webview API.

- **Frontend (`web/`)**:
  - `web/src/`: React 19 + Material UI (MUI v9) + Framer Motion.
  - `web/src/modules.js`: Definitions of the six core modules, requirements, and labels.
  - `web/src/components/`:
    - `Sidebar.jsx`: Collapsible navigation and drawer.
    - `SettingsPanel.jsx`: Contextual application settings accordion (disabled/annotated based on active module).
    - `Terminal.jsx`: ANSI-compatible live log console with follow-toggle.
    - `InputDialog.jsx` & `MatcherDialog.jsx`: Interactive selection and drag-and-drop batch file matching.
  - `web/vite.config.js`: Builds distribution bundle directly into `src/syncforge/web/dist/`.

---

## ⚙️ Modules & Settings Applicability Matrix

Never assume a setting applies to all modules. The backend only reads specific flags in corresponding modules:

| Module ID | Title | Purpose | Applicable Settings |
|---|---|---|---|
| `stream_manager` | Stream Manager | Track removal, Opus conversion | `notify_on_finish` |
| `set_default` | Set Default & Forced | Metadata editing with `mkvpropedit` | `notify_on_finish` |
| `sync_subs` | Sync External Subtitles | Align subtitle files with FFsubsync | `auto_subs`, `enable_max_offset`, `max_offset`, `notify_on_finish` |
| `sync_subs_mkv` | Sync Subs from MKV | Extract + align subtitles from MKV | `auto_subs`, `enable_max_offset`, `max_offset`, `notify_on_finish` |
| `injection` | WaveSync Injection | Full audio delay sync + subtitle sync | `auto_audio`, `auto_subs`, `enable_max_offset`, `max_offset`, `notify_on_finish` |
| `custom_merge` | Custom Track Merge | Direct lossless remux of chosen tracks | `notify_on_finish` |

> [!IMPORTANT]
> **Custom Track Merge vs. WaveSync Injection**:
> - `custom_merge` does **NOT** alter track delays or run waveform sync/ffsubsync; it runs direct `mkvmerge`.
> - If audio synchronization (waveform cross-correlation) is needed, use `injection`.

---

## 🛠️ Development & Verification Commands

### Environment Setup
```sh
uv sync --locked
cd web
npm ci
npm run build
cd ..
```

### Running the App Locally
```sh
uv run syncforge
# or: uv run python main.py
```

### Frontend Checks
```sh
cd web
npm run lint         # oxlint
npm run build        # compiles to src/syncforge/web/dist
npm test             # Playwright browser integration suite
cd ..
```

### Backend Checks
```sh
uv run python -m unittest discover -s tests -v
```

> [!IMPORTANT]
> Always run `npm run build` inside `web/` after modifying any frontend files. Python packages and standalone bundles load files exclusively from `src/syncforge/web/dist/`.

---

## 📦 Release & Versioning Guidelines

- **Version Synchrony**: When bumping versions, update:
  1. `pyproject.toml` (`[project] version = "..."`)
  2. `web/package.json` (`"version": "..."`)
  3. Run `uv lock` to update `uv.lock`
  4. `CHANGELOG.md`
  5. `README.md` (top release badge and link)
- **Changelog Convention**: `CHANGELOG.md` maintains notes for the **current release only** under `## <version> - <Title>`. Do not append historical releases (they live in Git history and GitHub releases).
- **Git Tags**: Tags follow `vX.Y.Z` (e.g., `v2.1.1`). Pushing a tag (`git push origin vX.Y.Z`) automatically triggers GitHub Actions to build Windows, Linux, and macOS standalone executables and publish a GitHub Release.
