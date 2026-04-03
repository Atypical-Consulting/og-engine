import { useState, useEffect, useRef } from 'react';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import type { FormatKey } from './engine/formats';
import { FORMATS } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { TemplateSelector } from './ui/TemplateSelector';

interface Props {
  panels?: Array<'content' | 'format' | 'style' | 'template'>;
  initialTitle?: string;
  initialDescription?: string;
  initialFormat?: FormatKey;
  initialAccent?: string;
}

export default function PlaygroundContextual({
  panels = ['content', 'format'],
  initialTitle = 'Hello, OG Engine',
  initialDescription = 'Generated in 2ms, no browser needed.',
  initialFormat = 'og',
  initialAccent = '#38ef7d',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [format, setFormat] = useState<FormatKey>(initialFormat);
  const [accent, setAccent] = useState(initialAccent);
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>('left');
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontEntry, setFontEntry] = useState<FontEntry>(FONTS[0]);
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [template, setTemplate] = useState('default');
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);
  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const result = renderCard(canvas, {
        title, description, author: '', tag: '', format, accent, layout,
        titleSize, descSize, fontEntry, gradient, bgImage: null, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
      setInfo(result);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description, format, accent, layout, titleSize, descSize, fontEntry, gradient, template]);
  const fmt = FORMATS[format];
  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 12 }}>
        Rendered in <span style={{ color: accent }}>{renderTime.toFixed(1)}ms</span>
        {info && <> &middot; Title: {info.titleVisibleLines}/{info.titleTotalLines} lines {info.overflow && <span style={{ color: '#fb7185' }}>(overflow)</span>}</>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {panels.includes('format') && <FormatSelector value={format} onChange={setFormat} accent={accent} />}
        {panels.includes('template') && <TemplateSelector value={template} onChange={setTemplate} accent={accent} />}
        {panels.includes('content') && (
          <>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={inputStyle} />
          </>
        )}
        {panels.includes('style') && (
          <>
            <AccentPicker value={accent} onChange={setAccent} />
            <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
            <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
            <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
            <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
            <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
          </>
        )}
      </div>
    </div>
  );
}
