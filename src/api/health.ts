import { Hono } from 'hono';
import pkg from '../../package.json' with { type: 'json' };
import { FONTS } from '../engine/fonts';
import { FORMAT_KEYS } from '../engine/formats';
import { TEMPLATE_NAMES } from '../engine/templates';

export const healthRoute = new Hono();

/**
 * Identifies the running build, so "did my fix actually ship?" is one curl.
 *
 * `GIT_SHA` is baked in at image build time (see the Dockerfile) and is the
 * precise answer. `FLY_IMAGE_REF` and `FLY_MACHINE_VERSION` are injected by
 * Fly at runtime and change on every deploy, so they still distinguish one
 * release from the next when the sha was not passed. All three are build
 * identifiers, not secrets.
 */
function buildInfo() {
  return {
    commit: process.env.GIT_SHA?.trim() || null,
    image: process.env.FLY_IMAGE_REF?.trim() || null,
    machineVersion: process.env.FLY_MACHINE_VERSION?.trim() || null,
  };
}

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    fonts: FONTS.map((f) => f.name),
    formats: FORMAT_KEYS,
    templates: TEMPLATE_NAMES,
    version: pkg.version,
    build: buildInfo(),
  });
});
