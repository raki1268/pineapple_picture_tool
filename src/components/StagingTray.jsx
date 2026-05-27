import { useState, useEffect } from 'react';

function TrayThumb({ blob, mime, name }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (url && mime?.startsWith('image/')) {
    return <img src={url} alt={name} className="tray-thumb" />;
  }
  return <span className="tray-thumb-icon">🖼</span>;
}

export default function StagingTray({ items, onLoadAll, onLoadItem, onRemoveItem, onClear, onDragStart, onDragEnd }) {
  if (!items.length) return null;

  function startDragAll(e) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', 'tray-all');
    onDragStart?.(items);
  }

  function startDragOne(e, item) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', 'tray-item');
    onDragStart?.([item]);
  }

  return (
    <div className="staging-tray">
      <div
        className="tray-label tray-label-draggable"
        draggable
        onDragStart={startDragAll}
        onDragEnd={() => onDragEnd?.()}
        title="Drag to drop zone to load all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M3 12h18M3 18h18"/>
        </svg>
        <span>{items.length} in tray</span>
      </div>

      <div className="tray-scroll">
        <div className="tray-items">
          {items.map(item => (
            <div
              key={item.id}
              className="tray-item"
              draggable
              title={`Drag or click to load: ${item.name}`}
              onClick={() => onLoadItem(item)}
              onDragStart={(e) => startDragOne(e, item)}
              onDragEnd={() => onDragEnd?.()}
            >
              <div className="tray-thumb-wrap">
                <TrayThumb blob={item.blob} mime={item.mime} name={item.name} />
              </div>
              <span className="tray-item-name">{item.name}</span>
              <button
                className="tray-item-remove"
                onClick={e => { e.stopPropagation(); onRemoveItem(item.id); }}
                title="Remove"
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="tray-actions">
        <button className="tray-load-all" onClick={onLoadAll}>
          Load all ↓
        </button>
        <button className="tray-clear-btn" onClick={onClear} title="Dismiss tray">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
