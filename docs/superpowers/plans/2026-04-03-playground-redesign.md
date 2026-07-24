# Playground Live Render Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Playground live render component from a utilitarian form into a polished, interactive creative tool with animations, presets, collapsible sections, responsive layout, drag-and-drop, fullscreen preview, and syntax-highlighted code output.

**Architecture:** All improvements target the docs site React components under `docs/site/src/components/`. No new npm dependencies — all animations use CSS transitions/keyframes, syntax highlighting is hand-rolled with regex spans. State management stays in component-local `useState` hooks. A new CSS file provides shared animations and utility classes. The existing `canvas-renderer.ts` and engine files remain untouched.

**Tech Stack:** React 19, CSS (no Tailwind in this project — all inline styles + one shared CSS module), Canvas API, Astro/Starlight docs site.

---

## File Map

### New files
- `docs/site/src/components/playground.css` — Shared CSS for animations, transitions, focus states, hover effects, keyframes
- `docs/site/src/components/ui/Presets.tsx` — Preset cards + randomize button
- `docs/site/src/components/ui/Section.tsx` — Collapsible control section wrapper
- `docs/site/src/components/ui/RenderHUD.tsx` — Floating render stats overlay on canvas
- `docs/site/src/components/ui/FullscreenPreview.tsx` — Fullscreen modal for 1:1 canvas preview
- `docs/site/src/components/ui/DropZone.tsx` — Drag-and-drop background image overlay
- `docs/site/src/components/ui/SyntaxPre.tsx` — Minimal syntax-highlighted `<pre>` block

### Modified files
- `docs/site/src/components/Playground.tsx` — Major rewrite: new layout, sections, presets, HUD, fullscreen, drop zone, crossfade canvas, responsive
- `docs/site/src/components/PlaygroundMini.tsx` — Add focus styles, render pulse
- `docs/site/src/components/PlaygroundContextual.tsx` — Add focus styles, sections, responsive
- `docs/site/src/components/ui/StyleControls.tsx` — Add hover/press animations via CSS classes, focus glow on slider
- `docs/site/src/components/ui/FormatSelector.tsx` — Add hover/press animations
- `docs/site/src/components/ui/CodeOutput.tsx` — Replace plain `<pre>` with `SyntaxPre`, add JSON tab
- `docs/site/src/components/ui/TemplateSelector.tsx` — Add hover/press animations

---

## Task 1: Shared CSS — Animations, Focus States, Hover Effects

**Files:**
- Create: `docs/site/src/components/playground.css`

This CSS file provides all the animation infrastructure used by every subsequent task. It must be created first.

- [ ] **Step 1: Create the shared CSS file**

```css
/* docs/site/src/components/playground.css */

/* ── Focus states (accessibility) ── */
.pg-input:focus {
  box-shadow: 0 0 0 2px rgba(56, 239, 125, 0.2);
  border-color: rgba(56, 239, 125, 0.3) !important;
}

.pg-input {
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

/* ── Picker button hover/press ── */
.pg-picker-btn {
  transition: transform 0.12s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.pg-picker-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.pg-picker-btn:active {
  transform: scale(0.95);
}

/* ── Download button ── */
.pg-download-btn {
  transition: transform 0.1s ease, box-shadow 0.2s ease;
}

.pg-download-btn:hover {
  box-shadow: 0 4px 16px rgba(56, 239, 125, 0.25);
}

.pg-download-btn:active {
  transform: scale(0.96);
}

/* ── Render time pulse ── */
@keyframes pg-pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.pg-render-pulse {
  animation: pg-pulse 0.3s ease;
}

/* ── Canvas crossfade ── */
.pg-canvas-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
}

.pg-canvas-wrapper canvas {
  display: block;
  width: 100%;
  transition: opacity 0.15s ease;
}

/* ── Section collapse ── */
.pg-section-body {
  overflow: hidden;
  transition: max-height 0.25s ease, opacity 0.2s ease;
}

.pg-section-body.collapsed {
  max-height: 0 !important;
  opacity: 0;
}

.pg-section-toggle {
  transition: transform 0.2s ease;
}

.pg-section-toggle.collapsed {
  transform: rotate(-90deg);
}

/* ── Fullscreen modal ── */
@keyframes pg-modal-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pg-modal-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
}

.pg-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: pg-modal-in 0.2s ease;
}

.pg-modal-backdrop.closing {
  animation: pg-modal-out 0.15s ease forwards;
}

/* ── Drop zone ── */
@keyframes pg-dropzone-pulse {
  0%, 100% { border-color: rgba(56, 239, 125, 0.3); }
  50% { border-color: rgba(56, 239, 125, 0.7); }
}

.pg-dropzone {
  position: absolute;
  inset: 0;
  border: 2px dashed rgba(56, 239, 125, 0.3);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 10;
  animation: pg-dropzone-pulse 1.2s ease infinite;
  pointer-events: none;
}

/* ── Preset cards ── */
.pg-preset-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}

.pg-preset-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.pg-preset-card:active {
  transform: translateY(0);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .pg-layout {
    grid-template-columns: 1fr !important;
  }

  .pg-preview-col {
    position: sticky !important;
    top: 16px;
    z-index: 5;
  }
}

/* ── Sticky preview (desktop) ── */
@media (min-width: 769px) {
  .pg-preview-col {
    position: sticky;
    top: 20px;
    align-self: start;
  }
}

/* ── Accent color as CSS var (set via inline style on root) ── */
.pg-input:focus {
  box-shadow: 0 0 0 2px var(--pg-accent-alpha, rgba(56, 239, 125, 0.2));
  border-color: var(--pg-accent-border, rgba(56, 239, 125, 0.3)) !important;
}
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `cat docs/site/src/components/playground.css | head -5`
Expected: First lines show the CSS comment and `.pg-input:focus` rule.

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/components/playground.css
git commit -m "feat(playground): add shared CSS for animations, focus states, hover effects"
```

