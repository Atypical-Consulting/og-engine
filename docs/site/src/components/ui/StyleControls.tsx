import { useEffect, useRef, type ReactNode } from 'react';
import { ACCENTS, GRADIENTS, type Gradient } from '../engine/gradients';
import { paintBackgroundMesh } from '../engine/canvas-renderer';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  accent: string;
  /** Optional content rendered inline next to the label (e.g., an inline toggle). */
  right?: ReactNode;
}

export function Slider({ label, value, onChange, min, max, accent, right }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const sliderId = `pg-slider-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: 'var(--pg-text-secondary)', marginBottom: 3, gap: 8 }}>
        <label htmlFor={sliderId} style={{ letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {right}
          <span style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
      </div>
      <input type="range" id={sliderId} min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="pg-input"
        style={{
          width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
          background: `linear-gradient(90deg, ${accent}44 ${pct}%, rgba(255,255,255,0.06) 0%)`,
          borderRadius: 2, outline: 'none', cursor: 'pointer',
        }}
      />
    </div>
  );
}

interface AccentPickerProps { value: string; onChange: (value: string) => void; }
export function AccentPicker({ value, onChange }: AccentPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Accent</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {ACCENTS.map((hex) => (
          <button key={hex} onClick={() => onChange(hex)} className="pg-picker-btn" aria-label={`Accent color ${hex}`} aria-pressed={value === hex} style={{
            width: 26, height: 26, borderRadius: 7, background: hex + '22',
            border: value === hex ? `2px solid ${hex}` : '2px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: hex }} />
          </button>
        ))}
      </div>
    </div>
  );
}

interface LayoutPickerProps { value: 'left' | 'center' | 'bottom'; onChange: (value: 'left' | 'center' | 'bottom') => void; accent: string; }
export function LayoutPicker({ value, onChange, accent }: LayoutPickerProps) {
  const options: Array<{ key: 'left' | 'center' | 'bottom'; label: string }> = [
    { key: 'left', label: 'Left' }, { key: 'center', label: 'Center' }, { key: 'bottom', label: 'Bottom' },
  ];
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Layout</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <button key={o.key} onClick={() => onChange(o.key)} className="pg-picker-btn" style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
              color: active ? accent : 'var(--pg-text-secondary)', cursor: 'pointer', letterSpacing: 0.5,
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

interface GradientSwatchProps {
  gradient: Gradient;
  accent: string;
  active: boolean;
  onClick: () => void;
}

function GradientSwatch({ gradient, accent, active, onClick }: GradientSwatchProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 96 * dpr;
    const H = 60 * dpr;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // Paint the real background mesh the same way the renderer does,
    // so users see an honest preview of what this gradient + accent will look like.
    paintBackgroundMesh(ctx, W, H, gradient, accent);
  }, [gradient, accent]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={gradient.name}
      aria-label={`${gradient.name} gradient`}
      aria-pressed={active}
      className="pg-gradient-swatch"
      style={{
        position: 'relative',
        width: 96,
        height: 60,
        borderRadius: 10,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        border: active ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.08)',
        boxShadow: active ? `0 0 0 3px ${accent}1f` : 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
      }}
    >
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
      <span
        style={{
          position: 'absolute',
          left: 8,
          bottom: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: '#f8fafc',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}
      >
        {gradient.name}
      </span>
    </button>
  );
}

interface GradientPickerProps { value: Gradient; onChange: (value: Gradient) => void; accent: string; }
export function GradientPicker({ value, onChange, accent }: GradientPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Gradient</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {GRADIENTS.map((g) => (
          <GradientSwatch
            key={g.slug}
            gradient={g}
            accent={accent}
            active={value.slug === g.slug}
            onClick={() => onChange(g)}
          />
        ))}
      </div>
    </div>
  );
}

export { FontCombobox as FontPicker } from './FontCombobox';
