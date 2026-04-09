import { useState, useEffect } from 'react';
import type { RenderResult } from '../engine/canvas-renderer';

interface Props {
  renderTime: number;
  info: RenderResult | null;
  accent: string;
  /** 'toolbar' renders inline (no self-positioning). 'overlay' keeps the
   *  legacy absolute positioning used when the HUD sits on top of a canvas. */
  variant?: 'toolbar' | 'overlay';
}

export function RenderHUD({ renderTime, info, accent, variant = 'toolbar' }: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 300);
    return () => clearTimeout(id);
  }, [renderTime]);

  const baseStyle: React.CSSProperties = {
    display: 'flex', gap: 8, alignItems: 'center',
    padding: '6px 12px', borderRadius: 8,
    background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: 10, fontFamily: 'var(--sl-font-mono, monospace)',
    color: '#94a3b8', pointerEvents: 'none',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute', bottom: 10, right: 10, zIndex: 5,
    ...baseStyle,
  };

  return (
    <div style={variant === 'overlay' ? overlayStyle : baseStyle}>
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
      <span
        style={{ color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}
        title="Speedup vs Puppeteer warm render (~130ms baseline)"
      >
        {Math.round(130 / Math.max(0.1, renderTime))}× vs Puppeteer
      </span>
    </div>
  );
}
