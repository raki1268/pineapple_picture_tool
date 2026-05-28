import piexif from 'piexifjs';

// Scan a TIFF-structured block for tag 0x0112 (Orientation) and return its value.
function parseTiffOrientation(view, tiffStart, le) {
  try {
    const ifdOffset = view.getUint32(tiffStart + 4, le);
    const ifd       = tiffStart + ifdOffset;
    if (ifd + 2 > view.byteLength) return 1;
    const entries = view.getUint16(ifd, le);
    for (let i = 0; i < entries; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > view.byteLength) break;
      if (view.getUint16(e, le) === 0x0112) return view.getUint16(e + 8, le);
    }
  } catch {}
  return 1;
}

// Parse the EXIF Orientation tag from JPEG (APP1) or PNG (eXIf chunk).
// Returns 1 (no rotation) for unrecognised formats or any parse failure.
async function readExifOrientation(file) {
  try {
    const buf  = await file.slice(0, 65536).arrayBuffer();
    const view = new DataView(buf);

    // ── JPEG: scan APP markers ──────────────────────────────────
    if (view.getUint16(0) === 0xFFD8) {
      let off = 2;
      while (off + 4 <= view.byteLength) {
        const marker = view.getUint16(off);
        const segLen = view.getUint16(off + 2);
        if (marker === 0xFFE1 &&
            view.byteLength >= off + 10 &&
            view.getUint32(off + 4) === 0x45786966 && // "Exif"
            view.getUint16(off + 8) === 0x0000) {      // null pad
          const tiff = off + 10;
          const le   = view.getUint16(tiff) === 0x4949;
          return parseTiffOrientation(view, tiff, le);
        }
        if (marker === 0xFFDA) break; // SOS — no more metadata ahead
        off += 2 + segLen;
      }
      return 1;
    }

    // ── PNG: scan chunks for eXIf ───────────────────────────────
    if (view.getUint32(0) === 0x89504E47 && view.getUint32(4) === 0x0D0A1A0A) {
      let off = 8;
      while (off + 12 <= view.byteLength) {
        const chunkLen  = view.getUint32(off);
        const chunkType = view.getUint32(off + 4);
        if (chunkType === 0x65584966) { // 'eXIf'
          const tiff = off + 8;
          const le   = view.getUint16(tiff) === 0x4949;
          return parseTiffOrientation(view, tiff, le);
        }
        if (chunkType === 0x49454E44) break; // 'IEND'
        off += 12 + chunkLen;
      }
      return 1;
    }
  } catch {}
  return 1;
}

// Load an image and bake any EXIF orientation into the pixel data so that
// every downstream canvas draw produces the correctly-oriented output.
// Returns an HTMLImageElement (orientation 1) or an HTMLCanvasElement
// (orientations 2–8) with .naturalWidth/.naturalHeight set on both.
async function loadImage(file) {
  const orientation = await readExifOrientation(file);

  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i   = new Image();
    // Suppress CSS auto-rotation so naturalWidth/Height are always raw stored dims.
    i.style.imageOrientation = 'none';
    i.onload  = () => { URL.revokeObjectURL(url); resolve(i); };
    i.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    i.src = url;
  });

  if (orientation <= 1 || orientation > 8) return img; // nothing to do

  const sw   = img.naturalWidth;
  const sh   = img.naturalHeight;
  const swap = orientation >= 5; // 90° family — output dims are transposed
  const outW = swap ? sh : sw;
  const outH = swap ? sw : sh;

  const canvas = document.createElement('canvas');
  canvas.width  = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  // Transform matrix for each EXIF orientation value
  switch (orientation) {
    case 2: ctx.transform(-1,  0,  0,  1,  sw,   0); break; // flip H
    case 3: ctx.transform(-1,  0,  0, -1,  sw,  sh); break; // 180°
    case 4: ctx.transform( 1,  0,  0, -1,   0,  sh); break; // flip V
    case 5: ctx.transform( 0,  1,  1,  0,   0,   0); break; // transpose
    case 6: ctx.transform( 0,  1, -1,  0,  sh,   0); break; // 90° CW
    case 7: ctx.transform( 0, -1, -1,  0,  sh,  sw); break; // transverse
    case 8: ctx.transform( 0, -1,  1,  0,   0,  sw); break; // 90° CCW
  }
  ctx.drawImage(img, 0, 0);

  // Make it look like an image element so all callers work unchanged
  canvas.naturalWidth  = outW;
  canvas.naturalHeight = outH;
  return canvas;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      mimeType,
      quality
    );
  });
}

function readAsBinaryString(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

function binaryToBlob(binary, mime) {
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function getOutputExtension(mime) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mime] || 'jpg';
}

