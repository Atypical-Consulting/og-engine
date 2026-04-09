import { useState, useEffect, useCallback } from 'react';
import { CodeOutput } from './CodeOutput';

const STORAGE_KEY = 'pg-code-drawer-open';

interface Props {
  // biome-ignore lint/suspicious/noExplicitAny: config shape is dynamic
  config: any;
  accent: string;
}

export function CodeDrawer({ config, accent }: Props) {
  const [open, setOpen] = useState(false);

  // Load persisted state on mount (client-only)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setOpen(true);
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // ignore
    }
  }, [open]);

  // Escape closes — but yields to FullscreenPreview if it's open
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (!open) return;
    // If FullscreenPreview modal is open, let it handle Escape instead
    if (document.querySelector('.pg-modal-backdrop')) return;
    e.preventDefault();
    setOpen(false);
  }, [open]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <div className={`pg-code-drawer${open ? ' open' : ''}`} aria-label="Code output">
      <button
        type="button"
        className="pg-code-drawer-handle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="pg-code-drawer-body"
      >
        <span>{open ? 'Hide code ↓' : 'View code ↑'}</span>
      </button>
      <div id="pg-code-drawer-body" className="pg-code-drawer-body">
        <CodeOutput config={config} accent={accent} />
      </div>
    </div>
  );
}
