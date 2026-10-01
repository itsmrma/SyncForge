# SyncForge

SyncForge batch-processes video files with MKVToolNix, FFmpeg, and ffsubsync,
using a React desktop interface through pywebview.

**[v2 — Structure Overhaul](https://github.com/itsmrma/SyncForge/releases/tag/v2)**
reorganizes the application and build system. See [CHANGELOG.md](CHANGELOG.md).

## Features

- **Stream Manager:** remove unwanted audio/subtitle tracks and optionally convert audio to Opus.
- **Default and forced flags:** edit MKV metadata without remuxing.
- **External subtitles:** align subtitle files to video audio.
- **Subtitles from MKV:** extract, synchronize, and inject subtitles from another video.
- **WaveSync Injection:** synchronize and merge source audio/subtitles using waveform analysis.
- **Custom Track Merge:** combine selected tracks from two batches of videos.

Track dialogs show MKVToolNix IDs, language, codec, names, and flags. The sidebar
collapses to an icon rail and restores its width when expanded. **Repeat Last**
restores folders and the confirmed source ordering, with new files appended for
review. Scroll up to pause terminal following; scroll down or press **Go to end**
to resume. Task results appear in the app and optional desktop notifications.

**Stop task** interrupts analysis and tool processes. Completed mux outputs are
kept and partial output is removed. In-place metadata edits finish their current
write before stopping. Keep backups of media you intend to modify.

## Download and requirements

Download standalone Windows, Linux, and macOS executables from
[GitHub Releases](https://github.com/itsmrma/SyncForge/releases).
They include Python and ffsubsync. Install **MKVToolNix** (`mkvmerge`, `mkvextract`,
`mkvpropedit`) and **FFmpeg** (`ffmpeg`), and make them available on `PATH`.

Linux bundles the Qt webview backend, which accounts for most of its larger
executable size. Windows and macOS use their platform webviews.

Linux notifications require a desktop notification service. macOS notifications
use `osascript` and may require enabling notifications for its script host.
System notification preferences apply; results also appear inside the app.

## Run from source

Install [uv](https://docs.astral.sh/uv/) and [Node.js](https://nodejs.org/), then:

```sh
git clone https://github.com/itsmrma/SyncForge.git
cd SyncForge
uv sync --locked
cd web
npm ci
npm run build
cd ..
uv run syncforge
```

`uv run python -m syncforge` and `uv run python main.py` start the same application.
Fonts are bundled locally and do not require a network connection.

## Development

Python application code is under `src/syncforge`, separated into `core`,
`features`, and `ui`. React source is under `web/src`, with separate components,
module definitions, and theme. Standalone build tooling is in `scripts`; regression
and distribution checks are in `tests`. Generated files are ignored by Git.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for structure, test, and build commands.

GitHub builds and browser-tests the frontend once on Linux, then shares it with
the three platform builds. Python/media regressions and bundled synchronizer
checks run on every platform; Linux also verifies an installed wheel. Release
assets publish after all checks pass. Desktop interaction is manually verified
on Windows; automated checks also run on Linux and macOS.

Inter fonts are distributed with their
[SIL Open Font License notice](web/public/Inter-LICENSE.txt), also included in builds.
