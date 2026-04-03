export interface Format {
  w: number;
  h: number;
  label: string;
  ratio: string;
  maxTitleLines: number;
  maxDescLines: number;
}

export const FORMATS: Record<string, Format> = {
  og: { w: 1200, h: 630, label: 'OG', ratio: '1200x630', maxTitleLines: 3, maxDescLines: 4 },
  twitter: { w: 1200, h: 675, label: 'Twitter', ratio: '1200x675', maxTitleLines: 3, maxDescLines: 4 },
  square: { w: 1080, h: 1080, label: 'Square', ratio: '1080x1080', maxTitleLines: 4, maxDescLines: 5 },
  linkedin: { w: 1200, h: 627, label: 'LinkedIn', ratio: '1200x627', maxTitleLines: 3, maxDescLines: 4 },
  story: { w: 1080, h: 1920, label: 'Story', ratio: '1080x1920', maxTitleLines: 5, maxDescLines: 6 },
};

export type FormatKey = keyof typeof FORMATS;
export const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];
