import piexif from 'piexifjs';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
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
  const [rw, rh] = ratio.split(':').map(Number);
  const targetRatio = rw / rh;
  const imgRatio = img.naturalWidth / img.naturalHeight;

  let cx, cy, cw, ch;
  if (cropRect) {
    // cropRect is in display pixels; scale to natural pixels
    const scaleX = img.naturalWidth / cropRect.displayWidth;
    const scaleY = img.naturalHeight / cropRect.displayHeight;
    cx = Math.round(cropRect.x * scaleX);
    cy = Math.round(cropRect.y * scaleY);
    cw = Math.round(cropRect.w * scaleX);
    ch = Math.round(cropRect.h * scaleY);
  } else {
    // center crop
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
export async function rotateFlip(file, { action }) {
  const img = await loadImage(file);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (action === 'cw90') {
    canvas.width = sh; canvas.height = sw;
    ctx.translate(sh, 0); ctx.rotate(Math.PI / 2);
  } else if (action === 'ccw90') {
    canvas.width = sh; canvas.height = sw;
    ctx.translate(0, sw); ctx.rotate(-Math.PI / 2);
  } else if (action === '180') {
    canvas.width = sw; canvas.height = sh;
    ctx.translate(sw, sh); ctx.rotate(Math.PI);
  } else if (action === 'flipH') {
    canvas.width = sw; canvas.height = sh;
    ctx.translate(sw, 0); ctx.scale(-1, 1);
  } else if (action === 'flipV') {
    canvas.width = sw; canvas.height = sh;
    ctx.translate(0, sh); ctx.scale(1, -1);
  }

  ctx.drawImage(img, 0, 0);
  const mime = file.type || 'image/jpeg';
  const blob = await canvasToBlob(canvas, mime, 0.92);
  return { blob, mime };
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
