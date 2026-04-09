import { useState, useEffect, useRef, useCallback } from 'react';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { apiRender, checkApiAvailable } from './engine/api-client';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, getFontByName, loadGoogleFont, type FontEntry } from './engine/fonts';
import { FORMATS, type FormatKey } from './engine/formats';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { TemplateSelector } from './ui/TemplateSelector';
import { Section } from './ui/Section';
import { Presets, randomPreset, type PresetData } from './ui/Presets';
import { PreviewToolbar } from './ui/PreviewToolbar';
import { FullscreenPreview } from './ui/FullscreenPreview';
import { CodeDrawer } from './ui/CodeDrawer';
import { DropZone } from './ui/DropZone';

const DEFAULTS = {
  title: 'Server-Side Text Layout Without a Browser',
  description:
    'Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content.',
  author: 'Pretext Engine',
  tag: 'Open Source',
  format: 'og' as FormatKey,
  template: 'default',
  accent: '#38ef7d',
  layout: 'left' as 'left' | 'center' | 'bottom',
  titleSize: 48,
  descSize: 22,
  fontName: 'Outfit',
  overlayOpacity: 0.65,
};

export default function Playground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(DEFAULTS.title);
  const [description, setDescription] = useState(DEFAULTS.description);
  const [author, setAuthor] = useState(DEFAULTS.author);
  const [tag, setTag] = useState(DEFAULTS.tag);
  const [format, setFormat] = useState<FormatKey>(DEFAULTS.format);
  const [template, setTemplate] = useState<string>(DEFAULTS.template);
  const [accent, setAccent] = useState(DEFAULTS.accent);
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>(DEFAULTS.layout);
  const [titleSize, setTitleSize] = useState(DEFAULTS.titleSize);
  const [descSize, setDescSize] = useState(DEFAULTS.descSize);
  const [fontEntry, setFontEntry] = useState<FontEntry>(getFontByName(DEFAULTS.fontName));
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(DEFAULTS.overlayOpacity);
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
            gradient: gradient.slug, overlayOpacity, autoFit: true,
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
            title, description, author, tag, format, template, accent, layout,
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
          title, description, author, tag, format, template, accent, layout,
          titleSize, descSize, fontEntry, gradient, bgImage, overlayOpacity,
        });
        setRenderTime(performance.now() - t0);
        setInfo(result);
      }, 50);
      return () => clearTimeout(id);
    }
  }, [title, description, author, tag, format, template, accent, layout, titleSize, descSize, fontEntry, gradient, bgImage, useApi, overlayOpacity]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `og-${format}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }, [format]);

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Prefer the async canvas.toBlob API so the clipboard item is a real PNG blob
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!blob) throw new Error('toBlob returned null');
      // @ts-expect-error — ClipboardItem is widely supported in modern browsers
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState('copied');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 1800);
  }, []);

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

  const resetDefaults = useCallback(() => {
    setTitle(DEFAULTS.title);
    setDescription(DEFAULTS.description);
    setAuthor(DEFAULTS.author);
    setTag(DEFAULTS.tag);
    setFormat(DEFAULTS.format);
    setTemplate(DEFAULTS.template);
    setAccent(DEFAULTS.accent);
    setLayout(DEFAULTS.layout);
    setTitleSize(DEFAULTS.titleSize);
    setDescSize(DEFAULTS.descSize);
    setFontEntry(getFontByName(DEFAULTS.fontName));
    setGradient(GRADIENTS[0]);
    setOverlayOpacity(DEFAULTS.overlayOpacity);
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
      className="pg-layout pg-app-shell not-content"
      style={{
        ['--pg-accent-alpha' as string]: accentAlpha,
        ['--pg-accent-border' as string]: accentBorder,
      }}
    >
      {/* Controls column */}
      <div className="pg-controls-col">
        <Presets onSelect={applyPreset} onReset={resetDefaults} accent={accent} />

        <Section title="Template">
          <TemplateSelector value={template} onChange={setTemplate} accent={accent} />
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              marginTop: 10,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              padding: 4,
            }}
          >
            <label
              htmlFor="pg-custom-color"
              style={{
                position: 'relative',
                width: 28,
                height: 28,
                borderRadius: 6,
                background: accent,
                cursor: 'pointer',
                flex: '0 0 auto',
                boxShadow: `0 0 0 1px rgba(0,0,0,0.25) inset`,
              }}
              aria-label="Pick accent color"
              title="Pick accent color"
            >
              <input
                id="pg-custom-color"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                aria-label="Custom accent color"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
            </label>
            <input
              id="pg-custom-color-hex"
              type="text"
              value={accent}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setAccent(v);
              }}
              maxLength={7}
              aria-label="Hex color code"
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 10px',
                marginLeft: 6,
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                fontFamily: 'var(--sl-font-mono)',
                color: '#e2e8f0',
                outline: 'none',
              }}
            />
          </div>
          <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
        </Section>

        <Section title="Typography">
          <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
          <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
          <Slider
            label="Title size"
            value={titleSize}
            onChange={setTitleSize}
            min={28}
            max={72}
            accent={accent}
          />
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
        </Section>
      </div>

      {/* Preview column */}
      <div className="pg-preview-col" style={{ gap: 12 }}>
        <PreviewToolbar
          format={format}
          onFormatChange={setFormat}
          renderTime={renderTime}
          info={info}
          accent={accent}
        />

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
              {useApi ? '⚡ Rendering via API — switch to Client' : '◻ Rendering in browser — switch to API'}
            </button>
            {useApi && <span style={{ color: accent }}>localhost:3000</span>}
          </div>
        )}

        {/* Action buttons — Copy is the primary verb on desktop, Download is the fallback */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={copyToClipboard}
            className="pg-download-btn"
            disabled={copyState !== 'idle'}
            aria-label="Copy image to clipboard"
            style={{
              flex: 1, padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
              fontWeight: 700, border: 'none',
              cursor: copyState === 'idle' ? 'pointer' : 'default',
              background:
                copyState === 'copied'
                  ? `linear-gradient(135deg, ${accent}, ${accent}bb)`
                  : copyState === 'failed'
                    ? 'linear-gradient(135deg, #fb7185, #e11d48)'
                    : `linear-gradient(135deg, ${accent}, ${accent}bb)`,
              color: '#06080c',
              transition: 'background 0.2s ease',
            }}
          >
            {copyState === 'copied' ? '✓ Copied to clipboard' : copyState === 'failed' ? '✕ Copy failed' : 'Copy image'}
          </button>
          <button
            onClick={download}
            className="pg-picker-btn"
            aria-label="Download PNG"
            title="Download PNG"
            style={{
              padding: '12px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
              color: '#e2e8f0', cursor: 'pointer', fontWeight: 600,
            }}
          >
            ↓ PNG
          </button>
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

        {showFullscreen && (
          <FullscreenPreview canvas={canvasRef.current} onClose={() => setShowFullscreen(false)} />
        )}

        <CodeDrawer
          config={{ format, template, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug, overlayOpacity }}
          accent={accent}
        />

        {/* Upgrade / signup CTA — moved to the footer so it doesn't hover over the art */}
        <a
          href={useApi ? '/pricing/' : '/quick-start/'}
          className="pg-upgrade-pill"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${accent}33`,
            background: `linear-gradient(135deg, ${accent}10, ${accent}04)`,
            color: '#e2e8f0', textDecoration: 'none', fontSize: 12,
            fontFamily: 'inherit', transition: 'border-color 0.2s ease, transform 0.15s ease',
          }}
        >
          <span>
            {useApi ? (
              <>Ready for production? <strong style={{ color: accent }}>Starter</strong> gives you 10,000 renders a month.</>
            ) : (
              <>Like what you see? <strong style={{ color: accent }}>Grab an API key</strong> and ship it.</>
            )}
          </span>
          <span style={{ color: accent, fontWeight: 700 }}>→</span>
        </a>
      </div>
    </div>
  );
}
