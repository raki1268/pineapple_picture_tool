import { useEffect, useRef } from 'react';
import CropPreview from './CropPreview';

function useObjectURL(file) {
  const ref = useRef({ file: null, url: null });
  if (file !== ref.current.file) {
    if (ref.current.url) URL.revokeObjectURL(ref.current.url);
    ref.current = { file, url: file ? URL.createObjectURL(file) : null };
  }
  useEffect(() => () => { if (ref.current.url) URL.revokeObjectURL(ref.current.url); }, []);
  return ref.current.url;
}

function Radio({ name, value, checked, onChange, children }) {
  return (
    <span className="radio-pill">
      <input type="radio" id={`${name}-${value}`} name={name} value={value} checked={checked} onChange={() => onChange(value)} />
      <label htmlFor={`${name}-${value}`}>{children}</label>
    </span>
  );
}

function Toggle({ checked, onChange, label }) {
  const id = `toggle-${label.replace(/\s/g, '')}`;
  return (
    <div className="toggle-row">
      <label className="toggle" htmlFor={id}>
        <input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </label>
      <span>{label}</span>
    </div>
  );
}

function ActionBtn({ selected, onClick, children }) {
  return (
    <button className={`action-btn${selected ? ' selected' : ''}`} onClick={onClick}>{children}</button>
  );
}

