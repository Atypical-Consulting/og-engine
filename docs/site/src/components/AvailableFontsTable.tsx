import { CURATED_FONTS, type FontCategory } from '../../../../src/engine/font-catalog';

const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans-serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
};

const CATEGORY_ORDER: FontCategory[] = ['sans-serif', 'serif', 'display', 'monospace', 'handwriting'];

export function AvailableFontsTable() {
  const grouped: Record<FontCategory, typeof CURATED_FONTS> = {
    'sans-serif': [],
    serif: [],
    display: [],
    monospace: [],
    handwriting: [],
  };
  for (const f of CURATED_FONTS) grouped[f.category].push(f);
  for (const k of Object.keys(grouped) as FontCategory[]) {
    grouped[k].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div>
      <p>OG Engine ships with <strong>{CURATED_FONTS.length}</strong> fonts pre-installed and ready to use via the API.</p>
      {CATEGORY_ORDER.map((cat) => {
        const fonts = grouped[cat];
        if (fonts.length === 0) return null;
        return (
          <section key={cat} style={{ marginTop: 24 }}>
            <h2>{CATEGORY_LABELS[cat]}</h2>
            <ul style={{ columns: 2, columnGap: 24, listStyle: 'none', padding: 0 }}>
              {fonts.map((f) => (
                <li key={f.name} style={{ padding: '4px 0', breakInside: 'avoid' }}>
                  <strong>{f.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: '0.85em', opacity: 0.7 }}>
                    {f.weights.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
