import { useState, useEffect, useCallback } from 'react';

interface Props {
  canvas: HTMLCanvasElement | null;
  onClose: () => void;
}

export function FullscreenPreview({ canvas, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!canvas) return null;

  const dataUrl = canvas.toDataURL('image/png');

  return (
    <div
      className={`pg-modal-backdrop${closing ? ' closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen image preview"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        <img
          src={dataUrl}
          alt="Fullscreen preview"
          style={{
            maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          }}
        />
        <div style={{
          position: 'absolute', bottom: -40, left: 0, right: 0,
          textAlign: 'center', fontSize: 11, color: '#64748b',
        }}>
          {canvas.width} &times; {canvas.height}px &middot; Press <kbd style={{
            padding: '2px 6px', borderRadius: 4, fontSize: 10,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8',
          }}>Esc</kbd> to close
        </div>
        <button
          onClick={handleClose}
          aria-label="Close preview"
          style={{
            position: 'absolute', top: -12, right: -12,
            width: 28, height: 28, borderRadius: 14,
            background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#94a3b8', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
