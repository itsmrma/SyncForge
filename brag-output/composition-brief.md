# Hyperframes Composition Brief: SyncForge

## Objective
Create a short, polished, shareable launch video for SyncForge.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20.0 seconds

## Source Material
- Project root: `C:\Users\mbena\Documents\SyncForge`
- Primary files read: `README.md`, `AGENTS.md`, `web/src/theme.js`, `web/src/modules.js`, `web/src/App.jsx`, `web/src/components/InputDialog.jsx`, `web/src/components/MatcherDialog.jsx`
- Product name: SyncForge
- Tagline / strongest claim: "Losslessly merge, filter, and synchronize video, audio, and subtitles with built-in FFT waveform cross-correlation."
- Key UI or visual moments to recreate:
  1. Desktop workspace module bar with icons and glowing badges
  2. InputDialog track selector with MKVToolNix IDs (`ID 0`, `ID 1`), codec chips, and 1-click presets (`No Commentary/SDH`)
  3. MatcherDialog TV episode auto-matcher (`S01E01` pairs)
  4. WaveSync Rust FFT cross-correlation delay detection (+420 ms peak)
- Copy that must appear verbatim:
  - "SyncForge"
  - "Stream Manager"
  - "WaveSync Injection"
  - "Auto-Match Episodes"
  - "No Commentary/SDH"
  - "Native Rust & Tauri v2"

## Creative Direction
- Tone preset: `polished`
- Creative direction: Sleek high-tech desktop workbench launch
- Interpretation: Fast, precise, and premium. Let the UI craftsmanship and native Rust performance shine with carbon-slate dark theme, electric indigo and cyan accents, crisp typography, and fluid GSAP transitions.
- Angle: Desktop media workflows shouldn't be trapped between complicated CLI tools and clunky video re-encoders. SyncForge provides a native, losslessly fast workbench with built-in FFT waveform audio alignment.
- Hook: "Desynced audio. Missing subtitles. Cryptic CLI flags." → "Media remuxing, forged for speed."
- Outro / punchline: "Fast. Lossless. Open Source."
- Avoid:
  - Generic SaaS language ("revolutionize your workflow")
  - Abstract filler visuals (generic geometric shapes)
  - Unrelated visual styles (stick to the exact dark theme palette of SyncForge)

## Visual Identity
- Background: `#090C12` (canvas background), `#0F141F` (card surface)
- Text: `#F1F5F9` (primary text), `#94A3B8` (secondary text)
- Accent: `#6366F1` (electric indigo), `#38BDF8` (sky cyan), `#34D399` (emerald green)
- Display font: `Inter`, system-ui, -apple-system, sans-serif
- Body font: `Inter`, monospace (for IDs, codes, terminal text)
- Visual references from the project:
  - Track chip badges: `ID 0`, `ID 1` in monospace with rounded borders
  - Language chips: `ENG`, `ITA`
  - Action buttons: gradient primary button (`#6366F1` to `#4F46E5`)
  - Episode badges: `S01E01`

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract:
1. Scene 1 — The Hook & Reveal (0.00s - 3.80s, 3.8s)
2. Scene 2 — Track Inspector & 1-Click Filters (3.80s - 8.20s, 4.4s)
3. Scene 3 — Drag & Drop TV Episode Auto-Matcher (8.20s - 12.60s, 4.4s)
4. Scene 4 — WaveSync Pure-Rust FFT Engine (12.60s - 16.80s, 4.2s)
5. Scene 5 — Outro & Tech Stack (16.80s - 20.00s, 3.2s)

## Audio
- Audio role: Driving, clean electronic bed with crisp, tactile desktop UI accents
- Audio arc: Intro pulse → steady rhythm for UI demonstrations → resonant impact chime on FFT lock → clean logo outro with fade-out
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: Starts at 0.0s at volume 0.35, fades out 18.5s - 20.0s
- Music cue guidance: Tempo ~110 BPM; Strong cues at 8.74s, 13.11s, 17.47s; beat grid points ~0.54s apart
- Audio-reactive treatment: Subtle; ambient radial glow breathe and waveform glow with music
- Audio-coupled moments:
  - 0.3s — soft entrance accent (`interface/drop_001.ogg`)
  - 4.5s — UI click on "No Commentary/SDH" (`interface/click_001.ogg`)
  - 8.8s — UI switch on Auto-Match (`interface/switch_001.ogg`)
  - 13.11s — Resonant bell on WaveSync FFT delay lock (`impact/impactBell_heavy_000.ogg`)
  - 17.2s — Soft impact on logo reveal (`impact/impactSoft_medium_000.ogg`)
- Audio files: Copied into `brag-output/composition/assets/`

## Hyperframes Instructions
- Composition directory: `brag-output/composition/`
- Render target: `brag-output/brag.mp4`
- Aspect ratio: 1920x1080 (16:9)
- Total duration: 20.0s
- All elements timed with `data-start` and `data-duration` on `.clip` containers
- GSAP timeline registered on `window.__timelines["root"]`
- Ensure zero lint/check errors with `npx hyperframes check`