---

## Task 2: Collapsible Section Component

**Files:**
- Create: `docs/site/src/components/ui/Section.tsx`

- [ ] **Step 1: Create the Section component**

```tsx
// docs/site/src/components/ui/Section.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/Section.tsx
git commit -m "feat(playground): add collapsible Section component"
```

---

## Task 3: Preset Cards + Randomize

**Files:**
- Create: `docs/site/src/components/ui/Presets.tsx`

- [ ] **Step 1: Create the Presets component**

```tsx
// docs/site/src/components/ui/Presets.tsx
import type { Gradient } from '../engine/gradients';
import type { FontEntry } from '../engine/fonts';
import { GRADIENTS, ACCENTS } from '../engine/gradients';
import { FONTS } from '../engine/fonts';

export interface PresetData {
  title: string;
  description: string;
  author: string;
  tag: string;
  accent: string;
  gradient: Gradient;
  fontEntry: FontEntry;
  layout: 'left' | 'center' | 'bottom';
  titleSize: number;
  descSize: number;
}

const PRESETS: Array<{ name: string; emoji: string; data: PresetData }> = [
  {
    name: 'Startup Launch',
    emoji: '\u{1F680}',
    data: {
      title: 'We Just Launched on Product Hunt',
      description: 'The fastest way to generate OG images. No headless browser, no Puppeteer, just pure speed.',
      author: 'OG Engine', tag: 'Launch Day',
      accent: '#38ef7d', gradient: GRADIENTS[0], fontEntry: FONTS[0],
      layout: 'left', titleSize: 52, descSize: 22,
    },
  },
  {
    name: 'Blog Post',
    emoji: '\u{270F}\u{FE0F}',
    data: {
      title: 'Understanding Text Layout Algorithms',
      description: 'A deep dive into how modern engines break text into lines, handle bidirectional scripts, and measure grapheme clusters.',
      author: 'Engineering Blog', tag: 'Deep Dive',
      accent: '#67e8f9', gradient: GRADIENTS[1], fontEntry: FONTS[2],
      layout: 'left', titleSize: 46, descSize: 20,
    },
  },
  {
    name: 'Event Invite',
    emoji: '\u{1F389}',
    data: {
      title: 'DevConf 2026',
      description: 'Join 2,000 developers for three days of talks, workshops, and hallway conversations.',
      author: 'June 15-17 \u00b7 Berlin', tag: 'Conference',
      accent: '#c4b5fd', gradient: GRADIENTS[4], fontEntry: FONTS[3],
      layout: 'center', titleSize: 56, descSize: 22,
    },
  },
  {
    name: 'SaaS Feature',
    emoji: '\u{2728}',
    data: {
      title: 'Introducing Batch Rendering',
      description: 'Generate thousands of images in a single API call. Perfect for e-commerce catalogs and dynamic content at scale.',
      author: 'OG Engine v2.0', tag: 'New Feature',
      accent: '#fbbf24', gradient: GRADIENTS[2], fontEntry: FONTS[0],
      layout: 'left', titleSize: 48, descSize: 21,
    },
  },
];

function randomPreset(): PresetData {
  const accent = ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
  const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
  const fontEntry = FONTS[Math.floor(Math.random() * FONTS.length)];
  const layouts: Array<'left' | 'center' | 'bottom'> = ['left', 'center', 'bottom'];
  const layout = layouts[Math.floor(Math.random() * layouts.length)];
  const titleSize = 36 + Math.floor(Math.random() * 24);
  const descSize = 16 + Math.floor(Math.random() * 10);
  return {
    title: PRESETS[Math.floor(Math.random() * PRESETS.length)].data.title,
    description: PRESETS[Math.floor(Math.random() * PRESETS.length)].data.description,
    author: '', tag: '',
    accent, gradient, fontEntry, layout, titleSize, descSize,
  };
}

interface Props {
  onSelect: (data: PresetData) => void;
  accent: string;
}

export function Presets({ onSelect, accent }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' }}>
          Quick Start
        </span>
        <button
          onClick={() => onSelect(randomPreset())}
          className="pg-picker-btn"
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
            border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
            color: '#64748b', cursor: 'pointer', letterSpacing: 0.5,
          }}
        >
          \u{1F3B2} Randomize
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            className="pg-preset-card"
            onClick={() => onSelect(p.data)}
            style={{
              padding: '10px 12px', borderRadius: 8, textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 4 }}>{p.emoji}</div>
            <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
            <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.3 }}>{p.data.tag}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/Presets.tsx
git commit -m "feat(playground): add preset cards and randomize button"
```

