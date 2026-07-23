import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENT, languageColor } from '../../src/engine/language-colors';

describe('languageColor', () => {
  it('maps known languages case-insensitively', () => {
    expect(languageColor('C#')).toBe('#178600');
    expect(languageColor('typescript')).toBe('#3178c6');
    expect(languageColor('Rust')).toBe('#dea584');
    expect(languageColor('Python')).toBe('#3572A5');
  });
  it('falls back to the default accent for unknown or null', () => {
    expect(languageColor(null)).toBe(DEFAULT_ACCENT);
    expect(languageColor(undefined)).toBe(DEFAULT_ACCENT);
    expect(languageColor('Brainfuck')).toBe(DEFAULT_ACCENT);
  });
});
