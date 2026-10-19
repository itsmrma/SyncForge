---
name: SyncForge
description: Native desktop media stream synchronizer and batch remuxer
colors:
  primary: "#6366F1"
  primary-light: "#818CF8"
  primary-dark: "#4F46E5"
  secondary: "#38BDF8"
  success: "#10B981"
  success-light: "#34D399"
  warning: "#F59E0B"
  error: "#F43F5E"
  bg-root: "#090C12"
  bg-surface: "#0F141F"
  bg-subtle: "#0B0F18"
  bg-terminal: "#070A10"
  text-primary: "#F1F5F9"
  text-secondary: "#94A3B8"
  text-muted: "#475569"
  border-subtle: "rgba(148, 163, 184, 0.12)"
  border-medium: "rgba(148, 163, 184, 0.20)"
  border-highlight: "rgba(129, 140, 248, 0.35)"
typography:
  display:
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.85rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.98rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.92rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace'
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-light}"
  button-outlined:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-path:
    backgroundColor: "{colors.bg-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: SyncForge

## Overview

**Creative North Star: "The Precision Media Foundry"**

SyncForge is designed as a focused, dark-mode audio/video laboratory. It combines industrial carbon surfaces, electric indigo action triggers, and laser-precise technical readouts. The interface balances high-throughput desktop batch utility with the aesthetic rigor of professional audio hardware and native system consoles. Every panel, meter, and input row communicates operational clarity, immediate tactile response, and absolute reliability for heavy media curation sessions.

Visual anti-references are strictly defined: SyncForge rejects generic pastel SaaS cards, playful marketing illustrations, bubbly rounded pill buttons, and emojis anywhere in system dialogs or notifications. The atmosphere is dense, utilitarian, and calm—built for power users who inspect MKV track IDs, audio waveform correlations, and real-time terminal stdout for hours at a time.

**Key Characteristics:**
- Deep carbon-slate tonal hierarchy (`#090C12` root to `#0F141F` card surfaces) with translucent hairline boundaries.
- Dual-tone typographic hierarchy: clean neutral Inter for navigation and labels, paired with prominent monospace for all technical data.
- High-contrast signal accents: Electric Forge Indigo (`#6366F1`) for primary actions, Signal Sky (`#38BDF8`) for subtitles, and Audio Match Emerald (`#34D399`) for verified tracks.
- Studio patchbay ergonomics: tactile track selection cards, integrated adornment clear buttons, and drag-and-drop batch matcher slots.

## Colors

The palette is anchored in deep carbon obsidian neutrals, activated by high-contrast technical neon signals that guide the eye directly to action triggers, stream parameters, and pipeline states.

### Primary
- **Electric Forge Indigo** (`#6366F1`): Primary interactive action color, active module indicator, and focused control glow.
- **Indigo Light** (`#818CF8`): Hover highlights, overall progress labels, and subtle accent text.
- **Indigo Deep** (`#4F46E5`): Button gradient terminal anchor providing visual weight to execution actions.

### Secondary
- **Signal Sky Blue** (`#38BDF8`): Subtitle stream indicators, dual-tone gradient stops on progress bars, and secondary parameter highlights.

### Tertiary
- **Audio Match Emerald** (`#10B981` / `#34D399`): Confirmed audio track matching, pipeline Ready status badge, and successful completion states.
- **Warning Amber** (`#F59E0B`): Batch mismatch warnings, episode sequence gap alerts, and caution states.
- **Alert Rose** (`#F43F5E`): Emergency process stop trigger (`Stop Task`), error logs, and fatal failure indicators.

### Neutral & Dual-Theme Anti-Slop Matrix (`dark` / `light` / `system`)

SyncForge supports three theme modes (`dark`, `light`, and `system` via `prefers-color-scheme`) through `getAppTheme(mode)` in `web/src/theme.js`. Light Mode is engineered as **Anodized Slate & Technical Ink**—rejecting blinding `#FFFFFF` SaaS backgrounds and fuzzy drop shadows in favor of matte aluminum surfaces and deep Slate 900 ink.

| Semantic Token | Dark Mode (*Carbon-Slate*) | Light Mode (*Anodized Slate & Technical Ink*) | Purpose |
|---|---|---|---|
| `bg-root` | `#090C12` | `#F1F3F7` | Application window base canvas |
| `bg-surface` | `#0F141F` | `#FAFAFC` | Primary card, dialog, and panel surface |
| `bg-sidebar` | `#0D111A` | `#EAECEF` | Navigation rail surface |
| `bg-subtle` | `#0B0F18` | `#E8ECF2` | Recessed inputs, track sockets, and telemetry cells |
| `bg-terminal` | `#070A10` | `#111622` | Preserved dark CLI stdout console across both themes |
| `text-primary` | `#F1F5F9` | `#0F172A` | Primary headings, values, and active labels |
| `text-secondary` | `#94A3B8` | `#475569` | Secondary descriptions, helper text, and metadata |
| `text-muted` | `#475569` | `#94A3B8` | Disabled controls and inactive hints |
| `border-subtle` | `rgba(148, 163, 184, 0.12)` | `rgba(15, 23, 42, 0.10)` | Hairline 1px surface boundaries |

