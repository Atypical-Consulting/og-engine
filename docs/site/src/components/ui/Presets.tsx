import type { Gradient } from '../engine/gradients';
import type { FontEntry } from '../engine/fonts';
import { GRADIENTS, ACCENTS } from '../engine/gradients';
import { FONTS, getFontByName } from '../engine/fonts';

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
    name: 'Recipe Blog',
    emoji: '\u{1F35C}',
    data: {
      title: 'The Only Ramen Broth Recipe You Need',
      description:
        'A 12-hour pork-and-chicken tonkotsu that you can actually make on a Sunday. Forgiving, creamy, bottomless flavor.',
      author: 'Marta Okafor',
      tag: 'Slow Kitchen',
      accent: '#fb923c',
      gradient: GRADIENTS[2], // Ember
      fontEntry: getFontByName('Playfair Display'),
      layout: 'left',
      titleSize: 54,
      descSize: 22,
    },
  },
  {
    name: 'Indie Game',
    emoji: '\u{1F3AE}',
    data: {
      title: 'Stellar Drift — Out Now',
      description:
        'A lonely spacefaring roguelike about gravity, inheritance, and the long way home. Steam, itch.io, and Switch.',
      author: 'Paperlight Studio',
      tag: 'Launch',
      accent: '#c4b5fd',
      gradient: GRADIENTS[4], // Plum
      fontEntry: getFontByName('Bricolage Grotesque'),
      layout: 'center',
      titleSize: 58,
      descSize: 22,
    },
  },
  {
    name: 'Music Release',
    emoji: '\u{1F3B5}',
    data: {
      title: 'Midnight Atlas',
      description:
        'The new album from Kai Solano. Ten tracks recorded live to tape in a Lisbon warehouse. Out everywhere Friday.',
      author: 'Kai Solano',
      tag: 'New Album',
      accent: '#67e8f9',
      gradient: GRADIENTS[1], // Deep Sea
      fontEntry: getFontByName('Fraunces'),
      layout: 'bottom',
      titleSize: 60,
      descSize: 20,
    },
  },
  {
    name: 'Dev Tool',
    emoji: '\u{26A1}',
    data: {
      title: 'Ship Your Changelog in 30 Seconds',
      description:
        'Drop in our SDK, connect your repo, and turn every merged PR into a beautiful release post — automatically.',
      author: 'Rollout',
      tag: 'New in v2',
      accent: '#38ef7d',
      gradient: GRADIENTS[3], // Forest
      fontEntry: getFontByName('Space Grotesk'),
      layout: 'left',
      titleSize: 50,
      descSize: 21,
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
  onReset: () => void;
  accent: string;
}

export function Presets({ onSelect, onReset, accent }: Props) {
  return (
    <>
      <div className="pg-surprise-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase' }}>
            Quick Start
          </span>
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset to defaults"
            title="Reset all settings to defaults"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--pg-text-secondary)',
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              textDecorationColor: 'rgba(255,255,255,0.15)',
            }}
          >
            Reset
          </button>
        </div>

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
      </div>

      <div style={{ fontSize: 9, color: 'var(--pg-text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>
        Examples
      </div>
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
    </>
  );
}
