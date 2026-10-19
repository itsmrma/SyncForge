# Changelog

## 3.4 - Modern Developer Console, OpenSubtitles Integration & Model Context Protocol (MCP)

- **Modern Developer Console Redesign (`Terminal`)**: Declutter the terminal toolbar into an icon-first developer workstation console. Group log content actions (Copy with animated green checkmark confirmation, Download, and Clear) and window layout controls (Dock to Side / Bottom Drawer, Expand / Compact, Hide with `Ctrl+L` / `⌘L` tooltip) separated by a hairline divider. Unify log level filtering into a single recessed segmented pill control (`All` | `Errors` | `Warnings`), integrate search with in-box clear adornment and match counter, and refine the floating *"Go to end"* jump action to a full-pill shape (`rounded.full`, `borderRadius: 999`) matching DESIGN.md.
- **OpenSubtitles.com API Integration**: Add secure API key and JWT authentication management in Settings (`open_subtitles_api_key`, `open_subtitles_token`) with masked password visibility toggle, clear button adornment, and persistent configuration in Rust backend and frontend bridge.
- **Model Context Protocol (MCP) Server**: Full native MCP server integration (`mcp/index.js`) exposing all SyncForge processing engines, file pickers, inspection, and batch matching capabilities directly to external AI agents (Claude Desktop, Cursor, Cline).
