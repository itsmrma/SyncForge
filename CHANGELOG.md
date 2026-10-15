# Changelog

## 2.1.1 - Contextual Settings & Clarifications

- Automatically disable and grey out settings in the sidebar that do not apply to the active module (Auto-sync Audio, Auto-sync Subs, Max Offset limit).
- Add contextual annotations and tooltips to disabled settings indicating which module they belong to (e.g., WaveSync Injection only).
- Clarify that Custom Track Merge performs direct lossless remuxing without altering timing or audio/subtitle synchronization.
- Print an informational notice in the terminal when launching Custom Track Merge.
- Add browser test coverage for module-specific settings disabling and annotations.

## 2.1 - Single File Selection

- Select an individual video or a folder for the target in every processing mode.
- Select an individual source video or subtitle file, or continue using folders
  for batch processing. File and folder inputs can be combined.
- Add separate File and Folder buttons with video/subtitle filters in the native
  file picker. A selected file processes only that file, leaving neighbours alone.
- When the output folder is empty, save results in the target file's parent folder
  or the selected target folder. Explicit output folders continue to work.
- Repeat Last restores selected files as well as folders and the confirmed
  pairing order; missing inputs and unsupported file types report clear errors.
- Verify single-file processing in all six modes with real media, alongside
  browser checks for file selection, folder selection, cancellation, and repeat.
