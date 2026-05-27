import { useState, useCallback } from 'react';
import Header from './components/Header';
import ToolNav from './components/ToolNav';
import StagingTray from './components/StagingTray';
import Dropzone from './components/Dropzone';
import ToolSettings from './components/ToolSettings';
import FileQueue from './components/FileQueue';
import {
  convertHeic,
  compressImage,
  convertFormat,
  removeExif,
  resizeImage,
  cropImage,
  rotateFlip,
  adjustBrightnessContrast,
  getOutputExtension,
  applyRenamePattern,
} from './utils/imageUtils';
import { downloadAllAsZip, downloadSingle } from './utils/zipUtils';

export const TOOLS = [
  { id: 'heic',       label: 'HEIC→PNG',      icon: '🔄', accept: '.heic,.heif',         desc: 'Convert Apple HEIC to PNG' },
  { id: 'compress',   label: 'Compress',       icon: '⚡', accept: 'image/*',              desc: 'Reduce file size with quality control' },
  { id: 'convert',    label: 'Convert',        icon: '🔀', accept: 'image/*',              desc: 'Convert between PNG · JPG · WebP' },
  { id: 'exif',       label: 'Remove EXIF',    icon: '🔒', accept: '.jpg,.jpeg,.png',      desc: 'Strip GPS, device info & timestamps' },
  { id: 'resize',     label: 'Resize',         icon: '⤢',  accept: 'image/*',              desc: 'Resize by dimensions or percentage' },
  { id: 'crop',       label: 'Crop',           icon: '✂️', accept: 'image/*',              desc: 'Crop to common aspect ratios' },
  { id: 'rotate',     label: 'Rotate / Flip',  icon: '↻',  accept: 'image/*',              desc: 'Rotate or mirror your images' },
  { id: 'brightness', label: 'Brightness',     icon: '☀️', accept: 'image/*',              desc: 'Adjust brightness & contrast' },
  { id: 'rename',     label: 'Batch Rename',   icon: '✏️', accept: 'image/*',              desc: 'Rename files with custom patterns' },
];

let _id = 0;
function genId() { return ++_id; }

