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

export function randomPreset(): PresetData {
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
      <span style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase' }}>
        Quick Start
      </span>

      <button
        onClick={() => onSelect(randomPreset())}
        className="pg-surprise-btn"
        aria-label="Randomize all settings"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: `1px solid ${accent}55`,
          background: `linear-gradient(135deg, ${accent}1a, ${accent}08)`,
          color: '#e2e8f0', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', letterSpacing: 0.3,
          transition: 'transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        }}
      >
        <span>
          <span style={{ marginRight: 8 }}>🎲</span>
          Surprise me
        </span>
        <kbd
          style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            border: `1px solid ${accent}66`, background: `${accent}14`,
            color: accent, fontFamily: 'var(--sl-font-mono)', letterSpacing: 0,
          }}
        >
          R
        </kbd>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            className="pg-preset-card"
            onClick={() => onSelect(p.data)}
            style={{
              padding: '10px 12px', borderRadius: 8, textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 4 }}>{p.emoji}</div>
            <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
            <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', lineHeight: 1.3 }}>{p.data.tag}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
