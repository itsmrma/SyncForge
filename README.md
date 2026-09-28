# SyncForge 🎬⚒️

SyncForge is a powerful, modular, and smart batch-processing tool to manipulate, merge, and synchronize audio and subtitle tracks across multiple MKV video files. It acts as an orchestrator for tools like `MKVToolNix`, `ffmpeg`, and `ffsubsync`, applying intelligent grouping and automatic audio waveform synchronization using `scipy`.
## 🛠️ Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/itsmrma/SyncForge.git
   cd SyncForge
   ```

2. Install [uv](https://docs.astral.sh/uv/), a blazingly fast Python package manager.

3. Sync the environment and install dependencies:
   ```bash
   uv sync
   ```
   *(This will automatically create a virtual environment and install PyQt6, numpy, and scipy).*

## 🚀 Usage

To launch the GUI, simply run:
```bash
uv run python main.py
```

Or, if you prefer to compile it into a standalone executable (no Python required to run later):
```bash
uv run python build.py
```

### Available Modes:

1. **Stream Manager (Smart Batch)**: Select a folder of videos, strip unwanted audio/subs, and optionally convert audio to Opus.
2. **Set Default and Forced Tracks (In-Place)**: Quickly change default/forced flags for tracks inside MKV files without remuxing.
3. **Sync External Subtitles**: Sync standard `.srt` files to your video files.
4. **Sync Subtitles from another MKV**: Extract subtitles from a source MKV, synchronize them, and inject them into a target MKV.
5. **Inject Source into Target (Audio WaveSync + Sub Sync)**: The ultimate dubbing/sync tool. Extract audio and subs from a source file, automatically sync them to a high-quality RAW target video, and merge them all together.
6. **Custom Merge**: Grab specific audio/sub tracks from a "Folder A" and combine them with tracks from a "Folder B".

## 🛠️ Performance Improvements Made

- **MKVToolNix Output Caching**: Fetching MKV tracks info is heavily cached using `functools.lru_cache` to drastically reduce repeated `mkvmerge -J` calls on identical files during analysis loops.
- **Modular Architecture**: Operations are decoupled. Loading heavy libraries (`scipy`, `numpy`) only delays features that actively need them, keeping startup fast.
- **Clean Temp Management**: Temporary extractions are immediately cleaned up after successful muxing to preserve disk IO and space.

## 📄 License
This project is open-source and free to use.



