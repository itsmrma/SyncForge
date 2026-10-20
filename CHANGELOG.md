# Changelog

## 3.5.0 - Headless CLI (`syncforge-cli`), JSON Workflow Scripting & GUI CLI Generator

- **Muxing Progress Status**: Recognize native `mkvmerge` output so the active task displays muxing status instead of remaining on initialization.
- **Native Log Export**: Open a Save As dialog to choose the log file name and destination, with cancellation and write-error handling.
- **Compact Track Selection & Profile Alignment**: Remove individual language preset buttons while keeping the general selection controls, System + Original, and No Commentary/SDH; align the Dock Console and Configure actions in Active Profile.
- **Standalone Headless CLI (`syncforge-cli`)**: Introduced a lightweight standalone command-line executable compiled without GUI/WebView dependencies (`--no-default-features --bin syncforge-cli`). Supports all 7 media processing modules (`stream_manager`, `set_default`, `sync_subs`, `sync_subs_mkv`, `injection`, `custom_merge`, `internal_sync`) as well as media inspection (`inspect`), FFT waveform delay calculation (`delay`), `mpv` sync preview (`preview`), external tool verification (`tools`), and persistent configuration management (`config`).
- **Dedicated Audio & Subtitle Stream Filters**: Added dedicated `--keep-audio <IDS|LANG|all|none>` and `--keep-subs <IDS|LANG|all|none>` flags in `stream_manager`, enabling precise semantic filtering of audio and subtitle streams even in batch folders with mixed track signatures and shared language codes.
- **Inline Track Type Prefixes**: Supported inline `a:` (audio) and `s:` (subtitles) stream prefixes in `--keep-tracks` (e.g. `--keep-tracks a:jpn,s:ita`).
- **Dual Automation & Interactive Modes**: Supports 100% automated non-interactive execution via semantic CLI flags (`--keep-tracks`, `--keep-audio`, `--keep-subs`, `--audio-track`, `--sub-track`, `--default-audio`, `--default-sub`, `--forced-sub`, `-y`/`--yes`) with track selection by numeric ID or language code (`ita`, `eng`, `jpn`), while seamlessly falling back to interactive terminal (`stdin`) prompts when choices are omitted.
- **Multi-Job JSON Script Runner (`syncforge-cli script`)**: Execute single tasks or multi-step batch pipelines from declarative `.json` workflow files, with optional `--json` machine-readable output routing human logs to `stderr`.
- **GUI CLI Command & Script Exporter**: Added an integrated **CLI Command** builder modal in the desktop GUI (`CliExportDialog`) to generate, customize, copy, or download ready-to-run `syncforge-cli` shell commands and `.json` workflow scripts directly from active module paths and settings, including dedicated Keep Audio and Keep Subtitles controls.
- **MCP Server Stream Filtering**: Extended the Model Context Protocol (MCP) server tools (`syncforge_filter_and_clean_tracks` and `syncforge_run_batch`) to support semantic audio/subtitle language filters (`keep_audio`, `keep_subs`).
- **Headless CLI Dispatch in Standard Executable**: Passing CLI subcommands or module flags to the main `SyncForge` binary automatically attaches to the parent terminal console and runs in headless mode without launching the GUI window.
- **GitHub Actions Cross-Platform CLI Releases**: Automated compilation and publishing of standalone `syncforge-cli` binaries for Windows, Linux, and macOS alongside the desktop application bundles.

