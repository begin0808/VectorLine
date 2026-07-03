# VectorLine — Image-to-SVG Line Art for Laser Cutting & Engraving

[English Version](README.md) | [繁體中文](README.zh-TW.md)

👉 **Live Demo:** [https://vector-line.vercel.app](https://vector-line.vercel.app)

![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Browser-brightgreen) ![Engine](https://img.shields.io/badge/Engine-OpenCV.js%20(WASM)-red) ![Output](https://img.shields.io/badge/Output-SVG%20%2B%20PNG-blueviolet) ![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-success)

---

**VectorLine** is a free, open-source web app that converts photos and digital images into vector line art for **laser cutting and engraving**. All processing runs locally in your browser using [OpenCV.js](https://docs.opencv.org/) (WebAssembly) — no uploads, no server, no data collection.

## Features

- **Fully local & private** — images never leave your device; nothing is uploaded or tracked.
- **Real-time preview** — adjust any parameter and see the result update instantly (debounced).
- **Image preprocessing** — denoise (Gaussian blur), brightness, and contrast controls to clean up scanned/hand-drawn art.
- **Adaptive binarization** — block size + C-constant thresholding that adapts to local lighting, plus optional color inversion for dark backgrounds.
- **Morphological cleanup** — remove speckle noise and close broken lines.
- **Three cut modes:**
  - **Outline** — traces every line in the image (interior detail preserved), ideal for faithful line art.
  - **Centerline** — skeletonizes strokes to a 1px path so the laser cuts each line once.
  - **Canny Edge** — extracts clean sketch-like edges from photographs.
- **Vector optimization** — Ramer–Douglas–Peucker node simplification and small-area noise filtering for smooth, jitter-free cutting paths.
- **Physical sizing (mm)** — embed real millimeter dimensions in the SVG so it imports at the correct scale in Beam Studio and similar laser software.
- **Export** — download the optimized SVG or a PNG of the processed line art.
- **Presets** — one-click "Hand-drawn Photo" and "Digital Artwork" tuning, plus reset to defaults.

## Tech Stack

- [Vite](https://vitejs.dev/) — build tooling & dev server
- [OpenCV.js 4.13](https://docs.opencv.org/) — image processing (WebAssembly, loaded from CDN)
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
2. The image is read into an OpenCV `Mat` and converted to grayscale.
3. Preprocessing applies brightness/contrast and denoising.
4. Adaptive thresholding produces a high-contrast black/white line image.
5. Optional morphological open/close cleans noise and gaps.
6. The chosen cut mode (outline / centerline / Canny) shapes the final lines.
7. Contours are extracted, simplified (RDP), and serialized into an SVG — optionally with millimeter dimensions for laser software.

Everything happens client-side; WebAssembly memory is explicitly freed after each run.

## Contributing

Issues and pull requests are welcome. This project was built as a maker-education aid for the Taiwanese creator community — improvements that help hobbyists and educators are especially appreciated.

## License

Released under the [MIT License](LICENSE).
