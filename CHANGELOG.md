# Changelog

## 2.0 - Structure Overhaul

- Consolidate the Python application into `src/syncforge`, with shared core
  utilities, processing features, and the desktop bridge in separate packages.
- Fix the installed `syncforge` command and add `python -m syncforge` support.
  Source, installed, and standalone builds now share the same entry point.
- Package the compiled frontend with the Python application; resolve resources
  independently of the current directory. Use the module dispatcher for
  ffsubsync so installed applications can also synchronize subtitles.
- Move standalone build tooling to `scripts`, use absolute build paths, and
  separate PyInstaller from runtime dependencies.
- Split React settings, pairing, track selection, and terminal components from
  the app, and move the theme and module definitions into dedicated files.
- Collapse the sidebar to an icon rail and expand it again with its previous
  width. Module tooltips and a settings shortcut remain available when collapsed.
- Repeat Last restores the confirmed source ordering in the pairing screen;
  removed files are omitted and new files are appended for review.
- Show a Go to end button while terminal scrolling is paused; clicking it
  jumps to the latest output and resumes automatic scrolling.
- Remove unused Vite styles, sample assets, template documentation, legacy
  launch code, and duplicate configuration. Bundle fonts for offline use.
- Build and test the frontend once in CI and share it across release builds.
  Keep Python/media tests and bundled synchronizer checks on all three systems,
  add a real wheel smoke test, cache dependencies, and avoid recompressing the
  executable artifacts.
