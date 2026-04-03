import { useState, useEffect, useRef } from 'react';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import type { FormatKey } from './engine/formats';
import { FORMATS } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { TemplateSelector } from './ui/TemplateSelector';
import { Section } from './ui/Section';
import { RenderHUD } from './ui/RenderHUD';

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
      <div className="pg-canvas-wrapper" style={{ marginBottom: 12, border: `1px solid ${accent}15` }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
        <RenderHUD renderTime={renderTime} info={info} accent={accent} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {panels.includes('format') && (
          <Section title="Format" defaultOpen={true}>
            <FormatSelector value={format} onChange={setFormat} accent={accent} />
          </Section>
        )}
        {panels.includes('template') && (
          <Section title="Template" defaultOpen={true}>
            <TemplateSelector value={template} onChange={setTemplate} accent={accent} />
          </Section>
        )}
        {panels.includes('content') && (
          <Section title="Content" defaultOpen={true}>
            <label htmlFor="pg-ctx-title" className="sr-only">Title</label>
            <input id="pg-ctx-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="pg-input" style={inputStyle} />
            <label htmlFor="pg-ctx-desc" className="sr-only">Description</label>
            <input id="pg-ctx-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="pg-input" style={inputStyle} />
          </Section>
        )}
        {panels.includes('style') && (
          <Section title="Style" defaultOpen={true}>
            <AccentPicker value={accent} onChange={setAccent} />
            <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
            <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
            <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
            <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
            <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
          </Section>
        )}
      </div>
    </div>
  );
}
