import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CURATED_FONTS, isCuratedFont } from '../../../../../src/engine/font-catalog';
import { loadGoogleFontByFamily, type FontEntry, getFontByName } from '../engine/fonts';

interface GoogleFont {
  family: string;
  category: string;
  subsets: string[];
  variants: string[];
  popularity: number;
}

interface Props {
  value: FontEntry;
  onChange: (value: FontEntry) => void;
  accent: string;
}

const RECENT_KEY = 'pg-recent-fonts';
const RECENT_MAX = 5;

const CHIP_DEFS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'sans', label: 'Sans', match: (f: GoogleFont) => f.category === 'sans-serif' },
  { id: 'serif', label: 'Serif', match: (f: GoogleFont) => f.category === 'serif' },
  { id: 'display', label: 'Display', match: (f: GoogleFont) => f.category === 'display' },
  { id: 'mono', label: 'Mono', match: (f: GoogleFont) => f.category === 'monospace' },
  { id: 'handwriting', label: 'Handwriting', match: (f: GoogleFont) => f.category === 'handwriting' },
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

function syntheticEntryFromGoogle(family: string): FontEntry {
  // For Preview-only fonts, build a synthetic FontEntry on the fly
  return {
    name: family,
    family,
    slug: family.toLowerCase().replace(/\s+/g, '-'),
    weights: [400, 700],
    category: 'sans-serif',
    subsets: ['latin'],
    google: `${family.replace(/ /g, '+')}:wght@400;700`,
    scripts: ['Latin'],
  };
}

export function FontCombobox({ value, onChange, accent }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipId>('all');
  const [allFonts, setAllFonts] = useState<GoogleFont[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Lazy-load the Google Fonts JSON the first time the dropdown opens
  useEffect(() => {
    if (!open || allFonts.length > 0) return;
    fetch('/google-fonts.json')
      .then((r) => r.json())
      .then((data: GoogleFont[]) => setAllFonts(data))
      .catch((err) => console.error('Failed to load /google-fonts.json:', err));
  }, [open, allFonts.length]);

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

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.parentElement?.contains(e.target as Node)) {
        setOpen(false);
      }
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

  // Build the section data
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chipDef = CHIP_DEFS.find((c) => c.id === chip) ?? CHIP_DEFS[0];

    const matchesQuery = (family: string) => !q || family.toLowerCase().includes(q);

    // Recent section
    const recentSection = recents
      .filter((name) => matchesQuery(name))
      .map((name) => {
        const curated = CURATED_FONTS.find((f) => f.name === name);
        return {
          family: name,
          category: curated?.category ?? 'sans-serif',
          curated: !!curated,
        };
      });

    // Build a map of curated names for fast lookup
    const curatedNames = new Set(CURATED_FONTS.map((f) => f.name));

    // Curated section (API ready)
    const curatedSection = CURATED_FONTS
      .filter((f) => matchesQuery(f.family))
      .filter((f) => {
        if (chip === 'all') return true;
        return chipDef.match({ family: f.family, category: f.category, subsets: f.subsets, variants: [], popularity: 0 });
      })
      .map((f) => ({ family: f.name, category: f.category, curated: true }))
      .sort((a, b) => a.family.localeCompare(b.family));

    // Preview-only section (the Google Fonts dump minus curated)
    const previewSection = allFonts
      .filter((f) => !curatedNames.has(f.family))
      .filter((f) => matchesQuery(f.family))
      .filter((f) => chipDef.match(f))
      .map((f) => ({ family: f.family, category: f.category, curated: false }));

    return { recent: recentSection, curated: curatedSection, preview: previewSection };
  }, [query, chip, allFonts, recents]);

  // Flatten for keyboard navigation
  const flatRows = useMemo(() => {
    return [...sections.recent, ...sections.curated, ...sections.preview];
  }, [sections]);

  const handleSelect = useCallback(
    (family: string) => {
      const curated = CURATED_FONTS.find((f) => f.name === family);
      const entry: FontEntry = curated
        ? getFontByName(curated.name)
        : syntheticEntryFromGoogle(family);

      // Make sure the font CSS is loaded so the canvas re-render uses it
      loadGoogleFontByFamily(entry.family, entry.weights);

      onChange(entry);

      // Update recents
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
      if (target) handleSelect(target.family);
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

  const isPreviewOnly = !isCuratedFont(value.name);

  return (
    <div className="pg-font-combobox" ref={dropdownRef}>
      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>
        Font
      </div>
      <button
        type="button"
        className="pg-font-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ fontFamily: value.family }}
      >
        <span>
          {value.name}
          {isPreviewOnly && (
            <span className="pg-font-preview-badge" style={{ marginLeft: 8 }}>
              Preview only
            </span>
          )}
        </span>
        <span className="pg-font-trigger-chevron">▼</span>
      </button>

      {open && (
        <div className="pg-font-dropdown" onKeyDown={handleKeyDown}>
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
                    key={`recent-${row.family}`}
                    type="button"
                    className={`pg-font-row${highlighted === i ? ' highlighted' : ''}${row.family === value.name ? ' active' : ''}`}
                    style={{ fontFamily: row.family }}
                    data-family={row.family}
                    onClick={() => handleSelect(row.family)}
                    onMouseEnter={() => setHighlighted(i)}
                  >
                    <span>{row.family}</span>
                    {!row.curated && <span className="pg-font-preview-badge">Preview only</span>}
                  </button>
                ))}
              </>
            )}

            {sections.curated.length > 0 && (
              <>
                <div className="pg-font-section-header">API ready</div>
                {sections.curated.map((row, i) => {
                  const flatIndex = sections.recent.length + i;
                  return (
                    <button
                      key={`curated-${row.family}`}
                      type="button"
                      className={`pg-font-row${highlighted === flatIndex ? ' highlighted' : ''}${row.family === value.name ? ' active' : ''}`}
                      style={{ fontFamily: row.family }}
                      data-family={row.family}
                      onClick={() => handleSelect(row.family)}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                    >
                      <span>{row.family}</span>
                    </button>
                  );
                })}
              </>
            )}

            {sections.preview.length > 0 && (
              <>
                <div className="pg-font-section-header">Preview only</div>
                {sections.preview.map((row, i) => {
                  const flatIndex = sections.recent.length + sections.curated.length + i;
                  return (
                    <button
                      key={`preview-${row.family}`}
                      type="button"
                      className={`pg-font-row${highlighted === flatIndex ? ' highlighted' : ''}${row.family === value.name ? ' active' : ''}`}
                      style={{ fontFamily: row.family }}
                      data-family={row.family}
                      onClick={() => handleSelect(row.family)}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                    >
                      <span>{row.family}</span>
                      <span className="pg-font-preview-badge">Preview only</span>
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
        </div>
      )}
    </div>
  );
}
