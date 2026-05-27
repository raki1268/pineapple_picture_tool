import { formatBytes } from '../utils/imageUtils';

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (['heic', 'heif'].includes(ext)) return '📷';
  if (['jpg', 'jpeg'].includes(ext)) return '🖼️';
  if (ext === 'png') return '🖼️';
  if (ext === 'webp') return '🖼️';
  return '📄';
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

export default function FileQueue({ files, results, onRemove, onDownload, onDownloadAll, doneCount, isProcessing }) {
  const hasResults = results.length > 0;

  return (
    <div className="file-queue">
      {(hasResults || files.length > 0) && (
        <div className="queue-header">
          <span className="queue-title">
            {hasResults ? `Results · ${doneCount}/${results.length}` : `Queue · ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </span>
          {doneCount > 1 && (
            <button className="download-all-btn" onClick={onDownloadAll}>
              ⬇ Download All ZIP
            </button>
          )}
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
              <div className="file-icon">{fileIcon(fileItem.name)}</div>
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
