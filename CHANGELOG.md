# Changelog

## 3.0.0 - Native Rust & Tauri v2 Rewrite

- Rewrite the entire backend in native Rust (`src-tauri`) using Tauri v2 (`https://v2.tauri.app/`), eliminating the Python/PyInstaller/pywebview runtime.
- Implement pure-Rust audio waveform analysis and FFT cross-correlation (`hound` + `rustfft`) for WaveSync Injection without external Python/SciPy dependencies.
- Execute the standalone `ffsubsync` CLI executable directly for subtitle alignment alongside `mkvmerge`, `mkvextract`, `mkvpropedit`, and `ffmpeg`.
- Redesign the desktop GUI with a modern Rust/Tauri dark carbon-slate aesthetic, hairline borders, status indicators, and a unified Tauri v2 IPC bridge.
- Add dual real-time progress indicators: overall batch progress across multiple files and individual file progress showing the active file name.
- Package direct standalone executables without installers across all three platforms (`.app` for macOS, `.exe` for Windows, and direct executable for Linux).
- Port the full regression, cancellation, and end-to-end processing mode test suites to Rust (`cargo test`) alongside the Playwright browser suite.