---

## Task 4: Floating Render HUD

**Files:**
- Create: `docs/site/src/components/ui/RenderHUD.tsx`

- [ ] **Step 1: Create the RenderHUD component**

```tsx
// docs/site/src/components/ui/RenderHUD.tsx
import { useState, useEffect } from 'react';
import type { RenderResult } from '../engine/canvas-renderer';

interface Props {
  renderTime: number;
  info: RenderResult | null;
  accent: string;
}

export function RenderHUD({ renderTime, info, accent }: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 300);
    return () => clearTimeout(id);
  }, [renderTime]);

  return (
    <div
      style={{
        position: 'absolute', bottom: 10, right: 10, zIndex: 5,
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '6px 12px', borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 10, fontFamily: 'var(--sl-font-mono, monospace)',
        color: '#94a3b8', pointerEvents: 'none',
      }}
    >
      <span className={pulse ? 'pg-render-pulse' : ''} style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {renderTime.toFixed(1)}ms
      </span>
      {info && (
        <>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span>{info.titleVisibleLines}L title</span>
          {info.overflow && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              <span style={{ color: '#fb7185' }}>overflow</span>
            </>
          )}
        </>
      )}
      <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
      <span style={{ color: '#fbbf24' }}>{Math.round(850 / Math.max(0.1, renderTime))}x</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/RenderHUD.tsx
git commit -m "feat(playground): add floating render HUD overlay"
```

---

## Task 5: Fullscreen Preview Modal

**Files:**
- Create: `docs/site/src/components/ui/FullscreenPreview.tsx`

- [ ] **Step 1: Create the FullscreenPreview component**

