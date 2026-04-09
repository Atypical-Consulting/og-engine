import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  /** Milliseconds before auto-dismiss. Defaults to 4500ms. */
  duration?: number;
}

interface ToastHost {
  push: (toast: Omit<ToastMessage, 'id'>) => void;
}

// Singleton host — lets anywhere in the app fire a toast without prop drilling.
let host: ToastHost | null = null;
let nextId = 1;

/** Fire a toast from anywhere. Safe to call before <ToastStack/> is mounted (no-op). */
export function toast(t: Omit<ToastMessage, 'id'>): void {
  host?.push(t);
}

export function ToastStack({ accent }: { accent: string }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Only mount the portal after first client render to avoid SSR hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const push = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, duration: 4500, ...t }]);
  }, []);

  useEffect(() => {
    host = { push };
    return () => {
      if (host?.push === push) host = null;
    };
  }, [push]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration ?? 4500),
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [toasts]);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 'min(400px, calc(100vw - 40px))',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const borderColor =
          t.kind === 'error'
            ? 'rgba(251,113,133,0.55)'
            : t.kind === 'success'
              ? `${accent}88`
              : 'rgba(255,255,255,0.14)';
        const headColor =
          t.kind === 'error' ? '#fb7185' : t.kind === 'success' ? accent : '#e2e8f0';
        const icon = t.kind === 'error' ? '✕' : t.kind === 'success' ? '✓' : '●';
        return (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: 'auto',
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${borderColor}`,
              background: 'rgba(10,13,22,0.92)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              color: '#e2e8f0',
              fontSize: 12,
              fontFamily: 'inherit',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'start',
              gap: 10,
              animation: 'pg-toast-in 200ms ease-out',
            }}
          >
            <span style={{ color: headColor, fontSize: 14, lineHeight: 1.2, marginTop: 1 }}>
              {icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: headColor, fontWeight: 600, marginBottom: t.detail ? 2 : 0 }}>
                {t.title}
              </div>
              {t.detail && (
                <div style={{ color: '#94a3b8', lineHeight: 1.45 }}>{t.detail}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 14,
                padding: 2,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes pg-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
