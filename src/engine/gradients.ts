export interface Gradient {
  name: string;
  slug: string;
  stops: [string, string];
}

export const GRADIENTS: Gradient[] = [
  { name: 'Void', slug: 'void', stops: ['#0c0f1a', '#080a12'] },
  { name: 'Deep Sea', slug: 'deep-sea', stops: ['#0a1628', '#061220'] },
  { name: 'Ember', slug: 'ember', stops: ['#1a0a0a', '#120808'] },
  { name: 'Forest', slug: 'forest', stops: ['#0a1a10', '#061208'] },
  { name: 'Plum', slug: 'plum', stops: ['#150a1a', '#0e0812'] },
  { name: 'Slate', slug: 'slate', stops: ['#12141a', '#0a0c10'] },
];

export const ACCENTS = [
  '#38ef7d', '#67e8f9', '#c4b5fd', '#fbbf24',
  '#fb7185', '#fb923c', '#e2e8f0', '#a3e635',
];

export function getGradientBySlug(slug: string): Gradient {
  return GRADIENTS.find((g) => g.slug === slug) ?? GRADIENTS[0];
}
