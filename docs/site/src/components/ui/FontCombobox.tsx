import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FEATURED_FONTS as CURATED_FONTS, type CuratedFontEntry } from '../../../../../src/engine/font-catalog';
import { loadGoogleFontByFamily, type FontEntry, getFontByName } from '../engine/fonts';

interface Props {
  value: FontEntry;
  onChange: (value: FontEntry) => void;
  accent: string;
}

const RECENT_KEY = 'pg-recent-fonts';
const RECENT_MAX = 5;

const CHIP_DEFS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'sans', label: 'Sans', match: (f: CuratedFontEntry) => f.category === 'sans-serif' },
  { id: 'serif', label: 'Serif', match: (f: CuratedFontEntry) => f.category === 'serif' },
  { id: 'display', label: 'Display', match: (f: CuratedFontEntry) => f.category === 'display' },
  { id: 'mono', label: 'Mono', match: (f: CuratedFontEntry) => f.category === 'monospace' },
  { id: 'handwriting', label: 'Handwriting', match: (f: CuratedFontEntry) => f.category === 'handwriting' },
] as const;

type ChipId = (typeof CHIP_DEFS)[number]['id'];

function loadRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecents(names: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(names.slice(0, RECENT_MAX)));
  } catch {
    // ignore
  }
}

export function FontCombobox({ value, onChange, accent }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipId>('all');
  const [recents, setRecents] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const [triggerRect, setTriggerRect] = useState<{ top: number; left: number; width: number; bottom: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Track trigger bounds while open so the portal-positioned dropdown stays aligned
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const b = triggerRef.current?.getBoundingClientRect();
      if (b) setTriggerRect({ top: b.top, left: b.left, width: b.width, bottom: b.bottom });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Load recents on mount
  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  // Auto-focus search when opening
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  // Click outside to close — account for portal-rendered dropdown
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Global "/" shortcut to open and focus
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Build the section data — only curated fonts. No "preview only" ghetto.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chipDef = CHIP_DEFS.find((c) => c.id === chip) ?? CHIP_DEFS[0];

    const matchesQuery = (family: string) => !q || family.toLowerCase().includes(q);

    // Recent section (intersect with curated)
    const recentSection = recents
      .map((name) => CURATED_FONTS.find((f) => f.name === name))
      .filter((f): f is CuratedFontEntry => !!f)
      .filter((f) => matchesQuery(f.name))
      .filter((f) => chipDef.match(f));

    // Everything else — sorted by category then name
    const recentNames = new Set(recentSection.map((f) => f.name));
    const allSection = CURATED_FONTS
      .filter((f) => !recentNames.has(f.name))
      .filter((f) => matchesQuery(f.name))
      .filter((f) => chipDef.match(f))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { recent: recentSection, all: allSection };
  }, [query, chip, recents]);

  const flatRows = useMemo(() => {
    return [...sections.recent, ...sections.all];
  }, [sections]);

  const handleSelect = useCallback(
    (family: string) => {
      const curated = CURATED_FONTS.find((f) => f.name === family);
      if (!curated) return;
      const entry = getFontByName(curated.name);

      loadGoogleFontByFamily(entry.family, entry.weights);
      onChange(entry);

      const next = [family, ...recents.filter((n) => n !== family)].slice(0, RECENT_MAX);
      setRecents(next);
      saveRecents(next);

      setOpen(false);
      setQuery('');
      setHighlighted(-1);
    },
    [onChange, recents],
  );

  // Keyboard navigation in the dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, flatRows.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = highlighted >= 0 ? flatRows[highlighted] : flatRows[0];
      if (target) handleSelect(target.name);
    }
  };

  // Lazy-load font CSS for visible rows (intersection observer)
  useEffect(() => {
    if (!open || !listRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting) {
            const family = (ent.target as HTMLElement).dataset.family;
            if (family) loadGoogleFontByFamily(family);
          }
        }
      },
      { root: listRef.current, rootMargin: '200px' },
    );
    const rows = listRef.current.querySelectorAll('[data-family]');
    rows.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, [open, sections]);

  // Compute portal-anchored dropdown position (flip above if no room below)
  const dropdownStyle = useMemo((): React.CSSProperties => {
    if (!triggerRect) return { visibility: 'hidden' };
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxH = Math.min(520, vh - 32);
    const spaceBelow = vh - triggerRect.bottom - 16;
    const openAbove = spaceBelow < Math.min(280, maxH) && triggerRect.top > spaceBelow;
    return {
      position: 'fixed',
      left: triggerRect.left,
      width: Math.max(280, triggerRect.width),
      maxHeight: maxH,
      top: openAbove ? undefined : triggerRect.bottom + 6,
      bottom: openAbove ? vh - triggerRect.top + 6 : undefined,
      zIndex: 1000,
    };
  }, [triggerRect]);

  return (
    <div className="pg-font-combobox" ref={containerRef}>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>
        Font
      </div>
      <button
        ref={triggerRef}
        type="button"
        className="pg-font-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ fontFamily: value.family }}
      >
        <span>{value.name}</span>
        <span className="pg-font-trigger-chevron">▼</span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={dropdownRef} className="pg-font-dropdown" style={dropdownStyle} onKeyDown={handleKeyDown}>
          <input
            ref={searchInputRef}
            type="text"
            className="pg-font-search"
            placeholder="Search fonts..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(-1);
            }}
          />
          <div className="pg-font-chips">
            {CHIP_DEFS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pg-font-chip${chip === c.id ? ' active' : ''}`}
                onClick={() => setChip(c.id)}
                style={chip === c.id ? { borderColor: `${accent}80`, background: `${accent}14`, color: accent } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="pg-font-list" ref={listRef}>
            {sections.recent.length > 0 && (
              <>
                <div className="pg-font-section-header">Recent</div>
                {sections.recent.map((row, i) => (
                  <button
                    key={`recent-${row.name}`}
                    type="button"
                    className={`pg-font-row${highlighted === i ? ' highlighted' : ''}${row.name === value.name ? ' active' : ''}`}
                    style={{ fontFamily: row.family }}
                    data-family={row.family}
                    onClick={() => handleSelect(row.name)}
                    onMouseEnter={() => setHighlighted(i)}
                  >
                    <span>{row.name}</span>
                  </button>
                ))}
              </>
            )}

            {sections.all.length > 0 && (
              <>
                {sections.recent.length > 0 && <div className="pg-font-section-header">All fonts</div>}
                {sections.all.map((row, i) => {
                  const flatIndex = sections.recent.length + i;
                  return (
                    <button
                      key={`all-${row.name}`}
                      type="button"
                      className={`pg-font-row${highlighted === flatIndex ? ' highlighted' : ''}${row.name === value.name ? ' active' : ''}`}
                      style={{ fontFamily: row.family }}
                      data-family={row.family}
                      onClick={() => handleSelect(row.name)}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                    >
                      <span>{row.name}</span>
                    </button>
                  );
                })}
              </>
            )}

            {flatRows.length === 0 && (
              <div className="pg-font-empty">
                No fonts match "{query}". Try a different search or clear the filter.
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