export default function App() {
  const [activeTool, setActiveTool]   = useState('heic');
  const [files, setFiles]             = useState([]);
  const [results, setResults]         = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tray, setTray]               = useState([]); // persisted across tool switches
  const [settings, setSettings] = useState({
    compressFormat: 'image/jpeg',
    compressQuality: 80,
    compressResize: false,
    compressResizeMode: 'dimensions',
    compressWidth: '',
    compressHeight: '',
    compressPercent: '50',
    compressLockAspect: true,
    convertFormat: 'image/webp',
    resizeMode: 'dimensions',
    resizeWidth: '',
    resizeHeight: '',
    resizePercent: '50',
    resizeLockAspect: true,
    cropRatio: '1:1',
    cropRect: null,
    rotateAction: 'cw90',
    brightness: 0,
    contrast: 0,
    renamePattern: '{original}_{n}',
    renameStart: 1,
    renameEnabled: false,
  });

  const currentTool = TOOLS.find(t => t.id === activeTool);

  // ── File management ───────────────────────────────────────────
  const addFiles = useCallback((newFiles) => {
    const items = Array.from(newFiles).map(f => ({
      id: genId(), file: f, name: f.name, size: f.size,
    }));
    setFiles(prev => [...prev, ...items].slice(0, 20));
    setResults([]);
  }, []);

  const removeFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setResults(prev => prev.filter(r => r.id !== id));
  }, []);

  const clearAll = useCallback(() => { setFiles([]); setResults([]); }, []);

  const patchSettings = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Tray management ───────────────────────────────────────────
  function moveResultsToTray() {
    const done = results.filter(r => r.status === 'done');
    if (!done.length) return;
    setTray(prev => [
      ...prev,
      ...done.map(r => ({
        id: `tray_${r.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: r.outputName,
        blob: r.blob,
        mime: r.mime,
        size: r.processedSize,
      })),
    ]);
    clearAll();
  }

  function loadFromTray(items) {
    const newFiles = items.map(item => {
      const file = new File([item.blob], item.name, { type: item.mime || 'image/png' });
      return { id: genId(), file, name: item.name, size: item.blob.size };
    });
    setFiles(prev => [...prev, ...newFiles].slice(0, 20));
    setResults([]);
  }

  function removeTrayItem(id) { setTray(prev => prev.filter(t => t.id !== id)); }
  function clearTray() { setTray([]); }

  // ── Output naming ─────────────────────────────────────────────
  function getOutputFilename(fileItem, mime, index) {
    const ext = getOutputExtension(mime);
    if (settings.renameEnabled && activeTool !== 'rename') {
      const renamed = applyRenamePattern(settings.renamePattern, index, fileItem.name, settings.renameStart);
      return `${renamed}.${ext}`;
    }
    if (activeTool === 'rename') {
      const renamed = applyRenamePattern(settings.renamePattern, index, fileItem.name, settings.renameStart);
      const origExt = fileItem.name.split('.').pop() || 'jpg';
      return `${renamed}.${origExt}`;
    }
    const baseName = fileItem.name.replace(/\.[^/.]+$/, '');
    return `${baseName}.${ext}`;
  }

  // ── Processing ────────────────────────────────────────────────
  async function processOneFile(fileItem) {
    const { file } = fileItem;
    switch (activeTool) {
      case 'heic':       return convertHeic(file);
      case 'compress':   return compressImage(file, {
        format: settings.compressFormat,
        quality: settings.compressQuality,
        resizeMode: settings.compressResize ? settings.compressResizeMode : null,
        resizeWidth: settings.compressWidth,
        resizeHeight: settings.compressHeight,
        resizePercent: settings.compressPercent,
        lockAspect: settings.compressLockAspect,
      });
      case 'convert':    return convertFormat(file, { format: settings.convertFormat });
      case 'exif':       return removeExif(file);
      case 'resize':     return resizeImage(file, {
        mode: settings.resizeMode,
        width: settings.resizeWidth,
        height: settings.resizeHeight,
        percent: settings.resizePercent,
        lockAspect: settings.resizeLockAspect,
      });
      case 'crop':       return cropImage(file, {
        ratio: settings.cropRatio,
        cropRect: files.length === 1 ? settings.cropRect : null,
      });
      case 'rotate':     return rotateFlip(file, { action: settings.rotateAction });
      case 'brightness': return adjustBrightnessContrast(file, {
        brightness: settings.brightness,
        contrast: settings.contrast,
      });
      case 'rename':     return { blob: file, mime: file.type };
      default:           throw new Error('Unknown tool');
    }
  }

  async function process() {
    if (files.length === 0 || isProcessing) return;
    setIsProcessing(true);

    setResults(files.map(f => ({
      id: f.id, originalName: f.name, originalSize: f.size,
      outputName: '', blob: null, processedSize: 0, status: 'pending', error: null,
    })));

    const BATCH = 3;
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      setResults(prev => prev.map(r =>
        batch.some(f => f.id === r.id) ? { ...r, status: 'processing' } : r
      ));
      await Promise.all(batch.map(async (fileItem, bi) => {
        const globalIdx = i + bi;
        try {
          const { blob, mime } = await processOneFile(fileItem);
          const outputName = getOutputFilename(fileItem, mime, globalIdx);
          setResults(prev => prev.map(r =>
            r.id === fileItem.id
              ? { ...r, status: 'done', blob, processedSize: blob.size, outputName, mime }
              : r
          ));
        } catch (err) {
          setResults(prev => prev.map(r =>
            r.id === fileItem.id
              ? { ...r, status: 'error', error: err.message || 'Processing failed' }
              : r
          ));
        }
      }));
    }
    setIsProcessing(false);
  }

  function handleToolChange(toolId) {
    setActiveTool(toolId);
    // Keep files & results when switching — only clear crop rect
    patchSettings({ cropRect: null });
  }

  const doneResults = results.filter(r => r.status === 'done');

  return (
    <div className="app">
      <Header />
      <ToolNav tools={TOOLS} activeTool={activeTool} onChange={handleToolChange} />
      <StagingTray
        items={tray}
        onLoadAll={() => loadFromTray(tray)}
        onLoadItem={(item) => loadFromTray([item])}
        onRemoveItem={removeTrayItem}
        onClear={clearTray}
      />
      <main className="main">
        <div className="tool-area">
          <Dropzone onFiles={addFiles} accept={currentTool?.accept} label={currentTool?.desc} />
          <ToolSettings
            tool={activeTool}
            settings={settings}
            onChange={patchSettings}
            files={files}
          />
          {files.length > 0 && (
            <div className="process-bar">
              <span className="file-count">{files.length} file{files.length !== 1 ? 's' : ''} ready</span>
              <div className="process-actions">
                <button className="btn-clear" onClick={clearAll} disabled={isProcessing}>Clear</button>
                <button className="btn-process" onClick={process} disabled={isProcessing}>
                  {isProcessing ? 'Processing…' : `Process ${files.length} file${files.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
        <FileQueue
          files={files}
          results={results}
          onRemove={removeFile}
          onDownload={downloadSingle}
          onDownloadAll={() => downloadAllAsZip(results)}
          onContinue={moveResultsToTray}
          doneCount={doneResults.length}
          isProcessing={isProcessing}
        />
      </main>
    </div>
  );
}