```tsx
// docs/site/src/components/ui/FullscreenPreview.tsx
import { useState, useEffect, useCallback } from 'react';

interface Props {
  canvas: HTMLCanvasElement | null;
  onClose: () => void;
}

export function FullscreenPreview({ canvas, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  if (!canvas) return null;

  const dataUrl = canvas.toDataURL('image/png');

  return (
    <div
      className={`pg-modal-backdrop${closing ? ' closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        <img
          src={dataUrl}
          alt="Fullscreen preview"
          style={{
            maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          }}
        />
        <div style={{
          position: 'absolute', bottom: -40, left: 0, right: 0,
          textAlign: 'center', fontSize: 11, color: '#64748b',
        }}>
          {canvas.width} x {canvas.height}px &middot; Press <kbd style={{
            padding: '2px 6px', borderRadius: 4, fontSize: 10,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8',
          }}>Esc</kbd> to close
        </div>
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: -12, right: -12,
            width: 28, height: 28, borderRadius: 14,
            background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#94a3b8', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          \u00d7
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/FullscreenPreview.tsx
git commit -m "feat(playground): add fullscreen preview modal"
```

---

## Task 6: Drag-and-Drop Background Image

**Files:**
- Create: `docs/site/src/components/ui/DropZone.tsx`

- [ ] **Step 1: Create the DropZone component**

```tsx
// docs/site/src/components/ui/DropZone.tsx

interface Props {
  visible: boolean;
  accent: string;
}

export function DropZone({ visible, accent }: Props) {
  if (!visible) return null;

  return (
    <div className="pg-dropzone" style={{ borderColor: `${accent}44` }}>
      <div style={{
        textAlign: 'center', padding: 20, borderRadius: 12,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F5BC}\u{FE0F}'}</div>
        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>
          Drop image here
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          PNG, JPG, or WebP as background
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/DropZone.tsx
git commit -m "feat(playground): add drag-and-drop zone overlay"
```

---

## Task 7: Minimal Syntax-Highlighted Pre Block

**Files:**
- Create: `docs/site/src/components/ui/SyntaxPre.tsx`

- [ ] **Step 1: Create the SyntaxPre component**

```tsx
// docs/site/src/components/ui/SyntaxPre.tsx

interface Props {
  code: string;
  language: 'bash' | 'typescript' | 'json';
}

function highlightJSON(code: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  const regex = /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(true|false|null)|(-?\d+(?:\.\d+)?)|([{}[\],:])|(\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: code.slice(lastIndex, match.index), color: '#94a3b8' });
    }
    if (match[1]) {
      parts.push({ text: match[1], color: '#67e8f9' });
      parts.push({ text: match[2], color: '#64748b' });
    } else if (match[3]) {
      parts.push({ text: match[3], color: '#a5d6a7' });
    } else if (match[4]) {
      parts.push({ text: match[4], color: '#c4b5fd' });
    } else if (match[5]) {
      parts.push({ text: match[5], color: '#fbbf24' });
    } else if (match[6]) {
      parts.push({ text: match[6], color: '#475569' });
    } else if (match[7]) {
      parts.push({ text: match[7], color: '#94a3b8' });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push({ text: code.slice(lastIndex), color: '#94a3b8' });
  }

  return parts;
}

function highlightBash(code: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) parts.push({ text: '\n', color: '#94a3b8' });
    const line = lines[i];

    const lineRegex = /(curl|POST|GET|Bearer|--\w[\w-]*|-[A-Za-z]\b)|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(https?:\/\/\S+)|(\\\s*$)|(\S+)/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;

    while ((m = lineRegex.exec(line)) !== null) {
      if (m.index > lastIdx) {
        parts.push({ text: line.slice(lastIdx, m.index), color: '#94a3b8' });
      }
      if (m[1]) {
        parts.push({ text: m[1], color: '#67e8f9' });
      } else if (m[2]) {
        parts.push({ text: m[2], color: '#a5d6a7' });
      } else if (m[3]) {
        parts.push({ text: m[3], color: '#a5d6a7' });
      } else if (m[4]) {
        parts.push({ text: m[4], color: '#c4b5fd' });
      } else if (m[5]) {
        parts.push({ text: m[5], color: '#475569' });
      } else if (m[6]) {
        parts.push({ text: m[6], color: '#94a3b8' });
      }
      lastIdx = lineRegex.lastIndex;
    }

    if (lastIdx < line.length) {
      parts.push({ text: line.slice(lastIdx), color: '#94a3b8' });
    }
  }

  return parts;
}

function highlightTS(code: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  const regex = /(import|from|const|await|new|process)\b|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(`(?:[^`\\]|\\.)*`)|(\/\/.*$)|(\.[\w]+)|(\w+)/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: code.slice(lastIndex, match.index), color: '#94a3b8' });
    }
    if (match[1]) {
      parts.push({ text: match[1], color: '#c4b5fd' });
    } else if (match[2] || match[3] || match[4]) {
      parts.push({ text: match[0], color: '#a5d6a7' });
    } else if (match[5]) {
      parts.push({ text: match[5], color: '#475569' });
    } else if (match[6]) {
      parts.push({ text: match[6], color: '#67e8f9' });
    } else if (match[7]) {
      parts.push({ text: match[7], color: '#e2e8f0' });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push({ text: code.slice(lastIndex), color: '#94a3b8' });
  }

  return parts;
}

export function SyntaxPre({ code, language }: Props) {
  const highlight = language === 'json' ? highlightJSON : language === 'bash' ? highlightBash : highlightTS;
  const parts = highlight(code);

  return (
    <pre style={{
      margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6,
      overflowX: 'auto', background: '#0c0f1a', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      <code>
        {parts.map((p, i) => (
          <span key={i} style={{ color: p.color }}>{p.text}</span>
        ))}
      </code>
    </pre>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/SyntaxPre.tsx
git commit -m "feat(playground): add minimal syntax-highlighted pre block"
```

---

## Task 8: Update StyleControls with Hover/Focus Animations

**Files:**
- Modify: `docs/site/src/components/ui/StyleControls.tsx`

- [ ] **Step 1: Add CSS import and pg-picker-btn classes to all picker buttons**

At the top of `StyleControls.tsx`, add the CSS import:

```tsx
import '../playground.css';
```

Then update every `<button>` in AccentPicker, FontPicker, LayoutPicker, and GradientPicker to include `className="pg-picker-btn"`.

The full updated file:

