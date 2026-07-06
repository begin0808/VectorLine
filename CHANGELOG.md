# Changelog

All notable changes to VectorLine are documented here.

## [1.0.0] — 2026-07-06

First stable release. Feature-complete image-to-vector tool for laser
cutting and engraving, running 100% locally in the browser.

### Added
- **DXF export** — generate a layered DXF (`CUT` / `ENGRAVE`) alongside SVG and
  PNG, sampled from the same paths (including Bézier curves) with mm scaling.
- **Magic-wand background removal** — click background regions to flood-fill
  remove them by color tolerance, with **undo / redo** (up to 30 steps) and
  clear-all.
- **White cutoff** — luminance-based background removal that forces bright
  pixels to pure white.
- **Before / After compare** — draggable slider overlaying the original image
  against the processed bitmap.
- **Auto-layering** — outer contour red (cut) / interior detail black (engrave),
  with full-bleed photo detection.
- **In-app tips panel** — troubleshooting guide for common scenarios.
- **Synchronized zoom/pan** across the bitmap and vector previews.

### Changed
- **Visual redesign** — warm "workshop / handcraft" theme (paper/espresso base,
  amber accent) replacing the previous generic look; light and dark modes.
- Default theme is now **light**.
- Header title and subtitle are centered.
- PNG and SVG previews now render at a matching display size.
- OpenCV.js runs in a **Web Worker** (bundled locally) so the UI never blocks.

### Fixed
- SVG preview size no longer diverges from the canvas when physical (mm) sizing
  is enabled.
