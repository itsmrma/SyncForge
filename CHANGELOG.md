# Changelog

## 3.1 - Quality of Life Improvements & Production Bundle Fix

- **Input & Path UX**: Add native and HTML5 drag-and-drop onto path fields and the main window, quick clear ("X") buttons, "Show in Explorer / Finder" buttons on inputs and completion dialogs, remembered initial folders in native file/folder pickers, and a clearer output folder placeholder indicating it defaults to the source folder when left empty.
- **Batch Matcher Enhancements**: Add smart TV episode/season auto-matching (`Auto-Match Episodes`), quick `Reverse Order` and `Reset Order` actions, and per-row checkboxes to skip/exclude individual episodes without cancelling the batch.
- **Track Selection & Presets**: Add a real-time track search/filter bar (by ID, language, track name, or codec) and dynamic one-click presets for the user's system language, original language (`JPN`/`ENG`), and commentary/SDH exclusion.
- **Monitoring, Notifications & Persistence**: Add live elapsed time and ETA calculation, native OS taskbar/Dock progress bar integration, an optional Web Audio completion chime, and automatic `localStorage` persistence for user settings and the last active module.
- **Terminal & Production Hardening**: Add a one-click `Copy Logs` button, quick terminal filter chips (`All`, `Errors`, `Warnings`), disable WebView DevTools/Inspect in production builds, and fix standalone Windows/Linux Tauri CLI production asset embedding in GitHub Actions alongside a direct macOS `.dmg` image.


