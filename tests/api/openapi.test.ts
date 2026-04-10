import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { openapiRoutes } from '../../src/openapi/swagger';

describe('OpenAPI spec and Swagger UI', () => {
  const app = new Hono();
  app.route('/', openapiRoutes);

  it('GET /openapi.json returns a valid OpenAPI spec', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('OG Engine API');
    expect(spec.info.version).toBe('0.1.0');
  });

  it('GET /openapi.json includes all core paths', async () => {
    const res = await app.request('/openapi.json');
    const spec = await res.json();
    const paths = Object.keys(spec.paths);
    expect(paths).toContain('/render');
    expect(paths).toContain('/validate');
    expect(paths).toContain('/health');
    expect(paths).toContain('/render/from-url');
    expect(paths).toContain('/render/batch');
    expect(paths).toContain('/auth/register');
    expect(paths).toContain('/usage');
    expect(paths).toContain('/billing/portal');
  });

  it('GET /openapi.json includes Bearer auth security scheme', async () => {
    const res = await app.request('/openapi.json');
    const spec = await res.json();
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.BearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe('bearer');
  });

  it('GET /openapi.json includes component schemas', async () => {
    const res = await app.request('/openapi.json');
    const spec = await res.json();
    expect(spec.components.schemas.RenderRequest).toBeDefined();
    expect(spec.components.schemas.ValidateRequest).toBeDefined();
    expect(spec.components.schemas.HealthResponse).toBeDefined();
    expect(spec.components.schemas.ErrorResponse).toBeDefined();
  });

  it('GET /docs returns HTML containing swagger', async () => {
    const res = await app.request('/docs');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain('swagger');
    expect(html).toContain('swagger-ui');
    expect(html).toContain('/openapi.json');
  });
});
