import { ACCENTS, GRADIENTS, type Gradient } from '../engine/gradients';
import { FONTS, type FontEntry } from '../engine/fonts';

interface SliderProps {
  label: string; value: number; onChange: (value: number) => void;
  min: number; max: number; accent: string;
}

export function Slider({ label, value, onChange, min, max, accent }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const sliderId = `pg-slider-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--pg-text-secondary)', marginBottom: 3 }}>
        <label htmlFor={sliderId} style={{ letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}>{label}</label>
        <span style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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

interface FontPickerProps { value: FontEntry; onChange: (value: FontEntry) => void; accent: string; }
export function FontPicker({ value, onChange, accent }: FontPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Font</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {FONTS.map((f) => {
          const active = value.name === f.name;
          return (
            <button key={f.name} onClick={() => onChange(f)} className="pg-picker-btn" style={{
              padding: '5px 8px', borderRadius: 6, fontSize: 9, fontFamily: 'inherit',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
              color: active ? accent : 'var(--pg-text-secondary)', cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap',
            }}>{f.name}</button>
          );
        })}
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

interface GradientPickerProps { value: Gradient; onChange: (value: Gradient) => void; accent: string; }
export function GradientPicker({ value, onChange, accent }: GradientPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Gradient</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {GRADIENTS.map((g) => (
          <button key={g.slug} onClick={() => onChange(g)} title={g.name} aria-label={`${g.name} gradient`} aria-pressed={value.slug === g.slug} className="pg-picker-btn" style={{
            width: 40, height: 28, borderRadius: 6, cursor: 'pointer', padding: 0,
            background: `linear-gradient(135deg, ${g.stops[0]}, ${g.stops[1]})`,
            border: value.slug === g.slug ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.08)',
          }} />
        ))}
      </div>
    </div>
  );
}
