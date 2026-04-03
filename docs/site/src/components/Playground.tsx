import { useState, useEffect, useRef, useCallback } from 'react';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import { FORMATS, type FormatKey } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { CodeOutput } from './ui/CodeOutput';

export default function Playground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('Server-Side Text Layout Without a Browser');
  const [description, setDescription] = useState('Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content.');
  const [author, setAuthor] = useState('Pretext Engine');
  const [tag, setTag] = useState('Open Source');
  const [format, setFormat] = useState<FormatKey>('og');
  const [accent, setAccent] = useState('#38ef7d');
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>('left');
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontEntry, setFontEntry] = useState<FontEntry>(FONTS[0]);
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);
  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const result = renderCard(canvas, {
        title, description, author, tag, format, accent, layout,
        titleSize, descSize, fontEntry, gradient, bgImage: null, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
      setInfo(result);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description, author, tag, format, accent, layout, titleSize, descSize, fontEntry, gradient]);
  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `og-${format}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }, [format]);
  const fmt = FORMATS[format];
  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', lineHeight: '1.5',
  };
  const labelStyle = {
    fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' as const, display: 'block', marginBottom: 3,
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 600 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormatSelector value={format} onChange={setFormat} accent={accent} />
        <div><label style={labelStyle}>Tag</label><input value={tag} onChange={(e) => setTag(e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div><label style={labelStyle}>Author</label><input value={author} onChange={(e) => setAuthor(e.target.value)} style={inputStyle} /></div>
        <AccentPicker value={accent} onChange={setAccent} />
        <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
        <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
        <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
        <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
        <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
        </div>
        {info && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, marginBottom: 8 }}>RESPONSE HEADERS</div>
            {[
              ['X-Render-Time-Ms', renderTime.toFixed(2)],
              ['X-Title-Lines', String(info.titleVisibleLines)],
              ['X-Desc-Lines', String(info.descVisibleLines)],
              ['X-Layout-Overflow', String(info.overflow)],
              ['Content-Type', 'image/png'],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sl-font-mono)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={download} style={{
          padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
          fontWeight: 700, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: '#06080c',
        }}>Download PNG</button>
        <CodeOutput config={{ format, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug }} accent={accent} />
      </div>
    </div>
  );
}
