import { useEffect, useRef, useState } from 'react';

const RATIO_MAP = {
  '1:1':  [1, 1],
  '4:3':  [4, 3],
  '3:4':  [3, 4],
  '16:9': [16, 9],
  '9:16': [9, 16],
};
const DISPLAY_W = 380;
const HIT_R     = 10; // px radius for corner handle hit detection

function centerCrop(imgW, imgH, rw, rh) {
  const tr = rw / rh;
  const ir = imgW / imgH;
  let cw, ch, cx, cy;
  if (ir > tr) { ch = imgH; cw = ch * tr; cx = (imgW - cw) / 2; cy = 0; }
  else          { cw = imgW; ch = cw / tr; cx = 0; cy = (imgH - ch) / 2; }
  return { x: cx, y: cy, w: cw, h: ch };
}

function drawScene(canvas, img, crop) {
  if (!canvas || !img) return;
  const ctx = canvas.getContext('2d');
  const dw = canvas.width, dh = canvas.height;
  ctx.clearRect(0, 0, dw, dh);
  ctx.drawImage(img, 0, 0, dw, dh);
  if (!crop) return;

  // Dark vignette OUTSIDE crop (image shows through inside crop)
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(0, 0,           dw, crop.y);                         // top
  ctx.fillRect(0, crop.y+crop.h, dw, dh - crop.y - crop.h);        // bottom
  ctx.fillRect(0, crop.y,      crop.x, crop.h);                     // left
  ctx.fillRect(crop.x+crop.w, crop.y, dw-crop.x-crop.w, crop.h);   // right

  // Border
  ctx.strokeStyle = '#F5C518';
  ctx.lineWidth = 2;
  ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

  // Rule-of-thirds
  ctx.strokeStyle = 'rgba(245,197,24,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const lx = crop.x + crop.w / 3 * i;
    const ly = crop.y + crop.h / 3 * i;
    ctx.beginPath(); ctx.moveTo(lx, crop.y); ctx.lineTo(lx, crop.y + crop.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(crop.x, ly); ctx.lineTo(crop.x + crop.w, ly); ctx.stroke();
  }

  // Corner handles (filled circles)
  ctx.fillStyle = '#F5C518';
  [[crop.x, crop.y], [crop.x+crop.w, crop.y],
   [crop.x, crop.y+crop.h], [crop.x+crop.w, crop.y+crop.h]].forEach(([hx, hy]) => {
    ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
  });
}

function hitTest(pos, crop, isFree) {
  if (!crop) return 'outside';
  const corners = [
    ['resize-tl', crop.x,        crop.y       ],
    ['resize-tr', crop.x+crop.w, crop.y       ],
    ['resize-bl', crop.x,        crop.y+crop.h],
    ['resize-br', crop.x+crop.w, crop.y+crop.h],
  ];
  if (isFree) {
    for (const [name, hx, hy] of corners) {
      if (Math.abs(pos.x - hx) <= HIT_R && Math.abs(pos.y - hy) <= HIT_R) return name;
    }
  }
  if (pos.x >= crop.x && pos.x <= crop.x+crop.w && pos.y >= crop.y && pos.y <= crop.y+crop.h) return 'move';
  return 'outside';
}

function cursorFor(hit, isFree) {
  if (hit === 'resize-tl' || hit === 'resize-br') return 'nwse-resize';
  if (hit === 'resize-tr' || hit === 'resize-bl') return 'nesw-resize';
  if (hit === 'move') return 'move';
  if (hit === 'outside' && isFree) return 'crosshair';
  return 'default';
}

