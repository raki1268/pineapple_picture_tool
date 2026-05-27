import { useState, useRef } from 'react';

export default function Dropzone({ onFiles, accept, label, onTrayDrop }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) {
      onFiles(files);
    } else {
      onTrayDrop?.();
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  }

  function handleChange(e) {
    const files = e.target.files;
    if (files?.length) {
      onFiles(files);
      e.target.value = '';
    }
  }

  return (
    <div
      className={`dropzone${dragging ? ' dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleChange}
        onClick={e => e.stopPropagation()}
      />
      <span className="dropzone-icon">🍍</span>
      <p className="dropzone-title">Drop images here or click to browse</p>
      <p className="dropzone-hint">{label} · up to 20 files at once</p>
      {accept && <p className="dropzone-accept">{accept}</p>}
    </div>
  );
}
