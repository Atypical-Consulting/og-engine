import { useState, useEffect } from 'react';

interface Props { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; accent: string; }

export function JsonEditor({ value, onChange, accent }: Props) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setText(JSON.stringify(value, null, 2)); }, [value]);
  const handleChange = (newText: string) => {
    setText(newText);
    try { const parsed = JSON.parse(newText); setError(null); onChange(parsed); }
    catch { setError('Invalid JSON'); }
  };
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${error ? '#ef444466' : 'rgba(255,255,255,0.06)'}` }}>
      <div style={{ padding: '6px 12px', fontSize: 9, color: error ? '#ef4444' : '#475569', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', letterSpacing: 1 }}>
        {error ?? 'JSON'}
      </div>
      <textarea value={text} onChange={(e) => handleChange(e.target.value)} spellCheck={false}
        style={{
          width: '100%', minHeight: 200, margin: 0, padding: 14, fontSize: 11,
          lineHeight: 1.6, color: '#94a3b8', background: '#0c0f1a', border: 'none',
          fontFamily: "'JetBrains Mono', monospace", resize: 'vertical', outline: 'none',
        }}
      />
    </div>
  );
}