export default function CropPreview({ file, ratio, onCropChange }) {
  const canvasRef   = useRef(null);
  const imgRef      = useRef(null);
  const dragRef     = useRef(null);
  const cropRef     = useRef(null);
  const callbackRef = useRef(onCropChange);
  useEffect(() => { callbackRef.current = onCropChange; });

  const isFree = ratio === 'free';

  // ── Helpers ──────────────────────────────────────────────────
  function applyAndReport(newCrop) {
    cropRef.current = newCrop;
    drawScene(canvasRef.current, imgRef.current, newCrop);
    callbackRef.current({ ...newCrop });
  }

  function initCrop(canvas, img, currentRatio) {
    let disp;
    if (currentRatio === 'free') {
      disp = { x: 0, y: 0, w: canvas.width, h: canvas.height,
               displayWidth: canvas.width, displayHeight: canvas.height };
    } else {
      const [rw, rh] = RATIO_MAP[currentRatio] || [1, 1];
      const nat   = centerCrop(img.naturalWidth, img.naturalHeight, rw, rh);
      const scale = DISPLAY_W / img.naturalWidth;
      const dh    = Math.round(img.naturalHeight * scale);
      disp = { x: nat.x * scale, y: nat.y * scale, w: nat.w * scale, h: nat.h * scale,
               displayWidth: DISPLAY_W, displayHeight: dh };
    }
    applyAndReport(disp);
  }

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const sx     = canvas.width / rect.width;
    const sy     = canvas.height / rect.height;
    const cx     = e.touches ? e.touches[0].clientX : e.clientX;
    const cy     = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  }

  // ── Load image ───────────────────────────────────────────────
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = DISPLAY_W;
      canvas.height = Math.round(img.naturalHeight * DISPLAY_W / img.naturalWidth);
      initCrop(canvas, img, ratio);
    };
    img.src = url;
  }, [file]);

  // ── Re-crop on ratio change ──────────────────────────────────
  useEffect(() => {
    const img    = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    initCrop(canvas, img, ratio);
  }, [ratio]);

  // ── Pointer events ───────────────────────────────────────────
  function onDown(e) {
    e.preventDefault();
    const pos  = getPos(e);
    const crop = cropRef.current;
    const hit  = hitTest(pos, crop, isFree);
    canvasRef.current.style.cursor = cursorFor(hit, isFree);

    if (hit === 'move') {
      dragRef.current = { type: 'move', sx: pos.x, sy: pos.y, orig: { ...crop } };
    } else if (hit.startsWith('resize')) {
      dragRef.current = { type: hit,   sx: pos.x, sy: pos.y, orig: { ...crop } };
    } else if (hit === 'outside' && isFree) {
      dragRef.current = { type: 'new', sx: pos.x, sy: pos.y };
    }
  }

  function onMove(e) {
    const pos = getPos(e);
    if (!dragRef.current) {
      // Update cursor on hover
      canvasRef.current.style.cursor = cursorFor(hitTest(pos, cropRef.current, isFree), isFree);
      return;
    }
    e.preventDefault();
    const canvas = canvasRef.current;
    const cw = canvas.width, ch = canvas.height;
    const { type, sx, sy, orig } = dragRef.current;
    const dx = pos.x - sx, dy = pos.y - sy;

    if (type === 'move') {
      const x = Math.max(0, Math.min(cw - orig.w, orig.x + dx));
      const y = Math.max(0, Math.min(ch - orig.h, orig.y + dy));
      applyAndReport({ ...orig, x, y });
    } else if (type === 'new') {
      const x = Math.max(0, Math.min(cw, Math.min(sx, pos.x)));
      const y = Math.max(0, Math.min(ch, Math.min(sy, pos.y)));
      const w = Math.min(Math.abs(pos.x - sx), cw - x);
      const h = Math.min(Math.abs(pos.y - sy), ch - y);
      if (w < 4 || h < 4) return;
      applyAndReport({ x, y, w, h, displayWidth: cw, displayHeight: ch });
    } else {
      // Resize from a corner
      let { x, y, w, h } = orig;
      if (type === 'resize-br') {
        w = Math.max(20, Math.min(cw - x, orig.w + dx));
        h = Math.max(20, Math.min(ch - y, orig.h + dy));
      } else if (type === 'resize-bl') {
        const newX = Math.max(0, Math.min(orig.x + orig.w - 20, orig.x + dx));
        w = orig.x + orig.w - newX; h = Math.max(20, Math.min(ch - y, orig.h + dy));
        x = newX;
      } else if (type === 'resize-tr') {
        const newY = Math.max(0, Math.min(orig.y + orig.h - 20, orig.y + dy));
        w = Math.max(20, Math.min(cw - x, orig.w + dx)); h = orig.y + orig.h - newY;
        y = newY;
      } else if (type === 'resize-tl') {
        const newX = Math.max(0, Math.min(orig.x + orig.w - 20, orig.x + dx));
        const newY = Math.max(0, Math.min(orig.y + orig.h - 20, orig.y + dy));
        w = orig.x + orig.w - newX; h = orig.y + orig.h - newY;
        x = newX; y = newY;
      }
      applyAndReport({ x, y, w, h, displayWidth: cw, displayHeight: ch });
    }
  }

  function onUp() { dragRef.current = null; }

  if (!file) return null;

  return (
    <div className="crop-preview-wrap">
      <canvas
        ref={canvasRef}
        className="crop-canvas"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
      />
      <p className="crop-hint">
        {isFree
          ? 'Drag inside to move · drag corners to resize · drag empty area for new selection'
          : 'Drag to reposition · click same ratio again to switch to Free mode'}
      </p>
    </div>
  );
}
