# Changelog

## 3.5.3 - Cross-Platform Automatic Updates & Windows Installer

- **Security Fixes**: Backported the upstream GLib string-iterator memory-safety fix for Tauri's Linux GTK3 backend (RUSTSEC-2024-0429). CLI export now uses shell-specific literal quoting for Bash/POSIX sh and PowerShell 7.3+, preserving backslashes and quotes and preventing command expansion in paths and track selectors. Refreshed packages retain version 3.5.3.
- **New SyncForge Logo**: Adopted the stream-merge and audio-spectrum logo throughout the app sidebar, favicon, desktop application and installer icons, and project previews. Refreshed release packages retain version 3.5.3.
- **Separate Windows Downloads**: Releases now include an NSIS installer (`SyncForge-Windows-3.5.3-setup.exe`) and a clearly named portable executable (`SyncForge-Windows-3.5.3-portable.exe`). Standalone CLI downloads remain available.
- **Cross-Platform Automatic Updates**: The Windows installer edition, macOS app bundle, and Linux AppImage check GitHub Releases at startup and every four hours, download signed updates in the background, and show a persistent notification when ready. Automatic downloads can be disabled in Settings.
- **Restart to Install**: A new Application updates section at the bottom of General settings shows the installed version, download progress, release notes, retry controls, and Restart to install. Installation waits for media tasks to finish and restarts the app after updating.
- **Universal macOS App**: The app supports Intel and Apple Silicon. Ad-hoc code signing and signed updater archives require no Apple Developer account; the app remains unnotarized and Gatekeeper can require manual approval.
- **Linux AppImage**: Added an executable AppImage for automatic updates, while retaining the standalone Linux binary. Portable media tools are detected beside the AppImage file and external processes use system libraries instead of bundled AppImage libraries.
- **Verified Release Packages**: Windows installers, macOS archives, and Linux AppImages are signed, verified before installation, and published with one complete `latest.json` manifest. Windows portable, standalone Linux, and development builds explain how to update manually.
- **Universal macOS Verification**: Corrected the `lipo` argument order so release packaging verifies that the app and standalone CLI contain both Intel and Apple Silicon architectures.
