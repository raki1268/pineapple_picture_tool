# 🍍 Pineapple Picture Tool

A lightweight, client-side image processing tool. All processing happens in the browser — no uploads, no accounts, no tracking.

**Live:** [pineapplepicturetool.vercel.app](https://pineapplepicturetool.vercel.app)

---

## Features

| Tool | Description |
|---|---|
| **HEIC → PNG** | Convert Apple HEIC / HEIF images to PNG. Works in Safari natively; Chrome uses a bundled HEVC decoder (first run ~30 s to load). |
| **Compress** | Reduce file size with format (JPG / PNG / WebP), quality slider (1–100), and optional resize in the same step. |
| **Format Convert** | Convert between PNG, JPG, and WebP. |
| **Remove EXIF** | Strip all metadata — GPS location, device info, timestamps — from JPG and PNG files. |
| **Resize** | Resize by fixed pixel dimensions (with optional aspect-ratio lock) or by percentage. |
| **Crop** | Crop to common aspect ratios (1:1, 4:3, 3:4, 16:9, 9:16). Single-file mode shows a draggable canvas preview; batch mode auto-center-crops. |
| **Rotate / Flip** | Rotate 90° CW / CCW / 180°, flip horizontal, flip vertical. |
| **Brightness** | Adjust brightness and contrast with live CSS-filter preview on the first file. |
| **Batch Rename** | Rename output files with a custom pattern. Use `{n}` for auto-incrementing numbers and `{original}` for the original filename stem. If `{n}` is omitted, numbers are appended automatically. |

### Pipeline workflow

After processing a batch you don't need to download immediately. Click **Continue →** to push all results into a persistent **staging tray** anchored below the navigation bar. The tray:

- Shows image thumbnails for every file
- Persists when you switch tools
- Lets you load a single file (click its thumbnail) or all files at once (**Load all ↓**) into the next tool
- Can be repeated as many times as needed before a final download

### Download

- **Save** — download a single processed file
- **Download All** — package all results into a `.zip`

---

## Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/)
- [`heic2any`](https://github.com/alexcorvi/heic2any) — HEIC decoding (libheif WASM)
- [`@ffmpeg/ffmpeg`](https://github.com/ffmpegwasm/ffmpeg.wasm) — HEVC fallback decoder for Chrome
- [`piexifjs`](https://github.com/hMatoba/piexifjs) — JPEG EXIF stripping
- [`jszip`](https://stuk.github.io/jszip/) + [`file-saver`](https://github.com/eligrey/FileSaver.js/) — ZIP download
- [`react-dropzone`](https://react-dropzone.js.org/) — drag-and-drop input
- [`@vercel/analytics`](https://vercel.com/docs/analytics) — page view tracking
- Native Canvas API for all image transforms

### EXIF orientation handling

All canvas-based tools (Compress, Convert, Resize, Crop, Rotate/Flip, Brightness) automatically correct image orientation. The app parses the EXIF `Orientation` tag directly from raw bytes — both JPEG (APP1 marker) and PNG (`eXIf` chunk) — then bakes the rotation into canvas pixels before export. Output files are always correctly oriented regardless of output format.

---

## Local development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

---

## Design

Pineapple color palette — golden yellow `#F5C518`, forest green `#3A6B4A`, warm cream background. Diamond crosshatch CSS pattern inspired by pineapple skin texture.

---

## License

Copyright © 2026 Raki · [rakiartoffice@gmail.com](mailto:rakiartoffice@gmail.com)

**Personal & non-commercial use only.** You may use, copy, and modify this project for personal or educational purposes. Commercial use of any kind — including selling, sublicensing, or building a paid service on top of this code — is prohibited without explicit written permission from the copyright holder. See [LICENSE](./LICENSE) for full terms.

---

## Non-goals (v1)

Background removal · filters / presets · watermarking · collage / merging · any server-side processing
