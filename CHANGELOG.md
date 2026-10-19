# Changelog

## 3.4.1 - Self-Sync Audio & Subtitles, Live External Tools Detection & Video Timeline Logo

- **Self-Sync Audio & Subtitles Module (`internal_sync`)**: New 7th processing mode enabling automated audio delay calculation via pure-Rust FFT cross-correlation and subtitle alignment (`ffsubsync`) in-place within the same MKV file, without requiring external reference media.
- **Live External Tools Detection**: Added real-time binary availability status in Settings for `mkvmerge`, `mkvextract`, `mkvpropedit`, `ffmpeg`, `ffsubsync`, and `mpv` (supporting Windows console wrappers such as `mpv.com`). Program labels display green/red status badges with exact resolved executable paths and readiness counter.
- **Precision Video-Editing Logo**: Brand-new custom application logo featuring 35mm filmstrip sprockets, multi-track timeline panel (V1 video frames, A1 cyan audio waveform peaks, S1 emerald dialogue subtitle blocks), and playhead cursor with amber sync spark. Replaced across native app icons (.ico, .icns, all PNG sizes), favicon, and navigation rail.
- **Settings Dialog Dismissal & Animation Fix**: Prevented persistent active/pressed animation on the Settings button when dismissing the dialog with the `Esc` key.
- **Brag Launch Video & Skill Consolidation**: Updated launch video with the 7 core processing modes; unified all agent skills under `.agent/skills/`.
