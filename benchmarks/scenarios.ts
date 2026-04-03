import type { RenderOptions } from '../src/engine/renderer';

export interface Scenario {
  name: string;
  slug: string;
  options: RenderOptions;
}

const base: Omit<RenderOptions, 'title' | 'description' | 'format' | 'fontName'> = {
  author: 'OG Engine',
  tag: 'Benchmark',
  accent: '#38ef7d',
  layout: 'left',
  titleSize: 48,
  descSize: 22,
  gradient: 'void',
  bgImageBuffer: null,
  overlayOpacity: 0.65,
  timing: true,
};

export const SCENARIOS: Scenario[] = [
  {
    name: 'Baseline (og, 1 line, Outfit)',
    slug: 'baseline',
    options: {
      ...base,
      title: 'Hello, OG Engine',
      description: 'Generated without a browser.',
      format: 'og',
      fontName: 'Outfit',
    },
  },
  {
    name: 'Long text (og, overflow, Outfit)',
    slug: 'long-text',
    options: {
      ...base,
      title: 'Server-Side Text Layout Without a Browser Engine — How Pretext Measures Every Glyph to Compute Perfect Line Breaks in Under One Millisecond',
      description: 'Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content. No DOM, no CSSOM, no paint cycle.',
      format: 'og',
      fontName: 'Outfit',
    },
  },
  {
    name: 'Story format (1080x1920, Outfit)',
    slug: 'story',
    options: {
      ...base,
      title: 'Server-Side Text Layout Without a Browser Engine — How Pretext Measures Every Glyph to Compute Perfect Line Breaks in Under One Millisecond',
      description: 'Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content. No DOM, no CSSOM, no paint cycle.',
      format: 'story',
      fontName: 'Outfit',
    },
  },
  {
    name: 'CJK (og, Noto Sans JP)',
    slug: 'cjk',
    options: {
      ...base,
      title: 'ブラウザなしのサーバーサイドテキストレイアウト — Pretextがすべてのグリフを測定',
      description: '純粋なJavaScriptテキスト測定がPuppeteerとヘッドレスChromeを置き換えます。OG画像の1ミリ秒未満のレイアウト。',
      format: 'og',
      fontName: 'Noto Sans JP',
    },
  },
];

export function puppeteerHtml(title: string, description: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: linear-gradient(to bottom right, #0c0f1a, #080a12);
    font-family: 'Outfit', sans-serif;
    color: #f1f5f9;
    display: flex; flex-direction: column; justify-content: center;
    padding: 64px;
  }
  .tag {
    display: inline-block; background: rgba(56,239,125,0.1);
    color: #38ef7d; font-size: 14px; font-weight: 600;
    padding: 4px 12px; border-radius: 14px; text-transform: uppercase;
    margin-bottom: 16px;
  }
  h1 { font-size: 48px; font-weight: 800; line-height: 1.2; margin-bottom: 20px; }
  p { font-size: 22px; color: #94a3b8; line-height: 1.55; }
  .author { color: #38ef7d; font-size: 18px; font-weight: 700; margin-top: 28px; }
</style>
</head>
<body>
  <span class="tag">BENCHMARK</span>
  <h1>${title}</h1>
  <p>${description}</p>
  <div class="author">OG Engine</div>
</body>
</html>`;
}