export function getOutputMime(ext) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/png', heif: 'image/png',
  };
  return map[ext.toLowerCase()] || 'image/jpeg';
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export function applyRenamePattern(pattern, index, originalName, startNum) {
  const base = originalName.replace(/\.[^/.]+$/, '');
  const n = String(index + startNum).padStart(3, '0');
  let result = pattern.replace('{n}', n).replace('{original}', base);
  // If pattern has no {n}, auto-append number so files always get unique names
  if (!pattern.includes('{n}')) result += n;
  return result;
}

// ─── HEIC → PNG ────────────────────────────────────────────────
// Strategy:
//  1. Native browser decode (Safari / macOS HEIC-capable browsers)
//  2. FFmpeg.wasm ST mode — includes HEVC decoder, no SharedArrayBuffer needed
//  3. heic2any libheif fallback
//  FFmpeg core (~31 MB) is loaded from CDN on first use and reused after.

let _ffmpegInstance = null;
let _ffmpegLoadPromise = null;

async function getFFmpeg() {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_ffmpegLoadPromise) return _ffmpegLoadPromise;

  _ffmpegLoadPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ff = new FFmpeg();
    // Single-thread core — no SharedArrayBuffer / COOP headers required
    const BASE = 'https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm';
    await ff.load({
      coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    _ffmpegInstance = ff;
    _ffmpegLoadPromise = null;
    return ff;
  })();

  return _ffmpegLoadPromise;
}

// FFmpeg is single-instance; serialize HEIC jobs to avoid FS conflicts
let _ffmpegQueue = Promise.resolve();
function withFFmpeg(fn) {
  let release;
  const prev = _ffmpegQueue;
  _ffmpegQueue = new Promise(r => { release = r; });
  return prev.then(() => getFFmpeg()).then(fn).finally(() => release());
}

async function convertHeicNative(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('Timeout')); }, 8000);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (!img.naturalWidth) { reject(new Error('No dimensions')); return; }
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        // A valid PNG from a real image is always several KB
        if (blob && blob.size > 2000) resolve(blob);
        else reject(new Error('Canvas export too small'));
      }, 'image/png');
    };
    img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error('Native failed')); };
    img.src = url;
  });
}

async function convertHeicFFmpeg(file) {
  return withFFmpeg(async (ff) => {
    const { fetchFile } = await import('@ffmpeg/util');
    const ts = Date.now();
    const inp = `in_${ts}.heic`;
    const out = `out_${ts}.png`;
    await ff.writeFile(inp, await fetchFile(file));
    await ff.exec(['-i', inp, out]);
    const data = await ff.readFile(out);
    await ff.deleteFile(inp).catch(() => {});
    await ff.deleteFile(out).catch(() => {});
    return new Blob([data.buffer], { type: 'image/png' });
  });
}

export async function convertHeic(file) {
  // 1. Native (fastest — Safari, macOS Chrome with CoreMedia HEIC)
  try {
    const blob = await convertHeicNative(file);
    return { blob, mime: 'image/png' };
  } catch { /* try next */ }

  // 2. FFmpeg.wasm — self-contained HEVC decoder, works in all modern browsers
  try {
    const blob = await convertHeicFFmpeg(file);
    return { blob, mime: 'image/png' };
  } catch { /* try next */ }

  // 3. heic2any libheif — last resort for older HEIC variants
  try {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: file, toType: 'image/png', quality: 1 });
    const blob = Array.isArray(result) ? result[0] : result;
    return { blob, mime: 'image/png' };
  } catch {
    throw new Error('HEIC conversion failed — the first file may take 10–20s while the decoder loads (~31 MB). Please try again.');
  }
}

