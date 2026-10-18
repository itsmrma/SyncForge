# Changelog

## 3.2 - Power-User QoL Suite, Keyboard Shortcuts & Foreground-Aware Completion Toast

- **Quick Media Inspector & Recent Paths History**: Add an automatic media inspector badge under Target/Source path inputs showing MKV track counts (`Video`, `Audio`, `Subs`, `Fonts`, file size) or folder batch counts (`X MKVs`, `Y Subs`), alongside a recent paths history dropdown (`Recent paths`) for instant one-click reuse and targeted dropzone badges during file drag-and-drop.
- **Batch Matcher Slot Shifting & Episode Diagnostics**: Add one-click `Shift down from row X` (`Empty Slot (Skipped)`) and `Remove gap` actions to realign batches with missing specials/OVAs, plus automatic warning badges for duplicate episode numbers (`Duplicate: EXX`), missing episodes (`Missing: EXX`), and row episode mismatches (`Mismatch`).
- **Track Selection Presets & Visual Flag Badges**: Add `Invert selection` and `System + Original` quick-selection presets in the track selector modal, and highlight `Default` and `Forced` tracks with distinct icon badges.
- **Global Keyboard Shortcuts & Dedicated Settings Tab**: Add global keyboard shortcuts (`Ctrl+Enter` to launch, `Ctrl+Shift+R` to repeat last batch, `Ctrl+L` to toggle the console, `Ctrl+,` to open Settings, `Ctrl+1..6` to switch modules, `Esc` to dismiss notifications) and a new `Keyboard Shortcuts` reference tab inside the Settings dialog.
- **Foreground-Aware Completion Toast & Resizable Searchable Console**: Replace blocking success modals with a floating completion toast featuring a 5-second visual countdown bar that automatically pauses while the window is unfocused/in the background or hovered, and upgrade the Developer Console with inline text search, match counter, `Clear Logs`, and vertical drag-to-resize / expand controls.
