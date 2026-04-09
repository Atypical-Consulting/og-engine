import { useEffect, useRef } from 'react';
import { renderCard } from '../engine/canvas-renderer';
import type { Gradient } from '../engine/gradients';
import type { FontEntry } from '../engine/fonts';

const TEMPLATES = [
  { key: 'default', label: 'Default', description: 'Editorial lockup with accent dot and byline' },
  { key: 'social-card', label: 'Social Card', description: 'Centered, oversized title' },
  { key: 'blog-hero', label: 'Blog Hero', description: 'Bottom lockup with cinematic fade' },
  { key: 'email-banner', label: 'Email Banner', description: 'Horizontal with CTA button' },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  accent: string;
  /** Content + style passed through so the preview shows what the user will get. */
  title: string;
  description: string;
  author: string;
  tag: string;
  layout: 'left' | 'center' | 'bottom';
  titleSize: number;
  descSize: number;
  fontEntry: FontEntry;
  gradient: Gradient;
}

const PREVIEW_W = 160;
const PREVIEW_H = 84;

/** A single live preview card for one template. Renders into an offscreen
 *  canvas via the shared renderCard dispatcher, so previews always match
 *  what the user will actually get. */
function TemplateCard(props: {
  templateKey: string;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  accent: string;
  title: string;
  descriptionText: string;
  author: string;
  tag: string;
  layout: 'left' | 'center' | 'bottom';
  titleSize: number;
  descSize: number;
  fontEntry: FontEntry;
  gradient: Gradient;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // Render a small mini-preview using the real renderer — that way the
    // thumbnail can't drift from the actual output.
    renderCard(c, {
      title: props.title,
      description: props.descriptionText,
      author: props.author,
      tag: props.tag,
      format: 'og',
      template: props.templateKey,
      accent: props.accent,
      layout: props.layout,
      titleSize: props.titleSize,
      descSize: props.descSize,
      fontEntry: props.fontEntry,
      gradient: props.gradient,
      bgImage: null,
      overlayOpacity: 0.65,
    });
  }, [
    props.templateKey,
    props.title,
    props.descriptionText,
    props.author,
    props.tag,
    props.accent,
    props.layout,
    props.titleSize,
    props.descSize,
    props.fontEntry,
    props.gradient,
  ]);

  return (
    <button
      type="button"
      onClick={props.onClick}
      title={`${props.label} \u2014 ${props.description}`}
      aria-label={`${props.label} template: ${props.description}`}
      aria-pressed={props.active}
      className="pg-template-card"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: 4,
        borderRadius: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        border: props.active ? `2px solid ${props.accent}` : '2px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
        boxShadow: props.active ? `0 0 0 3px ${props.accent}1f` : 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        fontFamily: 'inherit',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          aspectRatio: `${PREVIEW_W}/${PREVIEW_H}`,
          borderRadius: 6,
          display: 'block',
        }}
      />
      <span
        style={{
          fontSize: 10,
          color: props.active ? props.accent : 'var(--pg-text-secondary)',
          letterSpacing: 0.3,
          padding: '6px 4px 2px',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        {props.label}
      </span>
    </button>
  );
}

export function TemplateSelector({
  value,
  onChange,
  accent,
  title,
  description,
  author,
  tag,
  layout,
  titleSize,
  descSize,
  fontEntry,
  gradient,
}: Props) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          color: 'var(--pg-text-secondary)',
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Template
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}
      >
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.key}
            templateKey={t.key}
            label={t.label}
            description={t.description}
            active={value === t.key}
            onClick={() => onChange(t.key)}
            accent={accent}
            title={title}
            descriptionText={description}
            author={author}
            tag={tag}
            layout={layout}
            titleSize={titleSize}
            descSize={descSize}
            fontEntry={fontEntry}
            gradient={gradient}
          />
        ))}
      </div>
    </div>
  );
}