function Slider({ label, value, min, max, onChange }) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        <span className="field-value">{value > 0 ? '+' : ''}{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function BrightnessSettings({ s, set, files }) {
  const previewFile = files.length === 1 ? files[0]?.file ?? null : null;
  const previewUrl = useObjectURL(previewFile);
  return (
    <div className="settings-card">
      <p className="settings-title">Brightness &amp; Contrast</p>
      <Slider label="Brightness" value={s.brightness} min={-100} max={100} onChange={v => set({ brightness: v })} />
      <Slider label="Contrast" value={s.contrast} min={-100} max={100} onChange={v => set({ contrast: v })} />
      {previewUrl && (
        <div style={{ marginTop: 12 }}>
          <div className="field-label" style={{ marginBottom: 6 }}><span>Preview</span></div>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
            <img
              src={previewUrl}
              alt="preview"
              style={{
                width: '100%',
                display: 'block',
                filter: `brightness(${(s.brightness / 100 + 1).toFixed(2)}) contrast(${(s.contrast / 100 + 1).toFixed(2)})`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ToolSettings({ tool, settings, onChange, files }) {
  const s = settings;
  const set = onChange;

  if (tool === 'heic') {
    return (
      <div className="settings-card">
        <p className="settings-title">HEIC → PNG</p>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', margin: '0 0 10px' }}>
          Converts Apple HEIC / HEIF images to PNG. Works in Safari instantly. In Chrome, the first
          conversion downloads a ~31 MB decoder — subsequent files are fast.
        </p>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', background: 'var(--yellow-light)', border: '1px solid var(--yellow-dark)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--gray-600)' }}>First-time Chrome users:</strong> clicking Process
          may take 10–30 s while the HEVC decoder loads. Subsequent runs are instant.
        </div>
      </div>
    );
  }

  if (tool === 'compress') {
    return (
      <div className="settings-card">
        <p className="settings-title">Compression Settings</p>

        <div className="field">
          <div className="field-label"><span>Output format</span></div>
          <div className="radio-group">
            {[['image/jpeg','JPG'],['image/png','PNG'],['image/webp','WebP']].map(([v,l]) => (
              <Radio key={v} name="compressFormat" value={v} checked={s.compressFormat === v} onChange={v => set({ compressFormat: v })}>{l}</Radio>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field-label"><span>Quality</span><span className="field-value">{s.compressQuality}</span></div>
          <input type="range" min="1" max="100" value={s.compressQuality} onChange={e => set({ compressQuality: +e.target.value })} />
        </div>

        <Toggle checked={s.compressResize} onChange={v => set({ compressResize: v })} label="Also resize" />

        {s.compressResize && (
          <>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="radio-group">
                <Radio name="compressResizeMode" value="dimensions" checked={s.compressResizeMode === 'dimensions'} onChange={v => set({ compressResizeMode: v })}>By dimensions</Radio>
                <Radio name="compressResizeMode" value="percent" checked={s.compressResizeMode === 'percent'} onChange={v => set({ compressResizeMode: v })}>By %</Radio>
              </div>
            </div>
            {s.compressResizeMode === 'dimensions' ? (
              <>
                <div className="row-2">
                  <div><div className="field-label"><span>Width (px)</span></div>
                    <input type="number" placeholder="auto" value={s.compressWidth} onChange={e => set({ compressWidth: e.target.value })} /></div>
                  <div><div className="field-label"><span>Height (px)</span></div>
                    <input type="number" placeholder="auto" value={s.compressHeight} onChange={e => set({ compressHeight: e.target.value })} /></div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Toggle checked={s.compressLockAspect} onChange={v => set({ compressLockAspect: v })} label="Lock aspect ratio" />
                </div>
              </>
            ) : (
              <div className="field">
                <div className="field-label"><span>Scale</span><span className="field-value">{s.compressPercent}%</span></div>
                <input type="range" min="1" max="200" value={s.compressPercent} onChange={e => set({ compressPercent: e.target.value })} />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (tool === 'convert') {
    return (
      <div className="settings-card">
        <p className="settings-title">Format Conversion</p>
        <div className="field">
          <div className="field-label"><span>Convert to</span></div>
          <div className="radio-group">
            {[['image/jpeg','JPG'],['image/png','PNG'],['image/webp','WebP']].map(([v,l]) => (
              <Radio key={v} name="convertFormat" value={v} checked={s.convertFormat === v} onChange={v => set({ convertFormat: v })}>{l}</Radio>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tool === 'exif') {
    return (
      <div className="settings-card">
        <p className="settings-title">EXIF Data Removal</p>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', margin: 0 }}>
          Strips all metadata including GPS location, device info, and timestamps. Supports JPG and PNG.
        </p>
      </div>
    );
  }

  if (tool === 'resize') {
    return (
      <div className="settings-card">
        <p className="settings-title">Resize Settings</p>
        <div className="field">
          <div className="radio-group">
            <Radio name="resizeMode" value="dimensions" checked={s.resizeMode === 'dimensions'} onChange={v => set({ resizeMode: v })}>Fixed dimensions</Radio>
            <Radio name="resizeMode" value="percent" checked={s.resizeMode === 'percent'} onChange={v => set({ resizeMode: v })}>Percentage</Radio>
          </div>
        </div>
        {s.resizeMode === 'dimensions' ? (
          <>
            <div className="row-2">
              <div><div className="field-label"><span>Width (px)</span></div>
                <input type="number" placeholder="original" value={s.resizeWidth} onChange={e => set({ resizeWidth: e.target.value })} /></div>
              <div><div className="field-label"><span>Height (px)</span></div>
                <input type="number" placeholder="original" value={s.resizeHeight} onChange={e => set({ resizeHeight: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <Toggle checked={s.resizeLockAspect} onChange={v => set({ resizeLockAspect: v })} label="Lock aspect ratio" />
            </div>
          </>
        ) : (
          <div className="field">
            <div className="field-label"><span>Scale</span><span className="field-value">{s.resizePercent}%</span></div>
            <input type="range" min="1" max="200" value={s.resizePercent} onChange={e => set({ resizePercent: e.target.value })} />
          </div>
        )}
      </div>
    );
  }

  if (tool === 'crop') {
    const singleFile = files.length === 1 ? files[0]?.file : null;
    return (
      <div className="settings-card">
        <p className="settings-title">Crop Settings</p>
        <div className="field">
          <div className="field-label"><span>Aspect ratio</span></div>
          <div className="radio-group">
            {['1:1','4:3','3:4','16:9','9:16'].map(r => (
              <Radio key={r} name="cropRatio" value={r} checked={s.cropRatio === r} onChange={v => set({ cropRatio: v, cropRect: null })}>{r}</Radio>
            ))}
          </div>
        </div>
        {singleFile && (
          <CropPreview
            file={singleFile}
            ratio={s.cropRatio}
            onCropChange={rect => set({ cropRect: rect })}
          />
        )}
        {files.length > 1 && (
          <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '8px 0 0' }}>
            Batch mode: center-crop applied automatically to all files.
          </p>
        )}
      </div>
    );
  }

  if (tool === 'rotate') {
    return (
      <div className="settings-card">
        <p className="settings-title">Rotate / Flip</p>
        <div className="action-buttons">
          {[
            ['cw90', '↻ 90° CW'],
            ['ccw90', '↺ 90° CCW'],
            ['180', '↕ 180°'],
            ['flipH', '⟺ Flip H'],
            ['flipV', '↕ Flip V'],
          ].map(([v, l]) => (
            <ActionBtn key={v} selected={s.rotateAction === v} onClick={() => set({ rotateAction: v })}>{l}</ActionBtn>
          ))}
        </div>
      </div>
    );
  }

  if (tool === 'brightness') {
    return <BrightnessSettings s={s} set={set} files={files} />;
  }

  if (tool === 'rename') {
    const hasN = s.renamePattern.includes('{n}');
    const previewName = (idx) => {
      const n = String(idx + s.renameStart).padStart(3, '0');
      let out = s.renamePattern
        .replace('{n}', n)
        .replace('{original}', 'example_photo');
      if (!hasN) out += n; // mirror the auto-append logic in applyRenamePattern
      return `${out}.jpg`;
    };

    return (
      <div className="settings-card">
        <p className="settings-title">Batch Rename</p>
        <div className="field">
          <div className="field-label"><span>Pattern</span></div>
          <input
            type="text"
            value={s.renamePattern}
            onChange={e => set({ renamePattern: e.target.value })}
            placeholder="{original}_{n}"
          />
          <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '4px 0 0' }}>
            Use <code>{'{n}'}</code> for auto-number, <code>{'{original}'}</code> for original filename.
            {!hasN && ' (number auto-appended since {n} is absent)'}
          </p>
        </div>
        <div className="field">
          <div className="field-label"><span>Starting number</span></div>
          <input
            type="number"
            min="0"
            value={s.renameStart}
            onChange={e => set({ renameStart: +e.target.value })}
            style={{ maxWidth: 100 }}
          />
        </div>
        <div className="rename-preview">
          <div style={{ color: 'var(--gray-400)', fontSize: 11, marginBottom: 4 }}>Preview:</div>
          {[0, 1, 2].map(i => <div key={i}>{previewName(i)}</div>)}
        </div>
      </div>
    );
  }

  return null;
}
