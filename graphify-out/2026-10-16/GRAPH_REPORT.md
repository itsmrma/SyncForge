# Graph Report - SyncForge  (2026-10-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 371 nodes · 855 edges · 25 communities (15 shown, 10 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 112 edges (avg confidence: 0.85)
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
- .oxlintrc.json
- syncforge

## God Nodes (most connected - your core abstractions)
1. `TaskError` - 41 edges
2. `Api` - 33 edges
3. `run_subprocess()` - 25 edges
4. `Track` - 19 edges
5. `TaskProgress` - 19 edges
6. `normalize_path()` - 19 edges
7. `run_injection()` - 19 edges
8. `log_line()` - 17 edges
9. `FrontendBridge` - 15 edges
10. `get_tracks_info()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `test_audio_sync_waveform_delay_and_silence_detection()` --calls--> `find_audio_delay()`  [INFERRED]
  src-tauri/tests/regressions.rs → src-tauri/src/core/audio_sync.rs
- `test_repeat_paths_and_single_file_default_output()` --calls--> `ask_directory()`  [INFERRED]
  src-tauri/tests/regressions.rs → src-tauri/src/core/utils.rs
- `test_stop_interrupts_silent_subprocess_and_allows_next_task()` --calls--> `run_subprocess()`  [INFERRED]
  src-tauri/tests/cancellation.rs → src-tauri/src/core/utils.rs
- `test_metadata_cache_and_notifications_commands()` --calls--> `get_tracks_info()`  [INFERRED]
  src-tauri/tests/regressions.rs → src-tauri/src/core/mkv_tools.rs
- `notify_task_finished()` --calls--> `log_line()`  [INFERRED]
  src-tauri/src/core/notifications.rs → src-tauri/src/core/utils.rs

## Import Cycles
- 2-file cycle: `src-tauri/src/core/mkv_tools.rs -> src-tauri/src/core/utils.rs -> src-tauri/src/core/mkv_tools.rs`

## Communities (25 total, 10 thin omitted)

### Community 0 - "Api"
Cohesion: 0.08
Nodes (12): get_version(), pick_file(), pick_folder(), resolve_input(), resolve_matcher(), run_module(), stop_task(), TauriWindowBridge (+4 more)

### Community 1 - "TaskError"
Cohesion: 0.16
Nodes (39): extract_audio_segment(), find_audio_delay(), read_wav_samples(), std_dev(), get_config(), MAX_AUDIO_DELAY_MS, VIDEO_EXT, format_track_label() (+31 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (28): @emotion/react, @emotion/styled, framer-motion, @mui/icons-material, @mui/material, oxlint, react, react-dom (+20 more)

### Community 3 - "backend.rs"
Cohesion: 0.07
Nodes (17): CONFIG, RuntimeConfig, set_config(), SUB_EXT, ASK_DIR_CB, ASK_INPUT_CB, ASK_MATCHER_CB, LOG_CB (+9 more)

### Community 4 - "tauri.conf.json"
Cohesion: 0.11
Nodes (18): app, security, windows, withGlobalTauri, build, beforeBuildCommand, beforeDevCommand, devUrl (+10 more)

### Community 5 - "TaskProgress"
Cohesion: 0.15
Nodes (3): check_cancelled(), current_task(), TaskProgress

### Community 6 - "dependencies"
Cohesion: 0.11
Nodes (17): dependencies, @emotion/react, @emotion/styled, framer-motion, @mui/icons-material, @mui/material, react, react-dom (+9 more)

### Community 7 - "regressions.rs"
Cohesion: 0.13
Nodes (3): test_audio_sync_waveform_delay_and_silence_detection(), TEST_LOCK, test_repeat_paths_and_single_file_default_output()

### Community 8 - "mkv_tools.rs"
Cohesion: 0.21
Nodes (11): CacheKey, CAPTURE_HOOK, clear_metadata_cache(), has_attachments(), metadata(), METADATA_CACHE, MkvMetadata, read_metadata_cached() (+3 more)

### Community 9 - "processes.rs"
Cohesion: 0.22
Nodes (7): capture_command(), CompletedProcess, external_tool_environment(), external_tool_environment_from(), start_process(), stop_process_tree(), test_analysis_can_be_stopped_before_command_finishes()

### Community 10 - "notifications.rs"
Cohesion: 0.24
Nodes (8): build_linux_notify_send_command(), build_macos_notification_command(), NOTIFY_HOOK, notify_task_finished(), send_notification(), set_notify_hook(), test_metadata_cache_and_notifications_commands(), test_task_lifecycle_and_notifications()

### Community 14 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, tauri, test

### Community 15 - "with_task"
Cohesion: 0.33
Nodes (4): set_current_task(), with_task(), test_cancelled_mux_removes_partial_file_and_preserves_previous_output(), test_subprocess_warnings_and_errors()

### Community 17 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 18 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

## Knowledge Gaps
- **9 isolated node(s):** `Cancelled`, `Message`, `@emotion/react`, `@emotion/styled`, `oxlint` (+4 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 138 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `media_integration.rs`, `backend.rs`, `regressions.rs`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `run_subprocess()` (e.g. with `extract_audio_segment()` and `start_process()`) actually correct?**
  _`run_subprocess()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cancelled`, `Message`, `@emotion/react` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.07616892911010557 - nodes in this community are weakly interconnected._
- **Why does `TaskError` connect `TaskError` to `Api`, `backend.rs`, `TaskProgress`, `mkv_tools.rs`, `processes.rs`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08773784355179703 - nodes in this community are weakly interconnected._
- **Why does `FrontendBridge` connect `Api` to `backend.rs`, `regressions.rs`, `media_integration.rs`, `MockBridge`, `MockMediaBridge`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._