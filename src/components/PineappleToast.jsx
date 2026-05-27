import { useEffect, useRef } from 'react';

export default function PineappleToast({ show, onDismiss }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (show) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onDismiss, 7000);
    }
    return () => clearTimeout(timerRef.current);
  }, [show]);

  if (!show) return null;

  return (
    <div className="pineapple-toast">
      <span className="toast-pine">🍍</span>
      <div className="toast-body">
        <strong>Batch complete!</strong>
        <span>Hit <em>Continue →</em> to stack them in the tray and keep going, or download now.</span>
      </div>
      <button className="toast-close" onClick={onDismiss} title="Dismiss">✕</button>
    </div>
  );
}
