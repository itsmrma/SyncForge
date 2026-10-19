# Changelog

## 3.5.0 - Headless CLI (`syncforge-cli`), JSON Workflow Scripting & GUI CLI Generator

- **Standalone Headless CLI (`syncforge-cli`)**: Introduced a lightweight standalone command-line executable compiled without GUI/WebView dependencies (`--no-default-features --bin syncforge-cli`). Supports all 7 media processing modules (`stream_manager`, `set_default`, `sync_subs`, `sync_subs_mkv`, `injection`, `custom_merge`, `internal_sync`) as well as media inspection (`inspect`), FFT waveform delay calculation (`delay`), `mpv` sync preview (`preview`), external tool verification (`tools`), and persistent configuration management (`config`).
- **Dual Automation & Interactive Modes**: Supports 100% automated non-interactive execution via semantic CLI flags (`--keep-tracks`, `--audio-track`, `--sub-track`, `--default-audio`, `--default-sub`, `--forced-sub`, `-y`/`--yes`) with track selection by numeric ID or language code (`ita`, `eng`, `jpn`), while seamlessly falling back to interactive terminal (`stdin`) prompts when choices are omitted.
- **Multi-Job JSON Script Runner (`syncforge-cli script`)**: Execute single tasks or multi-step batch pipelines from declarative `.json` workflow files, with optional `--json` machine-readable output routing human logs to `stderr`.
- **GUI CLI Command & Script Exporter**: Added an integrated **CLI Command** builder modal in the desktop GUI (`CliExportDialog`) to generate, customize, copy, or download ready-to-run `syncforge-cli` shell commands and `.json` workflow scripts directly from active module paths and settings.
- **Headless CLI Dispatch in Standard Executable**: Passing CLI subcommands or module flags to the main `SyncForge` binary automatically attaches to the parent terminal console and runs in headless mode without launching the GUI window.
- **GitHub Actions Cross-Platform CLI Releases**: Automated compilation and publishing of standalone `syncforge-cli` binaries for Windows, Linux, and macOS alongside the desktop application bundles.

