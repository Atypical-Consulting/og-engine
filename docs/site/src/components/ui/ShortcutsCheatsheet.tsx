import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  accent: string;
}

interface Shortcut {
  keys: string[];
  label: string;
  detail?: string;
}

const SECTIONS: Array<{ title: string; shortcuts: Shortcut[] }> = [
  {
    title: 'Quick actions',
    shortcuts: [
      { keys: ['R'], label: 'Randomize everything', detail: 'Fresh title, font, color, layout' },
      { keys: ['?'], label: 'Show this cheatsheet' },
      { keys: ['Esc'], label: 'Close dialogs' },
    ],
  },
  {
    title: 'Search & picks',
    shortcuts: [
      { keys: ['/'], label: 'Jump to font search' },
    ],
  },
  {
    title: 'Mouse',
    shortcuts: [
      { keys: ['Drag & drop'], label: 'Upload a background image', detail: 'Onto the preview canvas' },
    ],
  },
];

export function ShortcutsCheatsheet({ open, onClose, accent }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(4,6,10,0.74)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'pg-sheet-in 180ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#0a0d16',
          border: `1px solid ${accent}33`,
          borderRadius: 14,
          boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px ${accent}14`,
          padding: '24px 24px 18px',
          color: '#e2e8f0',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: 0.2 }}>
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--pg-text-secondary)',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.shortcuts.map((s) => (
                  <div
                    key={s.label}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#e2e8f0' }}>{s.label}</div>
                      {s.detail && (
                        <div style={{ fontSize: 11, color: 'var(--pg-text-secondary)', marginTop: 1 }}>
                          {s.detail}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {s.keys.map((k, i) => (
                        <kbd
                          key={`${s.label}-${i}`}
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--sl-font-mono, monospace)',
                            padding: '3px 8px',
                            borderRadius: 5,
                            border: `1px solid ${accent}55`,
                            background: `${accent}14`,
                            color: accent,
                            letterSpacing: 0,
                            minWidth: 24,
                            textAlign: 'center',
                            lineHeight: 1.3,
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11,
            color: 'var(--pg-text-secondary)',
            textAlign: 'center',
          }}
        >
          Press <kbd style={{ fontFamily: 'var(--sl-font-mono, monospace)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.15)' }}>Esc</kbd> or click outside to close
        </div>
      </div>

      <style>{`
        @keyframes pg-sheet-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
