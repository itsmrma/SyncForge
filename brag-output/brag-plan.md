# Brag Plan: SyncForge

## What is this app?
SyncForge is a high-performance native desktop media workbench written in Rust (Tauri v2 + React 19 + MUI) that losslessly merges, strips, and synchronizes video, audio, and subtitle streams using MKVToolNix, FFmpeg, and pure-Rust FFT waveform cross-correlation (WaveSync).

## The angle
Desktop media editing shouldn't mean fiddling with cryptic CLI flags, desynced audio tracks, or hours of lossy re-encoding. SyncForge brings high-precision track management, instant TV episode auto-matching, and pure-Rust FFT audio synchronization into an ultra-slick, modern carbon-slate desktop app.

## Hook (first 2-3 seconds)
A stark, high-contrast headline slamming the perennial video pain point:
**"Desynced audio. Missing subtitles. Cryptic CLI flags."**
Instantly shattering into the sleek SyncForge desktop interface with glowing indigo and cyan accents: **"Media remuxing, forged for speed."**

## Key moments (the middle)
- **Track Inspector & Smart Filters**: Visual MKVToolNix track badges (`ID 0`, `ID 1`), instant 1-click presets (`Only ITA`, `Only ENG`, `No Commentary/SDH`) that isolate dialogue in a single tap.
- **Smart TV Episode Auto-Matcher**: Drag-and-drop batch pairing screen that automatically matches `S01E01` target videos to corresponding audio/subtitle files.
- **WaveSync FFT Engine**: Pure-Rust cross-correlation audio waveform analysis that calculates exact sub-second delay without re-encoding video.

## Outro / punchline
A sharp animated brand lockup:
**"SyncForge"**
**"Lossless media synchronization. Native Rust & Tauri v2."**
Punchline / CTA: **"Free & Open Source on GitHub."**

## User flow worth showing
1. **Entry & Selection**: Select WaveSync Injection, drop target and source video folders.
2. **Key Action**: Auto-match 12 episodes in one click, filter unwanted commentary/SDH tracks.
3. **Result**: Native Rust FFT waveform analysis locks delays in milliseconds, losslessly outputting clean MKVs.

## Tone
- Preset: `polished`
- Creative direction: Sleek high-tech desktop workbench launch
- Interpretation: Fast, precise, and premium. Let the UI craftsmanship and native Rust performance speak for itself with crisp typography, glowing gradients, and zero fluff.

## Format: landscape — 1920x1080
## Duration: 20.0 seconds

## Visual identity (from the project)
- Background: `#090C12` (deep carbon obsidian) with `#0F141F` card backgrounds
- Primary Accent: `#6366F1` (electric indigo) and `#818CF8`
- Secondary Accent: `#38BDF8` (sky cyan) and `#34D399` (emerald green)
- Text: `#F1F5F9` (primary text), `#94A3B8` (secondary text)
- Display font: `Inter`, -apple-system, BlinkMacSystemFont, sans-serif
- Body font: `Inter`, monospace for track IDs and terminal output
- Strongest visual elements: 
  - Monospace track chip badges (`ID 0`, `ID 1`, `Audio · ENG`, `Subtitles · ITA`)
  - Glowing gradient action buttons (`linear-gradient(135deg, #6366F1, #4F46E5)`)
  - Audio waveform cross-correlation visualization
  - Episode pairing pills (`S01E01`)

## Share copy (draft)
Meet SyncForge: a native desktop media workbench built with Rust & Tauri v2 to losslessly merge, filter, and synchronize video, audio, and subtitles with built-in FFT waveform cross-correlation.

## Audio direction
- Role: Driving, modern electronic bed with crisp, tactile desktop UI accents
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: Starts at 0.0s, steady volume at 0.35, smooth fade-out over the final 1.5s
- Music cue guidance: 109.96 BPM; Strong cues at 8.74s, 13.11s, 17.47s; beat intervals ~0.54s
- Audio-reactive treatment: Subtle; background ambient radial glow and WaveSync waveform pulse respond gently to music energy
- SFX posture: Restrained, crisp UI clicks and subtle soft drops on track filtering and auto-matching
- Audio-coupled moments:
  - Scene 1 (0.2s): Soft interface drop for title card
  - Scene 2 (4.5s): UI click when "No Commentary/SDH" preset filters tracks
  - Scene 3 (8.8s): Crisp interface switch / chime when "Auto-Match Episodes" pairs files
  - Scene 4 (13.1s): Resonant impact bell when WaveSync FFT locks the audio delay
  - Scene 5 (17.2s): Soft logo landing accent
