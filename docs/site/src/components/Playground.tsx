import { useState, useEffect, useRef, useCallback } from 'react';
import './playground.css';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import { FORMATS, type FormatKey } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { CodeOutput } from './ui/CodeOutput';
import { Section } from './ui/Section';
import { Presets, type PresetData } from './ui/Presets';
import { RenderHUD } from './ui/RenderHUD';
import { FullscreenPreview } from './ui/FullscreenPreview';
import { DropZone } from './ui/DropZone';

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
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const result = renderCard(canvas, {
        title, description, author, tag, format, accent, layout,
        titleSize, descSize, fontEntry, gradient, bgImage, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
      setInfo(result);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description, author, tag, format, accent, layout, titleSize, descSize, fontEntry, gradient, bgImage]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `og-${format}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }, [format]);

  const applyPreset = useCallback((data: PresetData) => {
    setTitle(data.title);
    setDescription(data.description);
    setAuthor(data.author);
    setTag(data.tag);
    setAccent(data.accent);
    setGradient(data.gradient);
    setFontEntry(data.fontEntry);
    setLayout(data.layout);
    setTitleSize(data.titleSize);
    setDescSize(data.descSize);
    setBgImage(null);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => setBgImage(img);
    img.src = URL.createObjectURL(file);
  }, []);

  const clearBgImage = useCallback(() => setBgImage(null), []);

  const fmt = FORMATS[format];

  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', lineHeight: '1.5',
  };

  const accentAlpha = accent + '33';
  const accentBorder = accent + '4d';

  return (
    <div
      className="pg-layout"
      style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 600,
        ['--pg-accent-alpha' as string]: accentAlpha,
        ['--pg-accent-border' as string]: accentBorder,
      }}
    >
      {/* Controls column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Presets onSelect={applyPreset} accent={accent} />

        <Section title="Format">
          <FormatSelector value={format} onChange={setFormat} accent={accent} />
        </Section>

        <Section title="Content">
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Tag</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="pg-input" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Author</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
        </Section>

        <Section title="Colors">
          <AccentPicker value={accent} onChange={setAccent} />
          <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
        </Section>

        <Section title="Typography">
          <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
          <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
          <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
          <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
        </Section>
      </div>

      {/* Preview column */}
      <div className="pg-preview-col" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          className="pg-canvas-wrapper"
          style={{ border: `1px solid ${accent}15` }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
          <RenderHUD renderTime={renderTime} info={info} accent={accent} />
          <DropZone visible={dragging} accent={accent} />
        </div>

        {bgImage && (
          <button
            onClick={clearBgImage}
            className="pg-picker-btn"
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
              border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
              color: '#64748b', cursor: 'pointer', alignSelf: 'flex-start',
            }}
          >
            ✕ Remove background image
          </button>
        )}

        {/* Response headers */}
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

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={download} className="pg-download-btn" style={{
            flex: 1, padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
            fontWeight: 700, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: '#06080c',
          }}>Download PNG</button>
          <button
            onClick={() => setShowFullscreen(true)}
            className="pg-picker-btn"
            style={{
              padding: '12px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
              color: '#94a3b8', cursor: 'pointer',
            }}
            title="Fullscreen preview"
          >
            ⛶
          </button>
        </div>

        <CodeOutput config={{ format, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug }} accent={accent} />

        {showFullscreen && (
          <FullscreenPreview canvas={canvasRef.current} onClose={() => setShowFullscreen(false)} />
        )}
      </div>
    </div>
  );
}
