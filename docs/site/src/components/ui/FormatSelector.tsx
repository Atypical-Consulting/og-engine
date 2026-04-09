import { FORMATS, FORMAT_KEYS, type FormatKey } from '../engine/formats';

interface Props {
  value: FormatKey;
  onChange: (value: FormatKey) => void;
  accent: string;
}

/** A tiny aspect-ratio glyph — gives each format a visual fingerprint at any size. */
function AspectGlyph({ w, h, active, accent }: { w: number; h: number; active: boolean; accent: string }) {
  // Fit the rectangle inside a 14x14 box maintaining aspect ratio
  const box = 14;
  const scale = w >= h ? box / w : box / h;
  const gw = Math.max(3, w * scale);
  const gh = Math.max(3, h * scale);
  const color = active ? accent : 'rgba(226,232,240,0.45)';
  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      aria-hidden="true"
      style={{ flex: '0 0 auto' }}
    >
      <rect
        x={(box - gw) / 2}
        y={(box - gh) / 2}
        width={gw}
        height={gh}
        rx={1}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
      />
    </svg>
  );
}

export function FormatSelector({ value, onChange, accent }: Props) {
  return (
    <div className="pg-format-selector">
      {FORMAT_KEYS.map((key) => {
        const fmt = FORMATS[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            title={`${fmt.label} \u00b7 ${fmt.ratio}`}
            className={`pg-format-btn${active ? ' active' : ''}`}
            style={{
              borderColor: active ? `${accent}66` : undefined,
              background: active ? `${accent}12` : undefined,
              color: active ? accent : undefined,
            }}
          >
            <AspectGlyph w={fmt.w} h={fmt.h} active={active} accent={accent} />
            <span className="pg-format-label">{fmt.label}</span>
            <span className="pg-format-ratio">{fmt.ratio}</span>
          </button>
        );
      })}
    </div>
  );
}
