# Changelog

## 3.5.2 - Codebase Audit, Tool Path Caching, Deduplication & Dynamic Metadata Preservation

- **Filesystem Tool Path Caching**: Cached external tool search directories in `processes.rs` (`CACHED_SEARCH_DIRS`) to eliminate thousands of redundant disk and filesystem scans during batch execution and pre-flight dependency checks.
- **Deduplication of Subtitle Format & Codec Utilities**: Unified duplicate subtitle extension, syncability detection, and `ffsubsync` argument construction into shared core helpers (`get_subtitle_extension_and_syncability` in `mkv_tools.rs`, `build_ffsubsync_args` in `utils.rs`) across `injection`, `sub_sync`, and `internal_sync`.
- **Dynamic Track Metadata & Language Preservation**: Fixed hardcoded Italian (`0:ita`) language overrides in `injection` and `sub_sync` to dynamically preserve the source track's native ISO/IETF language code, and preserved audio track names and default/forced flags during Opus audio re-encoding in `custom_merge`.
- **Zero-Allocation Progress & Label Parsing**: Optimized track label formatting and `mkvmerge`/`tqdm` percentage parsing with zero-copy borrows and byte-level needle matching.
- **Frontend Matcher & Track Selection Optimization**: Cached episode keys in `MatcherDialog` auto-match to reduce comparison complexity from $O(N^2)$ to $O(N)$, and cached word-boundary regular expressions in `InputDialog` track language matching.
- **Strict UI Cleanliness & Logging Compliance**: Removed all unicode emojis from terminal logging, backend CLI messages, and interactive prompts in strict accordance with project design guidelines.