// ─── Compress ──────────────────────────────────────────────────
export async function compressImage(file, { format, quality, resizeMode, resizeWidth, resizeHeight, resizePercent, lockAspect }) {
  const img = await loadImage(file);
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (resizeMode === 'percent' && resizePercent) {
    const pct = parseFloat(resizePercent) / 100;
    w = Math.round(w * pct);
    h = Math.round(h * pct);
  } else if (resizeMode === 'dimensions') {
    if (resizeWidth && resizeHeight) {
      w = parseInt(resizeWidth);
      h = parseInt(resizeHeight);
    } else if (resizeWidth) {
      const ratio = parseInt(resizeWidth) / w;
      w = parseInt(resizeWidth);
      h = lockAspect ? Math.round(h * ratio) : h;
    } else if (resizeHeight) {
      const ratio = parseInt(resizeHeight) / h;
      h = parseInt(resizeHeight);
      w = lockAspect ? Math.round(w * ratio) : w;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToBlob(canvas, format, quality / 100);
  return { blob, mime: format };
}

// ─── Format conversion ─────────────────────────────────────────
export async function convertFormat(file, { format }) {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  const blob = await canvasToBlob(canvas, format, 0.92);
  return { blob, mime: format };
}

// ─── EXIF removal ──────────────────────────────────────────────
export async function removeExif(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    try {
      const binary = await readAsBinaryString(file);
      const stripped = piexif.remove(binary);
      const blob = binaryToBlob(stripped, 'image/jpeg');
      return { blob, mime: 'image/jpeg' };
    } catch {
      // fallback to canvas re-export
    }
  }
  return convertFormat(file, { format: file.type === 'image/png' ? 'image/png' : 'image/jpeg' });
}

// ─── Resize ────────────────────────────────────────────────────
export async function resizeImage(file, { mode, width, height, percent, lockAspect }) {
  const img = await loadImage(file);
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (mode === 'percent') {
    const pct = parseFloat(percent) / 100;
    w = Math.max(1, Math.round(w * pct));
    h = Math.max(1, Math.round(h * pct));
  } else {
    const tw = width ? parseInt(width) : 0;
    const th = height ? parseInt(height) : 0;
    if (tw && th) { w = tw; h = th; }
    else if (tw) { h = lockAspect ? Math.max(1, Math.round(h * tw / w)) : h; w = tw; }
    else if (th) { w = lockAspect ? Math.max(1, Math.round(w * th / h)) : w; h = th; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const mime = file.type || 'image/jpeg';
  if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToBlob(canvas, mime, 0.92);
  return { blob, mime };
}

// ─── Crop ──────────────────────────────────────────────────────
export async function cropImage(file, { ratio, cropRect }) {
  const img = await loadImage(file);

  let cx, cy, cw, ch;
  if (cropRect) {
    // cropRect is in display pixels; scale to natural pixels
    const scaleX = img.naturalWidth / cropRect.displayWidth;
    const scaleY = img.naturalHeight / cropRect.displayHeight;
    cx = Math.round(cropRect.x * scaleX);
    cy = Math.round(cropRect.y * scaleY);
    cw = Math.round(cropRect.w * scaleX);
    ch = Math.round(cropRect.h * scaleY);
  } else if (ratio === 'free') {
    cx = 0; cy = 0; cw = img.naturalWidth; ch = img.naturalHeight;
  } else {
    const [rw, rh] = ratio.split(':').map(Number);
    const targetRatio = rw / rh;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    if (imgRatio > targetRatio) {
      ch = img.naturalHeight;
      cw = Math.round(ch * targetRatio);
      cx = Math.round((img.naturalWidth - cw) / 2);
      cy = 0;
    } else {
      cw = img.naturalWidth;
      ch = Math.round(cw / targetRatio);
      cx = 0;
      cy = Math.round((img.naturalHeight - ch) / 2);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
  const mime = file.type || 'image/jpeg';
  const blob = await canvasToBlob(canvas, mime, 0.92);
  return { blob, mime };
}

// ─── Rotate / Flip ─────────────────────────────────────────────
// deg: cumulative rotation in degrees (0 / 90 / 180 / 270)
// flipH / flipV: boolean toggles applied after rotation
export async function rotateFlip(file, { deg = 0, flipH = false, flipV = false }) {
  const img  = await loadImage(file);
  const sw   = img.naturalWidth;
  const sh   = img.naturalHeight;
  const norm = ((Math.round(deg) % 360) + 360) % 360;
  const swap = norm === 90 || norm === 270;

  // Step 1 — rotation
  const rCanvas = document.createElement('canvas');
  const rCtx    = rCanvas.getContext('2d');
  rCanvas.width  = swap ? sh : sw;
  rCanvas.height = swap ? sw : sh;
  if (norm === 90)  { rCtx.translate(sh, 0);  rCtx.rotate(Math.PI / 2); }
  if (norm === 180) { rCtx.translate(sw, sh);  rCtx.rotate(Math.PI); }
  if (norm === 270) { rCtx.translate(0, sw);   rCtx.rotate(-Math.PI / 2); }
  rCtx.drawImage(img, 0, 0);

  const mime = file.type || 'image/jpeg';

  if (!flipH && !flipV) {
    return { blob: await canvasToBlob(rCanvas, mime, 0.92), mime };
  }

  // Step 2 — flip
  const rw = rCanvas.width, rh = rCanvas.height;
  const canvas = document.createElement('canvas');
  canvas.width = rw; canvas.height = rh;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(flipH ? rw : 0, flipV ? rh : 0);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(rCanvas, 0, 0);
  ctx.restore();

  return { blob: await canvasToBlob(canvas, mime, 0.92), mime };
}

// ─── Brightness / Contrast ─────────────────────────────────────
export async function adjustBrightnessContrast(file, { brightness, contrast }) {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  const b = (brightness / 100 + 1).toFixed(3);
  const c = (contrast / 100 + 1).toFixed(3);
  ctx.filter = `brightness(${b}) contrast(${c})`;
  ctx.drawImage(img, 0, 0);
  const mime = file.type || 'image/jpeg';
  const blob = await canvasToBlob(canvas, mime, 0.92);
  return { blob, mime };
}
