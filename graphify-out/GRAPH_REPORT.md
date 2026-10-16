# Graph Report - SyncForge  (2026-10-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 421 nodes · 988 edges · 26 communities (16 shown, 10 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 131 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `97e94e04`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Api
- App.jsx
- TaskError
- utils.rs
- processes.rs
- backend.rs
- tauri.conf.json
- TaskProgress
- regressions.rs
- media_integration.rs
- mkv_tools.rs
- MockBridge
- dependencies
- MockMediaBridge
- devDependencies
- scripts
- app.spec.js
- default.json
- with_task
- .oxlintrc.json
- syncforge

## God Nodes (most connected - your core abstractions)
1. `TaskError` - 44 edges
2. `Api` - 40 edges
3. `run_subprocess()` - 30 edges
4. `run_injection()` - 21 edges
5. `Track` - 20 edges
6. `log_line()` - 20 edges
7. `FrontendBridge` - 19 edges
8. `TaskProgress` - 19 edges
9. `normalize_path()` - 19 edges
10. `run_stream_manager()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `test_repeat_paths_and_single_file_default_output()` --calls--> `ask_directory()`  [INFERRED]
  src-tauri/tests/regressions.rs → src-tauri/src/core/utils.rs
- `test_stop_interrupts_silent_subprocess_and_allows_next_task()` --calls--> `run_subprocess()`  [INFERRED]
  src-tauri/tests/cancellation.rs → src-tauri/src/core/utils.rs
- `run_injection()` --calls--> `has_attachments()`  [INFERRED]
  src-tauri/src/features/injection.rs → src-tauri/src/core/mkv_tools.rs
- `metadata()` --calls--> `normalize_path()`  [INFERRED]
  src-tauri/src/core/mkv_tools.rs → src-tauri/src/core/utils.rs
- `read_metadata_cached()` --calls--> `capture_command()`  [INFERRED]
  src-tauri/src/core/mkv_tools.rs → src-tauri/src/core/processes.rs

## Import Cycles
- 2-file cycle: `src-tauri/src/core/mkv_tools.rs -> src-tauri/src/core/utils.rs -> src-tauri/src/core/mkv_tools.rs`

## Communities (26 total, 10 thin omitted)

### Community 0 - "Api"
Cohesion: 0.06
Nodes (15): log_raw(), reset_file_progress(), get_version(), pick_file(), pick_folder(), resolve_input(), resolve_matcher(), run_module() (+7 more)

### Community 1 - "App.jsx"
Cohesion: 0.07
Nodes (38): @emotion/react, @emotion/styled, framer-motion, @mui/icons-material, @mui/material, oxlint, react, react-dom (+30 more)

### Community 2 - "TaskError"
Cohesion: 0.16
Nodes (42): convert_audio_file_to_opus(), convert_audio_track_to_opus(), extract_audio_segment(), find_audio_delay(), read_wav_samples(), std_dev(), get_config(), VIDEO_EXT (+34 more)

### Community 3 - "utils.rs"
Cohesion: 0.08
Nodes (19): ASK_DIR_CB, ASK_INPUT_CB, ASK_MATCHER_CB, LOG_CB, parse_progress_percent(), PROGRESS_CB, PROGRESS_STATE, ProgressState (+11 more)

### Community 4 - "processes.rs"
Cohesion: 0.12
Nodes (18): build_linux_notify_send_command(), build_macos_notification_command(), NOTIFY_HOOK, notify_task_finished(), send_notification(), set_notify_hook(), capture_command(), CompletedProcess (+10 more)

### Community 5 - "backend.rs"
Cohesion: 0.13
Nodes (8): CONFIG, MAX_AUDIO_DELAY_MS, RuntimeConfig, set_config(), SUB_EXT, ApiInner, RepeatState, VERSION

### Community 6 - "tauri.conf.json"
Cohesion: 0.11
Nodes (18): app, security, windows, withGlobalTauri, build, beforeBuildCommand, beforeDevCommand, devUrl (+10 more)

### Community 7 - "TaskProgress"
Cohesion: 0.15
Nodes (3): check_cancelled(), current_task(), TaskProgress

### Community 9 - "media_integration.rs"
Cohesion: 0.15
Nodes (3): clear_metadata_cache(), test_stop_interrupts_silent_subprocess_and_allows_next_task(), test_all_six_processing_modes_end_to_end()

### Community 10 - "mkv_tools.rs"
Cohesion: 0.27
Nodes (8): CacheKey, CAPTURE_HOOK, has_attachments(), metadata(), METADATA_CACHE, MkvMetadata, read_metadata_cached(), set_capture_hook()

### Community 12 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, @emotion/react, @emotion/styled, framer-motion, @mui/icons-material, @mui/material, react, react-dom (+1 more)

### Community 14 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, oxlint, @playwright/test, @tauri-apps/cli, @types/react, @types/react-dom, vite, @vitejs/plugin-react

### Community 15 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, tauri, test

### Community 17 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 18 - "with_task"
Cohesion: 0.33
Nodes (4): set_current_task(), with_task(), test_cancelled_mux_removes_partial_file_and_preserves_previous_output(), test_subprocess_warnings_and_errors()

### Community 19 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

## Knowledge Gaps
- **8 isolated node(s):** `@emotion/react`, `@emotion/styled`, `oxlint`, `@tauri-apps/cli`, `@types/react` (+3 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 145 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `regressions.rs`, `media_integration.rs`, `backend.rs`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `run_subprocess()` (e.g. with `convert_audio_file_to_opus()` and `convert_audio_track_to_opus()`) actually correct?**
  _`run_subprocess()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@emotion/react`, `@emotion/styled`, `oxlint` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.056265984654731455 - nodes in this community are weakly interconnected._
- **Why does `FrontendBridge` connect `Api` to `backend.rs`, `regressions.rs`, `media_integration.rs`, `MockBridge`, `MockMediaBridge`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `run_injection()` (e.g. with `convert_audio_file_to_opus()` and `extract_audio_segment()`) actually correct?**
  _`run_injection()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._