import { languageColor } from '../../src/engine/language-colors';
import type { RenderOptions } from '../../src/engine/renderer';

export interface BannerOverride {
  tagline?: string;
  accent?: string;
  wordmark?: string;
}

export interface RepoDescriptor {
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  tagline: string | null;
  override?: BannerOverride | null;
}

const WORDMARKS: Record<string, string> = {
  phmatray: 'Philippe Matray',
  'Atypical-Consulting': 'Atypical Consulting',
};

export function formatStars(n: number): string {
  if (n >= 1000) {
    const rounded = Math.round((n / 1000) * 10) / 10;
    return `${rounded.toFixed(1)}k`;
  }
  return String(n);
}

export function buildBannerRenderOptions(repo: RepoDescriptor): RenderOptions {
  const o = repo.override ?? {};
  const tagline = stripEmoji(o.tagline ?? repo.tagline ?? repo.description ?? '');
  const wordmark = o.wordmark ?? WORDMARKS[repo.owner] ?? repo.owner;
  const accent = o.accent ?? languageColor(repo.language);
  const title = repo.name;

  return {
    title,
    description: tagline,
    author: '',
    tag: '',
    format: 'readme',
    template: 'readme-banner',
    accent,
    layout: 'left',
    titleSize: 64,
    descSize: 26,
    fontName: 'Outfit',
    gradient: 'void',
    bgImageBuffer: null,
    overlayOpacity: 0.65,
    autoFit: false,
    outputFormat: 'png',
    variables: {
      owner: repo.owner,
      wordmark,
      language: repo.language ?? '',
      stars: repo.stars > 0 ? formatStars(repo.stars) : '',
      repoPath: `github.com/${repo.owner}/${repo.name}`,
      monoFamily: 'JetBrains Mono',
    },
    namedImages: {},
    outputQuality: 90,
  };
}

const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu;

function stripEmoji(s: string): string {
  return s.replace(EMOJI, '').replace(/\s+/g, ' ').trim();
}
