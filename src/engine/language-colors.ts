// GitHub linguist colors for the languages present across the portfolio.
export const LANGUAGE_COLORS: Record<string, string> = {
  'c#': '#178600',
  typescript: '#3178c6',
  javascript: '#f1e05a',
  rust: '#dea584',
  java: '#b07219',
  python: '#3572A5',
  html: '#e34c26',
  css: '#563d7c',
  scss: '#c6538c',
  shell: '#89e051',
  go: '#00ADD8',
  dockerfile: '#384d54',
  tex: '#3D6117',
  gdscript: '#355570',
  swift: '#F05138',
  kotlin: '#A97BFF',
  vue: '#41b883',
  'c++': '#f34b7d',
  c: '#555555',
  ruby: '#701516',
  php: '#4F5D95',
};

export const DEFAULT_ACCENT = '#38ef7d';

export function languageColor(lang: string | null | undefined): string {
  if (!lang) return DEFAULT_ACCENT;
  return LANGUAGE_COLORS[lang.toLowerCase()] ?? DEFAULT_ACCENT;
}
