# 描線工坊 VectorLine — Image-to-SVG Line Art for Laser Cutting & Engraving

[English Version](README.md) | [繁體中文](README.zh-TW.md)

👉 **Live Demo:** [https://vector-line.vercel.app](https://vector-line.vercel.app)

![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Browser-brightgreen) ![Engine](https://img.shields.io/badge/Engine-OpenCV.js%20(WASM)-red) ![Output](https://img.shields.io/badge/Output-SVG%20%2B%20PNG%20%2B%20DXF-blueviolet) ![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-success)

---

**描線工坊 (VectorLine)** is a free, open-source web app that converts photos and digital images into vector line art for **laser cutting and engraving**. All processing runs locally in your browser using [OpenCV.js](https://docs.opencv.org/) (WebAssembly) — no uploads, no server, no data collection.

## Features

- **Fully local & private** — images never leave your device; nothing is uploaded or tracked.
- **Real-time preview** — adjust any parameter and see the result update instantly (debounced), with a synchronized zoom/pan across the bitmap and vector panes.
- **Image preprocessing** — denoise (Gaussian blur), brightness, and contrast controls to clean up scanned/hand-drawn art.
- **Adaptive binarization** — block size + C-constant thresholding that adapts to local lighting, plus optional color inversion for dark backgrounds.
- **Morphological cleanup** — remove speckle noise and close broken lines.
- **Background removal**
  - **Magic wand** — click a background region to flood-fill remove it by color tolerance; accumulate multiple clicks with **undo / redo** and clear-all.
  - **White cutoff** — force bright pixels to pure white to strip light paper texture and shadow speckle.
- **Three cut modes:**
  - **Outline** — traces every line in the image (interior detail preserved), ideal for faithful line art.
  - **Centerline** — skeletonizes strokes to a 1px path so the laser cuts each line once.
  - **Canny Edge** — extracts clean sketch-like edges from photographs.
- **Vector optimization** — Ramer–Douglas–Peucker node simplification, small-area noise filtering, and optional Bézier curve smoothing for jitter-free cutting paths.
- **Auto-layering** — automatically colors the outer contour red (cut) and interior detail black (engrave), including full-bleed photo detection.
- **Physical sizing (mm)** — embed real millimeter dimensions in the SVG/DXF so it imports at the correct scale in Beam Studio, LightBurn, and similar laser software.
- **Export** — download an optimized **SVG**, a **PNG** of the processed line art, or a layered **DXF** (`CUT` / `ENGRAVE` layers) for CAD and LightBurn.
- **Before / After compare** — a draggable slider overlaying the original image against the processed bitmap.
- **Presets & built-in tips** — one-click "Hand-drawn Photo" / "Digital Artwork" tuning and reset, plus an in-app tips panel for common troubleshooting.
- **Light & dark themes** — a warm "workshop" visual theme in both modes.

## Tech Stack

- [Vite](https://vitejs.dev/) — build tooling & dev server
- [OpenCV.js](https://docs.opencv.org/) — image processing (WebAssembly, bundled locally and run in a Web Worker so the UI never blocks)
- Vanilla JavaScript, HTML & CSS — no framework, no runtime dependencies

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server (opens at http://localhost:3000)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview the production build
npm run preview
```

## How It Works

1. Drop or select an image (PNG / JPG / WebP).
2. Optionally remove the background with the magic wand (flood fill) or white-cutoff.
3. The image is read into an OpenCV `Mat` and converted to grayscale.
4. Preprocessing applies brightness/contrast and denoising.
5. Adaptive thresholding produces a high-contrast black/white line image.
6. Optional morphological open/close cleans noise and gaps.
7. The chosen cut mode (outline / centerline / Canny) shapes the final lines.
8. Contours are extracted, simplified (RDP), optionally smoothed, and serialized into an SVG (with optional mm dimensions) — a layered DXF can be generated from the same paths.

All image processing runs in a Web Worker, so the UI stays responsive; WebAssembly memory is explicitly freed after each run.

## Contributing

Issues and pull requests are welcome. This project was built as a maker-education aid for the Taiwanese creator community — improvements that help hobbyists and educators are especially appreciated.

## License

Released under the [MIT License](LICENSE).
