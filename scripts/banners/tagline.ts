// Extract the first human-readable line of a README, for use as a banner tagline.
export function extractTagline(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let inComment = false;
  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;

    // Handle HTML comments
    if (inComment) {
      if (line.includes('-->')) {
        inComment = false;
        // Extract everything after -->
        const parts = line.split('-->');
        line = parts[1]?.trim() || '';
        if (!line) continue; // No prose after comment
      } else {
        continue; // Still in comment
      }
    }

    // Handle opening comment tag
    if (line.startsWith('<!--')) {
      if (line.includes('-->')) {
        // Same-line closed comment: extract the part after -->
        const parts = line.split('-->');
        line = parts[1]?.trim() || '';
        if (!line) continue; // No prose after comment
      } else {
        inComment = true;
        continue; // Comment continues on next line
      }
    }

    // Skip headings (require CommonMark space after #)
    if (/^#+\s/.test(line)) continue;

    // Skip bare link lines
    if (/^\[[^\]]*\]\([^)]*\)$/.test(line)) continue;

    // Skip horizontal rules
    if (/^[-*=_]{3,}$/.test(line)) continue;

    // Skip lone HTML tags
    if (/^<[^>]+>$/.test(line)) continue;

    // Handle blockquotes
    const text = line.startsWith('>') ? line.replace(/^>\s?/, '') : line;

    // Strip markdown and HTML
    const stripped = stripInlineMd(text);

    // Only return if non-empty (rule 1: never return empty string)
    if (stripped) {
      return stripped;
    }
  }
  return null;
}

function stripInlineMd(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // inline images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/<[^>]*>/g, '') // HTML tags (rule 2)
    .replace(/[*_`]/g, '') // emphasis / code ticks
    .replace(/\s+/g, ' ')
    .trim();
}
