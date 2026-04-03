import { useState, useEffect, useRef } from 'react';
import { renderCard } from './engine/canvas-renderer';
import { GRADIENTS } from './engine/gradients';
import { FONTS, loadGoogleFont } from './engine/fonts';
import { FORMATS } from './engine/formats';

export default function PlaygroundMini() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('Server-Side Text Layout Without a Browser');
  const [description, setDescription] = useState('Pure JavaScript text measurement replaces Puppeteer. Sub-millisecond layout for OG images.');
  const [renderTime, setRenderTime] = useState(0);
  const [pulse, setPulse] = useState(false);
  const accent = '#38ef7d';
  const fontEntry = FONTS[0];
  useEffect(() => { loadGoogleFont(fontEntry); }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      renderCard(canvas, {
        title, description, author: '', tag: '', format: 'og',
        accent, layout: 'left', titleSize: 48, descSize: 22,
        fontEntry, gradient: GRADIENTS[0], bgImage: null, overlayOpacity: 0.65,
      });
      const time = performance.now() - t0;
      setRenderTime(time);
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description]);
  const fmt = FORMATS.og;
  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="pg-canvas-wrapper" style={{ marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a title..."
          className="pg-input" style={inputStyle} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter a description..."
          className="pg-input" style={inputStyle} />
      </div>
      <div style={{ fontSize: 10, color: '#475569', textAlign: 'center' }}>
        Rendered in{' '}
        <span className={pulse ? 'pg-render-pulse' : ''} style={{ color: accent, fontVariantNumeric: 'tabular-nums', display: 'inline-block' }}>
          {renderTime.toFixed(1)}ms
        </span>
        {' \u00b7 '}
        <span style={{ color: '#fbbf24' }}>{Math.round(850 / Math.max(0.1, renderTime))}x faster</span> than Puppeteer
      </div>
    </div>
  );
}
