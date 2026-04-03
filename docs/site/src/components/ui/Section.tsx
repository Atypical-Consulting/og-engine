import { useState, useRef, useEffect } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Section({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<string>('none');

  useEffect(() => {
    if (bodyRef.current) {
      setMaxH(`${bodyRef.current.scrollHeight}px`);
    }
  });

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
          color: '#94a3b8', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          letterSpacing: 1, textTransform: 'uppercase',
        }}
      >
        <span
          className={`pg-section-toggle${open ? '' : ' collapsed'}`}
          style={{ fontSize: 8, lineHeight: 1 }}
        >
          ▼
        </span>
        {title}
      </button>
      <div
        ref={bodyRef}
        className={`pg-section-body${open ? '' : ' collapsed'}`}
        style={{ maxHeight: open ? maxH : 0, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {children}
      </div>
    </div>
  );
}
