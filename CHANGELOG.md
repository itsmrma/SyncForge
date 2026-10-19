# Changelog

## 3.3.1 - Impeccable Design Quality, Contrast & Heading Hierarchy Polish

- **Anti-Slop & Chromatic Halo Removal**: Eliminate AI-slop colored glow shadow (`rgba(99, 102, 241, 0.30)`) on the sidebar application logo in favor of crisp, neutral elevation depth (`0 2px 4px rgba(0, 0, 0, 0.45)`).
- **Accessible Contrast Enhancements**: Elevate inactive and active keyboard shortcut badge contrast in the sidebar (`text.secondary` and `primary.light`, exceeding WCAG AA 4.5:1 ratio) and darken primary button baseline in dark mode (`#4F46E5`) for optimal 6.0:1 text contrast with `#F8FAFC`.
- **Typographic Legibility Floor**: Bump all functional micro-labels (sidebar shortcut badges, bottom status bar indicators, and keyboard shortcut table items) above the 11px floor (`0.72rem` / 11.52px).
- **Document Heading Outline Fix**: Explicitly map the Active Profile card header to `component="h4"` to maintain uninterrupted semantic heading progression (`<h3>` -> `<h4>`) across workspace views.