```tsx
import '../playground.css';
import { ACCENTS, GRADIENTS, type Gradient } from '../engine/gradients';
import { FONTS, type FontEntry } from '../engine/fonts';

interface SliderProps {
  label: string; value: number; onChange: (value: number) => void;
  min: number; max: number; accent: string;
}

export function Slider({ label, value, onChange, min, max, accent }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginBottom: 3 }}>
        <span style={{ letterSpacing: 2, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pg-input"
        style={{
          width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
          background: `linear-gradient(90deg, ${accent}44 ${pct}%, rgba(255,255,255,0.06) 0%)`,
          borderRadius: 2, outline: 'none', cursor: 'pointer',
        }}
      />
    </div>
  );
}

interface AccentPickerProps { value: string; onChange: (value: string) => void; }
export function AccentPicker({ value, onChange }: AccentPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Accent</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {ACCENTS.map((hex) => (
          <button key={hex} onClick={() => onChange(hex)} className="pg-picker-btn" style={{
            width: 26, height: 26, borderRadius: 7, background: hex + '22',
            border: value === hex ? `2px solid ${hex}` : '2px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: hex }} />
          </button>
        ))}
      </div>
    </div>
  );
}

interface FontPickerProps { value: FontEntry; onChange: (value: FontEntry) => void; accent: string; }
export function FontPicker({ value, onChange, accent }: FontPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Font</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {FONTS.map((f) => {
          const active = value.name === f.name;
          return (
            <button key={f.name} onClick={() => onChange(f)} className="pg-picker-btn" style={{
              padding: '5px 8px', borderRadius: 6, fontSize: 9, fontFamily: 'inherit',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
              color: active ? accent : '#64748b', cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap',
            }}>{f.name}</button>
          );
        })}
      </div>
    </div>
  );
}

interface LayoutPickerProps { value: 'left' | 'center' | 'bottom'; onChange: (value: 'left' | 'center' | 'bottom') => void; accent: string; }
export function LayoutPicker({ value, onChange, accent }: LayoutPickerProps) {
  const options: Array<{ key: 'left' | 'center' | 'bottom'; label: string }> = [
    { key: 'left', label: 'Left' }, { key: 'center', label: 'Center' }, { key: 'bottom', label: 'Bottom' },
  ];
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Layout</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <button key={o.key} onClick={() => onChange(o.key)} className="pg-picker-btn" style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
              color: active ? accent : '#64748b', cursor: 'pointer', letterSpacing: 0.5,
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

interface GradientPickerProps { value: Gradient; onChange: (value: Gradient) => void; accent: string; }
export function GradientPicker({ value, onChange, accent }: GradientPickerProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Gradient</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {GRADIENTS.map((g) => (
          <button key={g.slug} onClick={() => onChange(g)} title={g.name} className="pg-picker-btn" style={{
            width: 40, height: 28, borderRadius: 6, cursor: 'pointer', padding: 0,
            background: `linear-gradient(135deg, ${g.stops[0]}, ${g.stops[1]})`,
            border: value.slug === g.slug ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.08)',
          }} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/StyleControls.tsx
git commit -m "feat(playground): add hover/press animations and focus glow to style controls"
```

---

## Task 9: Update FormatSelector with Hover Animations

**Files:**
- Modify: `docs/site/src/components/ui/FormatSelector.tsx`

- [ ] **Step 1: Add CSS import and className to buttons**

```tsx
import '../playground.css';
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/FormatSelector.tsx
git commit -m "feat(playground): add hover/press animations to format selector"
```

---

## Task 10: Update TemplateSelector with Hover Animations

**Files:**
- Modify: `docs/site/src/components/ui/TemplateSelector.tsx`

- [ ] **Step 1: Add CSS import and className**

```tsx
import '../playground.css';

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
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/TemplateSelector.tsx
git commit -m "feat(playground): add hover/press animations to template selector"
```

---

## Task 11: Update CodeOutput with Syntax Highlighting + JSON Tab

**Files:**
- Modify: `docs/site/src/components/ui/CodeOutput.tsx`

- [ ] **Step 1: Replace the plain pre with SyntaxPre and add JSON tab**

