# Pineapple Picture Tool — Product Requirements Document

## Project Overview

A lightweight, minimal image processing web tool for personal and creative use.
Open source, deployed on Vercel, source hosted on GitHub.

- **Project Name:** Pineapple Picture Tool
- **Repo:** GitHub (public / open source)
- **Deployment:** Vercel (static frontend, no backend required)
- **Tech Stack Suggestion:** Vite + React (or vanilla JS), all processing runs client-side in the browser
- **Design Direction:** Extremely minimal UI, clean and functional

---

## Core Principles

- All image processing happens **client-side** (no file upload to any server)
- Support **batch input**: drag-and-drop or file picker, up to ~20 files at once
- Each processed file can be **downloaded individually**, plus a **one-click bulk download** as a `.zip`
- No login, no account, no tracking

---

## Features

### 1. HEIC → PNG Conversion
Convert iPhone/Apple HEIC images to PNG format.
- Batch supported
- Suggested library: `heic2any`
- Process files in a queue (3–5 concurrent) to avoid browser memory issues
- Show per-file progress indicator

### 2. Image Compression
Reduce file size while maintaining acceptable visual quality.
- Output format options: JPG / PNG / WebP
- Quality slider (e.g. 1–100, default 80)
- Option to also resize during compression (width/height or percentage)
- Show before/after file size comparison per file

### 3. Format Conversion
Convert between common image formats.
- Supported conversions: PNG ↔ JPG, any → WebP
- Batch supported

### 4. EXIF Data Removal
Strip all metadata (GPS location, device info, timestamps) from images before sharing.
- Works on JPG/PNG
- Batch supported
- Suggested library: `piexifjs` or canvas re-export (lossless stripping)

### 5. Resize
Resize images to custom dimensions.
- Input options:
  - Fixed width × height (with optional aspect ratio lock)
  - Scale by percentage (e.g. 50%)
- Batch supported (applies same settings to all files)

### 6. Crop to Fixed Ratio
Crop images to common social media / print aspect ratios.
- Preset ratios: 1:1, 4:3, 3:4, 16:9, 9:16
- For single file: show visual crop preview with draggable crop area
- For batch: apply center-crop automatically

### 7. Rotate / Flip
Rotate or mirror images.
- Options: Rotate 90° CW, Rotate 90° CCW, Rotate 180°, Flip Horizontal, Flip Vertical
- Batch supported

### 8. Brightness / Contrast Adjustment
Lightweight visual adjustment without opening a full photo editor.
- Sliders for Brightness and Contrast (range: -100 to +100, default 0)
- Live preview on single image
- Batch: apply same settings to all files

### 9. Batch Rename
Rename output files according to a user-defined pattern during any conversion or export.
- Pattern input field, e.g. `photo_{n}` → outputs `photo_001.png`, `photo_002.png`
- `{n}` = auto-incrementing number (zero-padded)
- Optional: `{original}` to keep original filename as part of the new name
- Starting number configurable (default: 1)

---

## Download Behavior

- Each processed file: individual download button
- All files: one-click **Download All as ZIP**
- Suggested library: `JSZip` + `file-saver`

---

## Non-Goals (Out of Scope)

- Background removal (too complex for this phase, use dedicated tools)
- Filters / presets / color grading
- Watermarking
- Collage / image merging
- Any server-side processing or file storage

---

## Technical Notes

| Concern | Approach |
|---|---|
| HEIC decoding | `heic2any` (client-side) |
| Canvas processing | Native browser Canvas API |
| ZIP packaging | `JSZip` + `file-saver` |
| EXIF removal | `piexifjs` or canvas re-export |
| Batch queue | Process 3–5 files concurrently to manage memory |
| No backend needed | Pure static site, Vercel free tier is sufficient |

---

## Out-of-Scope for V1 (Possible Future Features)

- Background removal (AI-based, e.g. `@imgly/background-removal`)
- PDF → image conversion
- Video thumbnail extraction
- Dark/light theme toggle

---

*Document version: V1.0*
