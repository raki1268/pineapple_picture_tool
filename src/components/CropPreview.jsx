import { useEffect, useRef, useState, useCallback } from 'react';

const RATIO_MAP = {
  '1:1':  [1, 1],
  '4:3':  [4, 3],
  '3:4':  [3, 4],
  '16:9': [16, 9],
  '9:16': [9, 16],
};

function centerCrop(imgW, imgH, rw, rh) {
  const targetRatio = rw / rh;
  const imgRatio = imgW / imgH;
  let cw, ch, cx, cy;
  if (imgRatio > targetRatio) {
    ch = imgH; cw = ch * targetRatio;
    cx = (imgW - cw) / 2; cy = 0;
  } else {
    cw = imgW; ch = cw / targetRatio;
    cx = 0; cy = (imgH - ch) / 2;
  }
  return { x: cx, y: cy, w: cw, h: ch };
}

export default function CropPreview({ file, ratio, onCropChange }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [cropRect, setCropRect] = useState(null);
  const DISPLAY_W = 380;

  const draw = useCallback((img, crop, dw, dh) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = dw;
    canvas.height = dh;
    ctx.drawImage(img, 0, 0, dw, dh);
    if (!crop) return;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, dw, dh);
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.strokeStyle = '#F5C518';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    // Rule-of-thirds guides
    ctx.strokeStyle = 'rgba(245,197,24,0.4)';
    ctx.lineWidth = 1;
    const t3x = crop.w / 3;
    const t3y = crop.h / 3;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(crop.x + t3x * i, crop.y); ctx.lineTo(crop.x + t3x * i, crop.y + crop.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crop.x, crop.y + t3y * i); ctx.lineTo(crop.x + crop.w, crop.y + t3y * i); ctx.stroke();
    }
    // Corner handles
    ctx.fillStyle = '#F5C518';
    const hs = 6;
    [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x, crop.y + crop.h], [crop.x + crop.w, crop.y + crop.h]].forEach(([hx, hy]) => {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      imgRef.current = img;
      const scale = DISPLAY_W / img.naturalWidth;
      const dh = Math.round(img.naturalHeight * scale);
      const [rw, rh] = RATIO_MAP[ratio] || [1, 1];
      const nat = centerCrop(img.naturalWidth, img.naturalHeight, rw, rh);
      const disp = { x: nat.x * scale, y: nat.y * scale, w: nat.w * scale, h: nat.h * scale, displayWidth: DISPLAY_W, displayHeight: dh };
      setCropRect(disp);
      draw(img, disp, DISPLAY_W, dh);
      onCropChange({ ...disp });
    };
    img.src = url;
  }, [file]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const scale = DISPLAY_W / img.naturalWidth;
    const dh = Math.round(img.naturalHeight * scale);
    const [rw, rh] = RATIO_MAP[ratio] || [1, 1];
    const nat = centerCrop(img.naturalWidth, img.naturalHeight, rw, rh);
    const disp = { x: nat.x * scale, y: nat.y * scale, w: nat.w * scale, h: nat.h * scale, displayWidth: DISPLAY_W, displayHeight: dh };
    setCropRect(disp);
    draw(img, disp, DISPLAY_W, dh);
    onCropChange({ ...disp });
  }, [ratio]);

  function getCanvasPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function onMouseDown(e) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const crop = cropRect;
    if (!crop) return;
    const inside = pos.x >= crop.x && pos.x <= crop.x + crop.w && pos.y >= crop.y && pos.y <= crop.y + crop.h;
    if (inside) {
      dragRef.current = { startX: pos.x, startY: pos.y, origX: crop.x, origY: crop.y };
    }
  }

  function onMouseMove(e) {
    if (!dragRef.current || !cropRect || !imgRef.current) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const dx = pos.x - dragRef.current.startX;
    const dy = pos.y - dragRef.current.startY;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const scale = DISPLAY_W / img.naturalWidth;
    const dh = Math.round(img.naturalHeight * scale);
    const newX = Math.max(0, Math.min(canvas.width - cropRect.w, dragRef.current.origX + dx));
    const newY = Math.max(0, Math.min(dh - cropRect.h, dragRef.current.origY + dy));
    const updated = { ...cropRect, x: newX, y: newY };
    setCropRect(updated);
    draw(imgRef.current, updated, DISPLAY_W, dh);
    onCropChange({ ...updated });
  }

  function onMouseUp() {
    dragRef.current = null;
  }

  if (!file) return null;

  return (
    <div className="crop-preview-wrap">
      <canvas
        ref={canvasRef}
        className="crop-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onMouseDown}
        onTouchMove={onMouseMove}
        onTouchEnd={onMouseUp}
      />
      <p className="crop-hint">Drag to reposition the crop area</p>
    </div>
  );
}