```tsx
import { useState } from 'react';
import type { FormatKey } from '../engine/formats';
import { SyntaxPre } from './SyntaxPre';

interface Config {
  format: FormatKey; title: string; description: string; author: string; tag: string;
  accent: string; font: string; titleSize: number; descSize: number; layout: string; gradient: string;
}

interface Props { config: Config; accent: string; }

function buildCurl(config: Config): string {
  const body: Record<string, unknown> = { format: config.format, title: config.title };
  if (config.description) body.description = config.description;
  if (config.author) body.author = config.author;
  if (config.tag) body.tag = config.tag;
  const style: Record<string, unknown> = {};
  if (config.accent !== '#38ef7d') style.accent = config.accent;
  if (config.font !== 'Outfit') style.font = config.font;
  if (config.titleSize !== 48) style.titleSize = config.titleSize;
  if (config.descSize !== 22) style.descSize = config.descSize;
  if (config.layout !== 'left') style.layout = config.layout;
  if (Object.keys(style).length > 0) body.style = style;
  const json = JSON.stringify(body, null, 2);
  return `curl -X POST https://api.og-engine.com/render \\
  -H "Authorization: Bearer oge_sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${json}' \\
  --output image.png`;
}

function buildSDK(config: Config): string {
  const opts: string[] = [`  format: '${config.format}'`, `  title: '${config.title}'`];
  if (config.description) opts.push(`  description: '${config.description}'`);
  if (config.tag) opts.push(`  tag: '${config.tag}'`);
  const styleOpts: string[] = [];
  if (config.accent !== '#38ef7d') styleOpts.push(`    accent: '${config.accent}'`);
  if (config.font !== 'Outfit') styleOpts.push(`    font: '${config.font}'`);
  if (styleOpts.length > 0) opts.push(`  style: {\n${styleOpts.join(',\n')}\n  }`);
  return `import { OGEngine } from '@atypical-consulting/og-engine-sdk'\n\nconst og = new OGEngine(process.env.OG_ENGINE_API_KEY!)\n\nconst image = await og.render({\n${opts.join(',\n')}\n})`;
}

function buildJSON(config: Config): string {
  const body: Record<string, unknown> = { format: config.format, title: config.title };
  if (config.description) body.description = config.description;
  if (config.author) body.author = config.author;
  if (config.tag) body.tag = config.tag;
  const style: Record<string, unknown> = {};
  if (config.accent !== '#38ef7d') style.accent = config.accent;
  if (config.font !== 'Outfit') style.font = config.font;
  if (config.titleSize !== 48) style.titleSize = config.titleSize;
  if (config.descSize !== 22) style.descSize = config.descSize;
  if (config.layout !== 'left') style.layout = config.layout;
  if (config.gradient !== 'void') style.gradient = config.gradient;
  if (Object.keys(style).length > 0) body.style = style;
  body.output = { format: 'png', quality: 90 };
  return JSON.stringify(body, null, 2);
}

type Tab = 'curl' | 'sdk' | 'json';

export function CodeOutput({ config, accent }: Props) {
  const [tab, setTab] = useState<Tab>('curl');
  const [copied, setCopied] = useState(false);
  const code = tab === 'curl' ? buildCurl(config) : tab === 'sdk' ? buildSDK(config) : buildJSON(config);
  const lang = tab === 'curl' ? 'bash' : tab === 'sdk' ? 'typescript' : 'json';
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['curl', 'sdk', 'json'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: 9, color: tab === t ? accent : '#475569', background: 'none',
              border: 'none', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'inherit', padding: 0,
              transition: 'color 0.15s ease',
            }}>{t}</button>
          ))}
        </div>
        <button onClick={copy} style={{ fontSize: 9, color: copied ? accent : '#475569', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s ease' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxPre code={code} language={lang} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/ui/CodeOutput.tsx
git commit -m "feat(playground): add JSON tab and syntax highlighting to code output"
```

---

## Task 12: Rewrite Main Playground Component

This is the largest task — it integrates all the new sub-components and adds canvas crossfade, drag-and-drop, fullscreen, presets, sections, responsive layout, and the floating HUD.

**Files:**
- Modify: `docs/site/src/components/Playground.tsx`

- [ ] **Step 1: Rewrite the full Playground component**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import './playground.css';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import { FORMATS, type FormatKey } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { CodeOutput } from './ui/CodeOutput';
import { Section } from './ui/Section';
import { Presets, type PresetData } from './ui/Presets';
import { RenderHUD } from './ui/RenderHUD';
import { FullscreenPreview } from './ui/FullscreenPreview';
import { DropZone } from './ui/DropZone';

