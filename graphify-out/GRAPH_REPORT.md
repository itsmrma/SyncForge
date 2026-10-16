# Graph Report - SyncForge  (2026-10-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 383 nodes · 884 edges · 24 communities (14 shown, 10 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 120 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f72eae5a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Api
- TaskError
- package.json
- backend.rs
- tauri.conf.json
- TaskProgress
- dependencies
- regressions.rs
- mkv_tools.rs
- processes.rs
- notifications.rs
- media_integration.rs
- MockBridge
- MockMediaBridge
- scripts
- with_task
- app.spec.js
- default.json
- main.rs

## God Nodes (most connected - your core abstractions)
1. `TaskError` - 41 edges
2. `Api` - 34 edges
3. `run_subprocess()` - 27 edges
4. `run_injection()` - 20 edges
5. `Track` - 19 edges
6. `TaskProgress` - 19 edges
7. `normalize_path()` - 19 edges
8. `log_line()` - 17 edges
9. `FrontendBridge` - 16 edges
10. `run_set_default_tracks()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `test_repeat_paths_and_single_file_default_output()` --calls--> `ask_directory()`  [INFERRED]
  src-tauri/tests/regressions.rs → src-tauri/src/core/utils.rs
- `test_stop_interrupts_silent_subprocess_and_allows_next_task()` --calls--> `run_subprocess()`  [INFERRED]
  src-tauri/tests/cancellation.rs → src-tauri/src/core/utils.rs
- `test_metadata_cache_and_notifications_commands()` --calls--> `get_tracks_info()`  [INFERRED]
  src-tauri/tests/regressions.rs → src-tauri/src/core/mkv_tools.rs
- `notify_task_finished()` --calls--> `log_line()`  [INFERRED]
  src-tauri/src/core/notifications.rs → src-tauri/src/core/utils.rs
- `test_file_picker_and_matcher_ordering()` --calls--> `match_files()`  [INFERRED]
  src-tauri/tests/regressions.rs → src-tauri/src/core/utils.rs

## Import Cycles
- 2-file cycle: `src-tauri/src/core/mkv_tools.rs -> src-tauri/src/core/utils.rs -> src-tauri/src/core/mkv_tools.rs`

## Communities (24 total, 10 thin omitted)

### Community 0 - "Api"
Cohesion: 0.07
Nodes (13): reset_file_progress(), get_version(), pick_file(), pick_folder(), resolve_input(), resolve_matcher(), run_module(), stop_task() (+5 more)

### Community 1 - "TaskError"
Cohesion: 0.20
Nodes (37): extract_audio_segment(), get_config(), VIDEO_EXT, format_track_label(), get_tracks_info(), select_track_interactive(), Track, windows_long_path() (+29 more)

### Community 2 - "package.json"
Cohesion: 0.08
Nodes (28): @emotion/react, @emotion/styled, framer-motion, @mui/icons-material, @mui/material, oxlint, react, react-dom (+20 more)

### Community 3 - "backend.rs"
Cohesion: 0.09
Nodes (24): CacheKey, CAPTURE_HOOK, clear_metadata_cache(), has_attachments(), metadata(), METADATA_CACHE, MkvMetadata, read_metadata_cached() (+16 more)

### Community 4 - "tauri.conf.json"
Cohesion: 0.09
Nodes (16): ASK_DIR_CB, ASK_INPUT_CB, ASK_MATCHER_CB, LOG_CB, parse_progress_percent(), PROGRESS_CB, PROGRESS_STATE, ProgressState (+8 more)

### Community 5 - "TaskProgress"
Cohesion: 0.15
Nodes (7): CONFIG, RuntimeConfig, set_config(), SUB_EXT, ApiInner, RepeatState, VERSION

### Community 6 - "dependencies"
Cohesion: 0.11
Nodes (18): app, security, windows, withGlobalTauri, build, beforeBuildCommand, beforeDevCommand, devUrl (+10 more)

### Community 7 - "regressions.rs"
Cohesion: 0.16
Nodes (4): check_cancelled(), current_task(), set_current_task(), TaskProgress

### Community 9 - "processes.rs"
Cohesion: 0.12
Nodes (15): devDependencies, oxlint, @playwright/test, @tauri-apps/cli, @types/react, @types/react-dom, vite, @vitejs/plugin-react (+7 more)

### Community 11 - "media_integration.rs"
Cohesion: 0.20
Nodes (5): with_task(), test_analysis_can_be_stopped_before_command_finishes(), test_cancelled_mux_removes_partial_file_and_preserves_previous_output(), test_stop_interrupts_silent_subprocess_and_allows_next_task(), test_subprocess_warnings_and_errors()

### Community 13 - "MockMediaBridge"
Cohesion: 0.22
Nodes (9): dependencies, @emotion/react, @emotion/styled, framer-motion, @mui/icons-material, @mui/material, react, react-dom (+1 more)

### Community 14 - "scripts"
Cohesion: 0.32
Nodes (5): find_audio_delay(), read_wav_samples(), std_dev(), MAX_AUDIO_DELAY_MS, test_audio_sync_waveform_delay_and_silence_detection()

### Community 16 - "app.spec.js"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 17 - "default.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

## Knowledge Gaps
- **9 isolated node(s):** `Cancelled`, `Message`, `@emotion/react`, `@emotion/styled`, `oxlint` (+4 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 141 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `mkv_tools.rs`, `notifications.rs`, `media_integration.rs`, `TaskProgress`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `run_subprocess()` (e.g. with `extract_audio_segment()` and `start_process()`) actually correct?**
  _`run_subprocess()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cancelled`, `Message`, `@emotion/react` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.06883116883116883 - nodes in this community are weakly interconnected._
- **Why does `FrontendBridge` connect `Api` to `mkv_tools.rs`, `notifications.rs`, `MockBridge`, `TaskProgress`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `run_injection()` (e.g. with `extract_audio_segment()` and `find_audio_delay()`) actually correct?**
  _`run_injection()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0797979797979798 - nodes in this community are weakly interconnected._