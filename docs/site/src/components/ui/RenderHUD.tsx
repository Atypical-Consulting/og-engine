import '../playground.css';
import { useState, useEffect } from 'react';
import type { RenderResult } from '../engine/canvas-renderer';

interface Props {
  renderTime: number;
  info: RenderResult | null;
  accent: string;
}

export function RenderHUD({ renderTime, info, accent }: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 300);
    return () => clearTimeout(id);
  }, [renderTime]);

  return (
    <div
      style={{
        position: 'absolute', bottom: 10, right: 10, zIndex: 5,
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '6px 12px', borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 10, fontFamily: 'var(--sl-font-mono, monospace)',
        color: '#94a3b8', pointerEvents: 'none',
      }}
    >
      <span className={pulse ? 'pg-render-pulse' : ''} style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {renderTime.toFixed(1)}ms
      </span>
      {info && (
        <>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span>{info.titleVisibleLines}L title</span>
          {info.overflow && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              <span style={{ color: '#fb7185' }}>overflow</span>
            </>
          )}
        </>
      )}
      <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
      <span style={{ color: '#fbbf24' }}>{Math.round(850 / Math.max(0.1, renderTime))}x</span>
    </div>
  );
}