export default function Playground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('Server-Side Text Layout Without a Browser');
  const [description, setDescription] = useState('Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content.');
  const [author, setAuthor] = useState('Pretext Engine');
  const [tag, setTag] = useState('Open Source');
  const [format, setFormat] = useState<FormatKey>('og');
  const [accent, setAccent] = useState('#38ef7d');
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>('left');
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontEntry, setFontEntry] = useState<FontEntry>(FONTS[0]);
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const result = renderCard(canvas, {
        title, description, author, tag, format, accent, layout,
        titleSize, descSize, fontEntry, gradient, bgImage, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
      setInfo(result);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description, author, tag, format, accent, layout, titleSize, descSize, fontEntry, gradient, bgImage]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `og-${format}-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }, [format]);

  const applyPreset = useCallback((data: PresetData) => {
    setTitle(data.title);
    setDescription(data.description);
    setAuthor(data.author);
    setTag(data.tag);
    setAccent(data.accent);
    setGradient(data.gradient);
    setFontEntry(data.fontEntry);
    setLayout(data.layout);
    setTitleSize(data.titleSize);
    setDescSize(data.descSize);
    setBgImage(null);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => setBgImage(img);
    img.src = URL.createObjectURL(file);
  }, []);

  const clearBgImage = useCallback(() => setBgImage(null), []);

  const fmt = FORMATS[format];

  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', lineHeight: '1.5',
  };

  const accentAlpha = accent + '33';
  const accentBorder = accent + '4d';

  return (
    <div
      className="pg-layout"
      style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 600,
        ['--pg-accent-alpha' as string]: accentAlpha,
        ['--pg-accent-border' as string]: accentBorder,
      }}
    >
      {/* Controls column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Presets onSelect={applyPreset} accent={accent} />

        <Section title="Format">
          <FormatSelector value={format} onChange={setFormat} accent={accent} />
        </Section>

        <Section title="Content">
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Tag</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="pg-input" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Author</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className="pg-input" style={inputStyle} />
          </div>
        </Section>

        <Section title="Colors">
          <AccentPicker value={accent} onChange={setAccent} />
          <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
        </Section>

        <Section title="Typography">
          <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
          <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
          <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
          <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
        </Section>
      </div>

      {/* Preview column */}
      <div className="pg-preview-col" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          className="pg-canvas-wrapper"
          style={{ border: `1px solid ${accent}15` }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
          <RenderHUD renderTime={renderTime} info={info} accent={accent} />
          <DropZone visible={dragging} accent={accent} />
        </div>

        {bgImage && (
          <button
            onClick={clearBgImage}
            className="pg-picker-btn"
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 10, fontFamily: 'inherit',
              border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
              color: '#64748b', cursor: 'pointer', alignSelf: 'flex-start',
            }}
          >
            {'\u2715'} Remove background image
          </button>
        )}

        {/* Response headers */}
        {info && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2, marginBottom: 8 }}>RESPONSE HEADERS</div>
            {[
              ['X-Render-Time-Ms', renderTime.toFixed(2)],
              ['X-Title-Lines', String(info.titleVisibleLines)],
              ['X-Desc-Lines', String(info.descVisibleLines)],
              ['X-Layout-Overflow', String(info.overflow)],
              ['Content-Type', 'image/png'],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sl-font-mono)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={download} className="pg-download-btn" style={{
            flex: 1, padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
            fontWeight: 700, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: '#06080c',
          }}>Download PNG</button>
          <button
            onClick={() => setShowFullscreen(true)}
            className="pg-picker-btn"
            style={{
              padding: '12px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
              color: '#94a3b8', cursor: 'pointer',
            }}
            title="Fullscreen preview"
          >
            {'\u26F6'}
          </button>
        </div>

        <CodeOutput config={{ format, title, description, author, tag, accent, font: fontEntry.name, titleSize, descSize, layout, gradient: gradient.slug }} accent={accent} />

        {showFullscreen && (
          <FullscreenPreview canvas={canvasRef.current} onClose={() => setShowFullscreen(false)} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/Playground.tsx
git commit -m "feat(playground): major rewrite with presets, sections, HUD, fullscreen, drag-and-drop, responsive layout"
```

---

## Task 13: Update PlaygroundMini with Focus Styles + Render Pulse

**Files:**
- Modify: `docs/site/src/components/PlaygroundMini.tsx`

- [ ] **Step 1: Add CSS import, pg-input classes, and render pulse**

```tsx
import { useState, useEffect, useRef } from 'react';
import './playground.css';
import { renderCard } from './engine/canvas-renderer';
import { GRADIENTS } from './engine/gradients';
import { FONTS, loadGoogleFont } from './engine/fonts';
import { FORMATS } from './engine/formats';

export default function PlaygroundMini() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('Server-Side Text Layout Without a Browser');
  const [description, setDescription] = useState('Pure JavaScript text measurement replaces Puppeteer. Sub-millisecond layout for OG images.');
  const [renderTime, setRenderTime] = useState(0);
  const [pulse, setPulse] = useState(false);
  const accent = '#38ef7d';
  const fontEntry = FONTS[0];
  useEffect(() => { loadGoogleFont(fontEntry); }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      renderCard(canvas, {
        title, description, author: '', tag: '', format: 'og',
        accent, layout: 'left', titleSize: 48, descSize: 22,
        fontEntry, gradient: GRADIENTS[0], bgImage: null, overlayOpacity: 0.65,
      });
      const time = performance.now() - t0;
      setRenderTime(time);
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description]);
  const fmt = FORMATS.og;
  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="pg-canvas-wrapper" style={{ marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a title..."
          className="pg-input" style={inputStyle} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter a description..."
          className="pg-input" style={inputStyle} />
      </div>
      <div style={{ fontSize: 10, color: '#475569', textAlign: 'center' }}>
        Rendered in{' '}
        <span className={pulse ? 'pg-render-pulse' : ''} style={{ color: accent, fontVariantNumeric: 'tabular-nums', display: 'inline-block' }}>
          {renderTime.toFixed(1)}ms
        </span>
        {' \u00b7 '}
        <span style={{ color: '#fbbf24' }}>{Math.round(850 / Math.max(0.1, renderTime))}x faster</span> than Puppeteer
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/PlaygroundMini.tsx
git commit -m "feat(playground): add focus styles and render pulse to PlaygroundMini"
```

---

## Task 14: Update PlaygroundContextual with Sections + Focus Styles

**Files:**
- Modify: `docs/site/src/components/PlaygroundContextual.tsx`

- [ ] **Step 1: Add CSS import, sections, focus styles, and responsive classes**

```tsx
import { useState, useEffect, useRef } from 'react';
import './playground.css';
import { renderCard, type RenderResult } from './engine/canvas-renderer';
import { GRADIENTS, type Gradient } from './engine/gradients';
import { FONTS, loadGoogleFont, type FontEntry } from './engine/fonts';
import type { FormatKey } from './engine/formats';
import { FORMATS } from './engine/formats';
import { FormatSelector } from './ui/FormatSelector';
import { AccentPicker, FontPicker, LayoutPicker, GradientPicker, Slider } from './ui/StyleControls';
import { TemplateSelector } from './ui/TemplateSelector';
import { Section } from './ui/Section';
import { RenderHUD } from './ui/RenderHUD';

interface Props {
  panels?: Array<'content' | 'format' | 'style' | 'template'>;
  initialTitle?: string;
  initialDescription?: string;
  initialFormat?: FormatKey;
  initialAccent?: string;
}

export default function PlaygroundContextual({
  panels = ['content', 'format'],
  initialTitle = 'Hello, OG Engine',
  initialDescription = 'Generated in 2ms, no browser needed.',
  initialFormat = 'og',
  initialAccent = '#38ef7d',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [format, setFormat] = useState<FormatKey>(initialFormat);
  const [accent, setAccent] = useState(initialAccent);
  const [layout, setLayout] = useState<'left' | 'center' | 'bottom'>('left');
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontEntry, setFontEntry] = useState<FontEntry>(FONTS[0]);
  const [gradient, setGradient] = useState<Gradient>(GRADIENTS[0]);
  const [template, setTemplate] = useState('default');
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState<RenderResult | null>(null);
  useEffect(() => { loadGoogleFont(fontEntry); }, [fontEntry]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const result = renderCard(canvas, {
        title, description, author: '', tag: '', format, accent, layout,
        titleSize, descSize, fontEntry, gradient, bgImage: null, overlayOpacity: 0.65,
      });
      setRenderTime(performance.now() - t0);
      setInfo(result);
    }, 50);
    return () => clearTimeout(id);
  }, [title, description, format, accent, layout, titleSize, descSize, fontEntry, gradient, template]);
  const fmt = FORMATS[format];
  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
    color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div className="pg-canvas-wrapper" style={{ marginBottom: 12, border: `1px solid ${accent}15` }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block', aspectRatio: `${fmt.w}/${fmt.h}` }} />
        <RenderHUD renderTime={renderTime} info={info} accent={accent} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {panels.includes('format') && (
          <Section title="Format" defaultOpen={true}>
            <FormatSelector value={format} onChange={setFormat} accent={accent} />
          </Section>
        )}
        {panels.includes('template') && (
          <Section title="Template" defaultOpen={true}>
            <TemplateSelector value={template} onChange={setTemplate} accent={accent} />
          </Section>
        )}
        {panels.includes('content') && (
          <Section title="Content" defaultOpen={true}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="pg-input" style={inputStyle} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="pg-input" style={inputStyle} />
          </Section>
        )}
        {panels.includes('style') && (
          <Section title="Style" defaultOpen={true}>
            <AccentPicker value={accent} onChange={setAccent} />
            <FontPicker value={fontEntry} onChange={setFontEntry} accent={accent} />
            <LayoutPicker value={layout} onChange={setLayout} accent={accent} />
            <GradientPicker value={gradient} onChange={setGradient} accent={accent} />
            <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
            <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
          </Section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/components/PlaygroundContextual.tsx
git commit -m "feat(playground): add sections, HUD, focus styles to PlaygroundContextual"
```

---

## Task 15: Build Verification

- [ ] **Step 1: Run the Astro build to verify no compilation errors**

Run: `cd docs/site && npx astro build`
Expected: Build completes with no TypeScript or import errors.

- [ ] **Step 2: If errors, fix them**

Common issues:
- Missing CSS import paths (relative paths must match file location)
- Type mismatches in PresetData interface

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(playground): resolve build errors from redesign"
```