### Named Rules
**The Action Accent Rule.** `#6366F1` (Dark) / `#4F46E5` (Light) is reserved strictly for primary execution triggers, the active module selection rail, and active input focus rings. It is never used for purely decorative fills.
**The Stream Color Rule.** Subtitle streams and related badges must use Signal Sky (`#38BDF8` / `#0284C7`), while audio streams and matching confirmations must use Emerald (`#34D399` / `#059669`). Colors represent stream data types consistently across all 6 modules.
**The No Emoji Doctrine.** Emoticons and unicode emojis are strictly forbidden across all UI surfaces, modals, toasts, tooltips, and log outputs. All iconography must use Material Design glyphs.

## Typography

**Display Font:** Inter (fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)  
**Body Font:** Inter (fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)  
**Label/Mono Font:** JetBrains Mono (fallback: "SFMono-Regular", Consolas, monospace)

**Character:** A disciplined dual-tone hierarchy. Human-readable navigation, dialog titles, and descriptions are set in geometric Inter with tight tracking, while every machine-parsed value, track ID, codec slug, ETA timer, and terminal line renders in crisp monospace.

### Hierarchy
- **Display / Page Title** (Font weight: 800, Size: `1.85rem` [~30px], Line height: 1.15, Letter spacing: `-0.025em`): Module headers and workspace hero titles.
- **Headline / Section** (Font weight: 700, Size: `1.15rem` [~18px], Line height: 1.3, Letter spacing: `-0.02em`): Dialog headers, card group titles, and primary action text.
- **Title / Field Label** (Font weight: 600, Size: `0.98rem` [~16px], Line height: 1.4, Letter spacing: `-0.01em`): Form field labels, track names, and table headers.
- **Body / Descriptive** (Font weight: 400, Size: `0.92rem` [~15px], Line height: 1.6, Letter spacing: `normal`): Module explanations, helper annotations, and confirmation dialog bodies.
- **Label / Technical Monospace** (Font weight: 700, Size: `0.75rem` [~12px], Line height: 1.2, Letter spacing: `0.04em`, Uppercase/Code): Track IDs (`ID 0`), codecs (`E-AC-3`, `SUBRIP`), language tags (`ENG`, `JPN`), ETA countdowns, and shortcut pills.

### Named Rules
**The Technical Monospace Rule.** Any data point generated by a media container (MKVToolNix IDs, codec names, language codes, timestamps, bitrates, file sizes, and terminal output) must render in monospace font.
**The Sentence-Case Action Rule.** Buttons and control labels use clean sentence casing ("Launch Module", "Repeat Last", "Show in folder") without forced full uppercase text transforms.

## Layout

The workspace is organized as a responsive, dual-pane desktop workstation:

1. **Collapsible Navigation Rail (Left)**:
   - Resizable between `240px` and `600px` (default `320px`) with smooth mouse-drag interaction.
   - Collapses cleanly to an icon rail (`64px`) when toggled, restoring previous custom width upon expansion.
   - Houses the 6 core processing modules, global settings access, and the persistent "Repeat Last" workflow trigger.
2. **Main Workspace Canvas (Right)**:
   - Dynamic grid layout: `gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(300px, 1.05fr)' }`.
   - Primary left column holds path input cards with inline pre-flight validation, launch controls, and live dual-bar progress (Overall Progress + Current File Progress + live Sub-Task CLI transparency indicator).
   - Secondary right column hosts the Active Profile bar, the dynamic **Stream & Telemetry Inspector**, Quick Shortcuts reference, and supports side-by-side docking of the live Developer Console on `lg+` screens.
3. **Spacing Rhythm**:
   - Strict 8px baseline grid (`8px`, `16px`, `24px`, `32px`).
   - Compact internal padding: cards use `p: 2.5` (20px), input rows use `gap: 2` (16px), dense track lists use `gap: 1` (8px).

## Elevation & Depth

SyncForge conveys spatial depth through tonal contrast, frosted glass layering, and translucent hairline strokes rather than ambient drop shadows.

### Shadow Vocabulary
- **Dialog Float** (`box-shadow: 0 24px 48px rgba(0, 0, 0, 0.65)` in Dark / `0 24px 48px rgba(15, 23, 42, 0.16)` in Light): Applied exclusively to modal dialog overlays (`MuiDialog-paper`) to detach interactive decision windows from the backdrop.
- **Flat at Rest** (`box-shadow: none`): Buttons, cards, and input controls remain completely flat at rest to preserve maximum readability.

