// Extract the first human-readable line of a README, for use as a banner tagline.
export function extractTagline(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let inComment = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      continue;
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inComment = true;
      continue;
    }
    if (line.startsWith('#')) continue; // headings
    if (line.startsWith('![') || line.startsWith('[![')) continue; // images / linked badges
    if (/^\[[^\]]*\]\([^)]*\)$/.test(line)) continue; // a bare link line
    if (/^<[^>]+>$/.test(line)) continue; // a lone html tag (e.g. <p align="center">)
    if (/^[-*=_]{3,}$/.test(line)) continue; // horizontal rule
    const text = line.startsWith('>') ? line.replace(/^>\s?/, '') : line;
    return stripInlineMd(text);
  }
  return null;
}

function stripInlineMd(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // inline images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[*_`]/g, '') // emphasis / code ticks
    .replace(/\s+/g, ' ')
    .trim();
}
