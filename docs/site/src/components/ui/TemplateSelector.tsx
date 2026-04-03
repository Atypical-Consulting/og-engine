const TEMPLATES = [
  { key: 'default', label: 'Default', description: 'Accent bar, grid, tag pill' },
  { key: 'social-card', label: 'Social Card', description: 'Large centered title' },
  { key: 'blog-hero', label: 'Blog Hero', description: 'Background image overlay' },
  { key: 'email-banner', label: 'Email Banner', description: 'Horizontal CTA-style' },
];

interface Props { value: string; onChange: (value: string) => void; accent: string; }

export function TemplateSelector({ value, onChange, accent }: Props) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Template</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TEMPLATES.map((t) => {
          const active = value === t.key;
          return (
            <button key={t.key} onClick={() => onChange(t.key)} title={t.description} className="pg-picker-btn" style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
              color: active ? accent : '#64748b', cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap',
            }}>{t.label}</button>
          );
        })}
      </div>
    </div>
  );
}
