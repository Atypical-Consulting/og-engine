import { FORMATS, FORMAT_KEYS, type FormatKey } from '../engine/formats';

interface Props {
  value: FormatKey;
  onChange: (value: FormatKey) => void;
  accent: string;
}

export function FormatSelector({ value, onChange, accent }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {FORMAT_KEYS.map((key) => {
        const fmt = FORMATS[key];
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="pg-picker-btn"
            style={{
              padding: '5px 8px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
              color: active ? accent : '#64748b', cursor: 'pointer',
              letterSpacing: 0.5, whiteSpace: 'nowrap',
            }}
          >
            {fmt.label} <span style={{ opacity: 0.6, fontSize: 9 }}>{fmt.ratio}</span>
          </button>
        );
      })}
    </div>
  );
}
