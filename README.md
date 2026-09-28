# SyncForge 🎬⚒️

SyncForge is a powerful, modular, and smart batch-processing tool to manipulate, merge, and synchronize audio and subtitle tracks across multiple MKV video files. It acts as an orchestrator for tools like `MKVToolNix`, `ffmpeg`, and `ffsubsync`, applying intelligent grouping and automatic audio waveform synchronization using `scipy`.
## ⚠️ Disclaimer: Read Before Using!

> **IMPORTANT: USE AT YOUR OWN RISK**
> 
> Hey! Just a quick heads-up: I built SyncForge as a **personal project** to speed up my own video workflow. I'm sharing it here in case someone else finds it useful, but please keep in mind that **you use it entirely at your own risk**.
> 
> I am **not responsible** for any data loss, corrupted MKV files, ruined libraries, or hardware damage. Since this tool performs batch operations on large files, *please* make sure you have backups of your media before running it. If something breaks, you're on your own!
> 
> **Also note:** I developed and use this exclusively on **Windows**. While I provide Linux and macOS builds, I haven't tested them at all. They might work perfectly, or they might crash and burn.


## ✨ Features

- **Smart Batching**: Groups files based on their internal track structures (audio/subtitles) so you don't have to manually configure each file.
- **Waveform Audio Sync**: Analyzes audio waves using Fast Fourier Transform (`scipy`) to precisely calculate delays and automatically sync different audio sources.
- **Automatic Subtitle Sync**: Leverages `ffsubsync` to align out-of-sync subtitles automatically.
- **In-Place Modifications**: Set default/forced flags directly in the file metadata without slow remuxing (`mkvpropedit`).
- **Interactive UI Matcher**: Simple PyQt6-based interface to easily pair files from different folders before processing.
- **Opus Conversion**: On-the-fly conversion of extracted audio tracks to highly efficient Opus stereo format.

## 📦 Prerequisites

Ensure the following tools are installed and available in your system's `PATH`:

- **MKVToolNix** (`mkvmerge`, `mkvextract`, `mkvpropedit`)
- **FFmpeg** (`ffmpeg`)
- **ffsubsync** (Can be installed via pip: `pip install ffsubsync`)

## 🚀 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/itsmrma/SyncForge.git
   cd SyncForge
   ```

2. (Optional but recommended) Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```

3. Install the Python dependencies for advanced waveform audio sync:
   ```bash
   pip install -r requirements.txt
   ```
   *(If you don't install these, audio auto-sync will be disabled, but all subtitle syncing and standard merging features will still work).*

## 🎮 Usage

Run the main script to open the interactive command-line menu:

```bash
python main.py
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


