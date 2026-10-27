# Changelog

## 3.5.3 - Windows Installer & Automatic Updates

- **Separate Windows Downloads**: Releases now include an NSIS installer (`SyncForge-Windows-3.5.3-setup.exe`) and a clearly named portable executable (`SyncForge-Windows-3.5.3-portable.exe`). Linux, macOS, and standalone CLI distribution remain unchanged.
- **Automatic Updates**: The Windows installer edition checks GitHub Releases at startup and every four hours, downloads signed updates in the background, and shows a persistent notification when ready. Automatic downloads can be disabled in Settings.
- **Restart to Install**: A new Application updates section at the bottom of General settings shows the installed version, download progress, release notes, retry controls, and Restart to install. Installation waits for media tasks to finish and the installer reopens SyncForge after updating.
- **Verified Release Packages**: Windows update installers are signed, verified before installation, and published with a `latest.json` update manifest. Portable and development builds explain how to download updates manually.