### Named Rules
**The Hairline Boundary Rule.** Visual separation between surfaces is achieved by a 1px border stroke (`rgba(148, 163, 184, 0.12 - 0.16)` in Dark / `rgba(15, 23, 42, 0.10)` in Light) and backdrop blur (`backdrop-filter: blur(12px)`), never by thick borders or heavy box shadows.
**The Recessed Field Rule.** Editable input areas, track rows, and terminal logs are tonally recessed inside their parent containers (`#0B0F18` inside `#0F141F` in Dark; `#E8ECF2` inside `#FAFAFC` in Light), creating an intuitive "socket" or "patchbay" affordance.

## Shapes

- **Base Radius (`8px` / `rounded.md`)**: Standard for all primary buttons, input fields, terminal cards, and navigation items.
- **Small Radius (`4px` / `rounded.sm`)**: Progress bar indicators, compact badge icons, and inner action icons.
- **Dialog Radius (`12px` / `rounded.lg`)**: Modal cards, batch matcher overlay, and track selection dialogs.
- **Pill Radius (`999px` / `rounded.full`)**: Scrollbar thumbs and floating quick-jump action buttons ("Go to end").

## Components

### Buttons
- **Shape:** Gently rounded corners (`8px` radius).
- **Focus Ring (`&:focus-visible`):** High-contrast WCAG 2.1 AA 2px solid focus outline (`#818CF8` in Dark, `#4F46E5` in Light) with `outlineOffset: '2px'`.
- **Primary Action ("Launch Module"):** Rich gradient fill (`linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)`), 1px highlight border (`rgba(129, 140, 248, 0.35)`), bold typography (`0.92rem`, weight 700). On hover: brightens to `linear-gradient(135deg, #818CF8 0%, #6366F1 100%)`.
- **Secondary / Outlined:** Translucent slate fill, 1px hairline border. On hover: border tints to primary accent with subtle indigo wash.
- **Destructive Action ("Stop Task"):** Saturated rose fill (`#F43F5E`), high contrast white text, immediate visual prominence during running pipelines.

### Inputs / Path Fields
- **Style:** Recessed socket background (`#0B0F18` Dark / `#E8ECF2` Light), 1px translucent border, 8px radius.
- **Integrated Clear Action:** Integrated inside the input container via `slotProps.input.endAdornment`, never floating outside.
- **Inline Validation:** Pre-flight validation highlights missing required fields with `error` state and descriptive `helperText` that clears immediately upon user input.
- **Drag-and-Drop Zone:** Static dashed border highlight on window drag hover, respecting `prefers-reduced-motion`.

### Chips & Badges
- **Status Chips:** Compact monospace labels, semi-transparent background tint with matching 1px border.
- **Shortcut Pills:** Monospace key indicators demonstrating keyboard bindings.

### Cards & Workspaces
- **Style:** Frosted slate surface (`rgba(15, 20, 31, 0.72)` in Dark / `#FAFAFC` in Light), 10px outer radius, 1px hairline border.

### Terminal / Log Canvas
- **Style:** Preserved dark monospace console (`#070A10` Dark / `#111622` Light), font size `0.82rem`, line height 1.55, RAF-batched streaming updates.
- **Header Tools:** Consolidated top toolbar containing live search filter with match counter, quick-filter chips ("All", "Errors", "Warnings"), Copy/Download/Clear log actions, Dock-to-Side toggle (`lg+`), Expand/Compact toggle, and Hide Terminal button.

### Signature Component: Media Track Card & SyncPreviewDialog (`mpv`)
- **Media Track Card:** Interactive track selection card used in `InputDialog` and track filtering, with Emerald (`#34D399`) for audio and Signal Sky (`#38BDF8`) for subtitles.
- **`SyncPreviewDialog` (`mpv`):** Interactive pre-mux verification dialog displaying tabular monospace readouts for `Audio Delay` and `Subtitle Offset`, direct launch of external `mpv` player (`--audio-delay`, `--sub-delay`, `--start`), micro-nudge buttons (`±10ms`/`±50ms` audio, `±25ms`/`±100ms` subtitle), sample window recalculation, and `Confirm & Mux`.

## Do's and Don'ts

### Do:
- **Do** maintain pixel-perfect vertical alignment between form inputs and action buttons (40px small input height).
- **Do** integrate input clear buttons inside text fields as input adornments (`slotProps.input.endAdornment`).
- **Do** render all MKVToolNix IDs, codec names, language codes, timestamps, and ETA counters in monospace font.
- **Do** respect the module settings applicability matrix; never display irrelevant settings for the active module.
- **Do** use Material Design icons (`@mui/icons-material/*`) for all iconography.

### Don't:
- **Don't** use emojis or unicode emotes anywhere in the user interface, dialogs, tooltips, or toast notifications.
- **Don't** apply heavy ambient drop shadows to buttons or cards; use tonal contrast and hairline borders.
- **Don't** allow action buttons to float disconnected outside their corresponding input containers.
- **Don't** force uppercase transformation on general UI buttons or navigation text.
- **Don't** mix track stream colors: subtitles are always Signal Sky (`#38BDF8`) and audio is always Emerald (`#34D399`).
