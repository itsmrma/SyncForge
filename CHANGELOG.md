# Changelog

## 2 — Structure Overhaul

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

## 1.7.1

- Replace browser prompts with styled in-app popups for track selection and
  confirmation. Track cards show the exact ID, language, codec, name, and flags.
- Select tracks with checkboxes or radio buttons; provide explicit actions for
  keeping all/none, skipping a group, and leaving default/forced flags unchanged.
- Show completion, warning, failure, and stop results in an in-app popup while
  retaining optional desktop notifications.
- Add Stop task to the main screen and interactive dialogs. Interrupt analysis
  and active tool processes, including FFmpeg children launched by ffsubsync.
- Write muxed outputs to temporary files and publish them only after completion.
  Stopping removes partial output and preserves existing completed files.
  In-place metadata edits finish their current short write before stopping.
- Centralize hidden process launch settings and apply them to library-spawned
  FFmpeg processes on Windows, avoiding flashing console windows.
- Add regression coverage for popup selection, stop during prompts and silent
  commands, cancelled mux cleanup, and Windows process flags.
- Ignore generated build specifications, caches, logs, test reports, scratch
  files, and temporary processing outputs.

## 1.7

- Desktop notifications when a task completes, completes with warnings, or fails.
  Windows uses native toast notifications, Linux uses libnotify or the desktop
  D-Bus notification service, and macOS uses the system AppleScript notification
  command. Notifications are enabled by default and can be disabled in Settings.
- Task results also appear inside the app. Cancelled and empty tasks do not
  produce a success notification.
- Scrolling up in the terminal pauses automatic scrolling. Returning to the
  bottom resumes it. New output preserves the text and position being read.
- Fix subtitle-only WaveSync injection and use a valid Matroska container for
  intermediate audio. Temporary extractions are isolated and cleaned on errors.
- Preserve the format of external subtitles and use the VobSub index when muxing.
- Validate track IDs before editing flags or removing tracks, and refresh cached
  metadata after files change.
- Propagate external tool failures to the task result; recognize MKVToolNix's
  warning exit code. Detect unusable audio rather than reporting a zero delay.
- Restore the Launch button after backend errors, prevent overlapping tasks,
  and release pairing dialogs when cancelled or when the window closes.
- Include ffsubsync in source installs and standalone builds. Bundle the Qt
  webview backend on Linux and use relative frontend asset paths.
- Add Python/media and browser regression tests to all three release builds,
  plus a smoke test of the bundled subtitle synchronizer.
