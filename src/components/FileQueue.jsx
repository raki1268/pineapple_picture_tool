import { useState, useEffect } from 'react';
import { formatBytes } from '../utils/imageUtils';

function fileIcon(name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['heic', 'heif'].includes(ext)) return '📷';
  return '🖼️';
}

// Real thumbnail; falls back to emoji for HEIC or on load error
function Thumb({ fileItem, result }) {
  const [url, setUrl] = useState(null);
  const isHeic = /\.(heic|heif)$/i.test(fileItem?.name || '');
  const source = result?.status === 'done' ? result.blob : fileItem?.file;

  useEffect(() => {
    if (!source || isHeic) { setUrl(null); return; }
    const u = URL.createObjectURL(source);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [source, isHeic]);

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="file-thumb-img"
        draggable={false}
        onError={() => setUrl(null)}
      />
    );
  }
  return <span style={{ fontSize: 16 }}>{fileIcon(fileItem.name)}</span>;
}

function StatusBadge({ status }) {
  const labels = { pending: 'Waiting', processing: 'Processing', done: 'Done', error: 'Error' };
  return (
    <span className={`status-badge ${status}`}>
      {status === 'processing' && <span className="spinner" />}
      {labels[status] || status}
    </span>
  );
}

function SizeCompare({ originalSize, processedSize }) {
  if (!processedSize) return null;
  const delta = processedSize - originalSize;
  const pct = Math.abs(Math.round((delta / originalSize) * 100));
  return (
    <div className="size-compare">
      <span>{formatBytes(originalSize)}</span>
      <span>→</span>
      <span>{formatBytes(processedSize)}</span>
      {delta < 0
        ? <span className="size-saved">−{pct}%</span>
        : <span className="size-bigger">+{pct}%</span>
      }
    </div>
  );
}

export default function FileQueue({
  files, results, onRemove, onDownload, onDownloadAll, onContinue,
  doneCount, isProcessing,
}) {
  const hasResults = results.length > 0;
  const allDone = doneCount > 0 && doneCount === results.length && !isProcessing;

  return (
    <div className="file-queue">
      {(hasResults || files.length > 0) && (
        <div className="queue-header">
          <span className="queue-title">
            {hasResults
              ? `Results · ${doneCount}/${results.length}`
              : `Queue · ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </span>
          <div className="queue-header-actions">
            {doneCount > 1 && (
              <button className="download-all-btn" onClick={onDownloadAll}>
                ⬇ Download All
              </button>
            )}
            {allDone && (
              <button className="btn-continue-pipeline" onClick={onContinue} title="Move results to tray and keep editing">
                Continue →
              </button>
            )}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="empty-queue">
          <span className="empty-queue-icon">📂</span>
          Results will appear here after processing
        </div>
      )}

      {files.map((fileItem) => {
        const result = results.find(r => r.id === fileItem.id);
        const status = result?.status || 'idle';

        return (
          <div key={fileItem.id} className={`file-card${result ? ` status-${status}` : ''}`}>
            <div className="file-card-top">
              <div className="file-icon">
                <Thumb fileItem={fileItem} result={result} />
              </div>
              <div className="file-info">
                <div className="file-name" title={result?.outputName || fileItem.name}>
                  {result?.outputName || fileItem.name}
                </div>
                {result?.status === 'done'
                  ? <SizeCompare originalSize={fileItem.size} processedSize={result.processedSize} />
                  : <div className="file-meta">{formatBytes(fileItem.size)}</div>
                }
                {result?.status === 'error' && (
                  <div className="file-meta" style={{ color: '#C53030' }}>{result.error}</div>
                )}
              </div>
              <div className="file-card-actions">
                {result?.status === 'done' && (
                  <button className="btn-download" onClick={() => onDownload(result)}>
                    ⬇ Save
                  </button>
                )}
                {result?.status && result.status !== 'idle' && (
                  <StatusBadge status={result.status} />
                )}
                {!isProcessing && (
                  <button className="btn-remove" onClick={() => onRemove(fileItem.id)} title="Remove">
                    ✕
                  </button>
                )}
              </div>
            </div>
            {status === 'processing' && (
              <div className="progress-bar"><div className="progress-fill" /></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
