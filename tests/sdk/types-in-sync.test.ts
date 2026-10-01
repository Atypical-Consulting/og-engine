import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FORMAT_KEYS } from '../../src/engine/formats';
import { TEMPLATE_NAMES } from '../../src/engine/templates';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sdkSource = readFileSync(join(__dirname, '..', '..', 'sdk', 'index.ts'), 'utf8');

/**
 * Extracts the string-literal members of an exported union type alias from the
 * SDK source, e.g. `export type ImageFormat = 'og' | 'twitter';` -> ['og', 'twitter'].
 */
function unionMembers(typeName: string): string[] {
  const match = sdkSource.match(new RegExp(`export type ${typeName} =([^;]*);`));
  if (!match) throw new Error(`Could not find "export type ${typeName}" in sdk/index.ts`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

// ATY-62 item 4: the SDK's ImageFormat was missing 'readme' and TemplateName was
// missing nine templates, so the published types silently rejected valid requests.
describe('SDK types stay in sync with the server', () => {
  it('ImageFormat lists exactly the server formats', () => {
    expect(unionMembers('ImageFormat').sort()).toEqual([...FORMAT_KEYS].sort());
  });

  it('TemplateName lists exactly the server templates', () => {
    expect(unionMembers('TemplateName').sort()).toEqual([...TEMPLATE_NAMES].sort());
  });
});
