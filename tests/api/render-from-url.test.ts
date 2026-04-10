import { describe, expect, it } from 'vitest';
import { renderFromUrlSchema } from '../../src/api/render-from-url';

describe('renderFromUrlSchema', () => {
  it('accepts a valid URL request', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com/blog/my-post',
    });
    expect(result.success).toBe(true);
  });

  it('accepts URL with format and template overrides', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com/blog/my-post',
      format: 'twitter',
      template: 'social-card',
      style: { accent: '#fb7185' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing URL', () => {
    const result = renderFromUrlSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = renderFromUrlSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('defaults format to og and template to default', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('og');
      expect(result.data.template).toBe('default');
      expect(result.data.style.autoFit).toBe(true);
    }
  });
});
