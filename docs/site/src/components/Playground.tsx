import { useState, useEffect, useRef, useCallback } from 'react';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { apiRender, checkApiAvailable } from './engine/api-client';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import { FORMATS, type FormatKey } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { TemplateSelector } from './ui/TemplateSelector';
import { CodeOutput } from './ui/CodeOutput';
import { Section } from './ui/Section';
import { Presets, randomPreset, type PresetData } from './ui/Presets';
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
  const [template, setTemplate] = useState<string>('default');
  const [accent, setAccent] = useState('#38ef7d');
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>('left');
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontEntry, setFontEntry] = useState<FontEntry>(FONTS[0]);
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [autoFit, setAutoFit] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.65);
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const [useApi, setUseApi] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [apiImageUrl, setApiImageUrl] = useState<string | null>(null);
  const API_BASE = 'http://localhost:3000';

  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);

  useEffect(() => {
    checkApiAvailable(API_BASE).then(setApiAvailable);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (useApi) {
      const id = setTimeout(async () => {
        try {
          const result = await apiRender(API_BASE, {
            format, template, title, description, author, tag, accent,
            layout, font: fontEntry.name, titleSize, descSize,
            gradient: gradient.slug, overlayOpacity, autoFit,
          });
          setApiImageUrl(result.imageUrl);
          setRenderTime(result.renderTimeMs);
          setInfo({
            titleTotalLines: result.titleLines,
            titleVisibleLines: result.titleLines,
            descTotalLines: result.descLines,
            descVisibleLines: result.descLines,
            overflow: result.overflow,
          });
        } catch (err) {
          console.error('API render failed:', err);
          // Fallback to client-side (only renders "default" template; other templates show server-only placeholder)
          const t0 = performance.now();
          const result = renderCard(canvas, {
            title, description, author, tag, format, accent, layout,
            titleSize, descSize, fontEntry, gradient, bgImage, overlayOpacity,
          });
          setRenderTime(performance.now() - t0);
          setInfo(result);
          setApiImageUrl(null);
        }
      }, 50);
      return () => clearTimeout(id);
    } else {
      setApiImageUrl(null);
      const id = setTimeout(() => {
        const t0 = performance.now();
        const result = renderCard(canvas, {
          title, description, author, tag, format, accent, layout,
          titleSize, descSize, fontEntry, gradient, bgImage, overlayOpacity,
        });
        setRenderTime(performance.now() - t0);
        setInfo(result);
      }, 50);
      return () => clearTimeout(id);
    }
  }, [title, description, author, tag, format, template, accent, layout, titleSize, descSize, fontEntry, gradient, bgImage, useApi, overlayOpacity, autoFit]);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      e.preventDefault();
      applyPreset(randomPreset());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyPreset]);

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
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => URL.revokeObjectURL(objectUrl);
    img.src = objectUrl;
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
      className="pg-layout not-content"
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

        <Section title="Template">
          <TemplateSelector value={template} onChange={setTemplate} accent={accent} />
          {template !== 'default' && !useApi && (
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.4 }}>
              Preview shows the <strong>default</strong> template. Toggle API mode to see <code>{template}</code> rendered server-side.
            </p>
          )}
        </Section>

        <Section title="Content">
          <div>
            <label htmlFor="pg-tag" style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Tag</label>
            <input id="pg-tag" value={tag} onChange={(e) => setTag(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="pg-title" style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Title</label>
            <input id="pg-title" value={title} onChange={(e) => setTitle(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="pg-desc" style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Description</label>
            <textarea id="pg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="pg-input" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label htmlFor="pg-author" style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Author</label>
            <input id="pg-author" value={author} onChange={(e) => setAuthor(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
        </Section>

        <Section title="Colors">
          <AccentPicker value={accent} onChange={setAccent} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label htmlFor="pg-custom-color" style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase' }}>
              Custom
            </label>
            <input
              id="pg-custom-color"
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              aria-label="Custom accent color"
              style={{
                width: 28, height: 28, padding: 0, borderRadius: 7,
                border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', cursor: 'pointer',
              }}
            />
            <input
              type="text"
              value={accent}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setAccent(v);
              }}
              maxLength={7}
              aria-label="Hex color code"
              className="pg-input"
              style={{
                width: 80, padding: '6px 8px', borderRadius: 6, fontSize: 11,
                fontFamily: 'var(--sl-font-mono)',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', outline: 'none',
              }}
            />
          </div>
          <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
        </Section>

        <Section title="Typography">
          <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
          <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
          <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
          <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
        </Section>

        <Section title="Fine-tuning">
          <Slider
            label="Overlay opacity"
            value={Math.round(overlayOpacity * 100)}
            onChange={(v) => setOverlayOpacity(v / 100)}
            min={20}
            max={90}
            accent={accent}
          />
          <div style={{ marginTop: 8 }}>
            <label
              htmlFor="pg-autofit"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                fontSize: 11, color: '#94a3b8',
              }}
            >
              <input
                id="pg-autofit"
                type="checkbox"
                checked={autoFit}
                onChange={(e) => setAutoFit(e.target.checked)}
                style={{ accentColor: accent, cursor: 'pointer' }}
              />
              <span>
                <strong style={{ color: autoFit ? accent : '#e2e8f0' }}>Auto-fit text</strong>
                <span style={{ display: 'block', fontSize: 9, color: '#64748b', marginTop: 2 }}>
                  Shrinks title size automatically to prevent overflow
                </span>
              </span>
            </label>
          </div>
        </Section>
      </div>

      {/* Preview column */}
      <div className="pg-preview-col" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Upgrade / Signup CTA — persistent path from playground into the funnel */}
        <a
          href={useApi ? '/pricing/' : '/quick-start/'}
          className="pg-upgrade-pill"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${accent}44`,
            background: `linear-gradient(135deg, ${accent}14, ${accent}06)`,
            color: '#e2e8f0', textDecoration: 'none', fontSize: 12,
            fontFamily: 'inherit', transition: 'border-color 0.2s ease, transform 0.15s ease',
          }}
        >
          <span>
            {useApi ? (
              <><strong style={{ color: accent }}>Loving it?</strong> Upgrade to Starter — 10k renders/mo.</>
            ) : (
              <><strong style={{ color: accent }}>Free forever.</strong> Get your API key — no credit card.</>
            )}
          </span>
          <span style={{ color: accent, fontWeight: 700 }}>→</span>
        </a>

        <div
          className="pg-canvas-wrapper"
          style={{ border: `1px solid ${accent}15` }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
          {apiImageUrl && (
            <img
              src={apiImageUrl}
              alt="API-rendered preview"
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                objectFit: 'contain',
              }}
            />
          )}
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
              color: 'var(--pg-text-secondary)', cursor: 'pointer', alignSelf: 'flex-start',
            }}
          >
            ✕ Remove background image
          </button>
        )}

        {/* Response headers */}
        {info && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, marginBottom: 8 }}>RESPONSE HEADERS</div>
            {[
              ['X-Render-Time-Ms', renderTime.toFixed(2)],
              ['X-Title-Lines', String(info.titleVisibleLines)],
              ['X-Desc-Lines', String(info.descVisibleLines)],
              ['X-Layout-Overflow', String(info.overflow)],
              ['Content-Type', 'image/png'],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <span style={{ color: 'var(--pg-text-secondary)' }}>{k}</span>
                <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sl-font-mono)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {apiAvailable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--pg-text-secondary)', fontFamily: 'var(--sl-font-mono)' }}>
            <button
              onClick={() => setUseApi(!useApi)}
              className="pg-picker-btn"
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10,
                border: `1px solid ${useApi ? accent : 'rgba(255,255,255,0.08)'}`,
                background: useApi ? accent + '15' : 'rgba(255,255,255,0.02)',
                color: useApi ? accent : 'var(--pg-text-secondary)',
                cursor: 'pointer', fontFamily: 'var(--sl-font-mono)',
              }}
            >
              {useApi ? '⚡ API Mode' : '◻ Client Mode'}
            </button>
            {useApi && <span style={{ color: accent }}>Rendering via localhost:3000</span>}
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
            aria-label="Fullscreen preview"
          >
            ⛶
          </button>
        </div>

        <CodeOutput config={{ format, template, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug, overlayOpacity, autoFit }} accent={accent} />

        {showFullscreen && (
          <FullscreenPreview canvas={canvasRef.current} onClose={() => setShowFullscreen(false)} />
        )}
      </div>
    </div>
  );
}