- Restraint rule: No harsh buzzers, no cheesy cartoon sounds; keep every sound grounded in modern desktop UI feel

## Storyboard

### Scene 1 — The Hook & Reveal — 3.8s (0.00s - 3.80s)
- **Visuals**: Dark carbon canvas. High-impact headline: "Desynced audio. Missing subtitles. Cryptic CLI flags." slams into focus. Then transforms into the SyncForge Desktop hero card with glowing indigo ambient light and module chips: "Stream Manager", "WaveSync Injection", "Sync Subs".
- **Headline text**: "SYNCFORGE // Desktop Media Workbench"
- **Sequential/interaction**: Module pills highlight sequentially (Stream Manager → WaveSync → Sub Sync).
- **Audio intent**: Fast hook drawing attention, energetic electronic bed rolls in.
- **Audio-coupled idea**: Soft entry drop at 0.3s.
- **Music**: Upbeat electronic bed begins (`vol-12`).
- **Transition mood**: Clean wipe / scale → Scene 2 (at 3.8s)

### Scene 2 — Track Inspector & 1-Click Filters — 4.4s (3.80s - 8.20s)
- **Visuals**: Realistic recreation of SyncForge's InputDialog track inspector. Displays MKV audio and subtitle tracks with `ID 0`, `ID 1`, language badges (`ENG`, `ITA`), and codec info (`E-AC-3`, `SubRip`). A simulated cursor clicks "No Commentary/SDH" and unwanted commentary tracks fade out while target dialogue tracks illuminate in emerald green (`#34D399`).
- **Headline text**: "One-Click Track Filtering"
- **Sequential/interaction**: Cursor hovers and clicks "No Commentary / SDH", instantly filtering list.
- **Audio intent**: Satisfying tactical control, snappy UI response.
- **Audio-coupled idea**: UI click at 4.5s.
- **Transition mood**: Slide right → Scene 3 (at 8.2s, beat-locked near 8.74s)

### Scene 3 — Drag & Drop TV Episode Auto-Matcher — 4.4s (8.20s - 12.60s)
- **Visuals**: The MatcherDialog pairing screen. Target video files (`Show.S01E01.1080p.mkv`) on the left, unordered source audio files on the right. User clicks "Auto-Match Episodes" — the right column smoothly reorders into perfect `S01E01`, `S01E02`, `S01E03` alignment with glowing cyan connection lines.
- **Headline text**: "Smart Batch Episode Matching"
- **Sequential/interaction**: Sources list rearranges with Framer-style smooth reordering animation.
- **Audio intent**: Effortless organization, smart automation feeling.
- **Audio-coupled idea**: Soft interface switch at 8.8s (near 8.74s strong cue).
- **Transition mood**: Fast slide up → Scene 4 (at 12.6s, leading into 13.11s strong cue)

### Scene 4 — WaveSync Pure-Rust FFT Engine — 4.2s (12.60s - 16.80s)
- **Visuals**: Centerpiece demonstration: WaveSync Injection. Dual audio waveforms (Target Audio vs Source Audio) slide across each other. The Rust FFT cross-correlation curve peaks instantly: "Delay Detected: +420 ms (Confidence: 99.8%)". Progress meter jumps: "Lossless Remux Complete in 1.4s".
- **Headline text**: "WaveSync // Pure-Rust FFT Audio Alignment"
- **Sequential/interaction**: Waveforms shift, peak locks, checkmark badge appears.
- **Audio intent**: High-tech precision and speed.
- **Audio-coupled idea**: Resonant impact chime at 13.11s (strong cue!).
- **Transition mood**: Smooth crossfade with scale → Scene 5 (at 16.8s)

### Scene 5 — Outro & Brag Punchline — 3.2s (16.80s - 20.00s)
- **Visuals**: Glowing SyncForge logo mark with electric indigo background glow.
  - Title: **SyncForge**
  - Subtitle: **Native Rust & Tauri v2 Desktop App**
  - Feature tags: `Pure Rust FFT` · `MKVToolNix` · `FFmpeg` · `Lossless Mux`
  - Tagline: **Fast. Lossless. Open Source.**
- **Sequential/interaction**: Logo scales in with subtle glow, badges fade in on beat.
- **Audio intent**: Triumphant, clean finish; music fades gracefully.
- **Audio-coupled idea**: Soft bell at 17.47s (strong cue).
- **Music**: Fade out 18.5s - 20.0s.

**Music mood for this video:** Modern upbeat electronic groove (110 BPM)
**Audio summary:** Starts confident with an ambient intro, pulses steadily during track filtering and episode matching, hits a resonant peak on the WaveSync FFT lock, and resolves cleanly on the logo outro.
