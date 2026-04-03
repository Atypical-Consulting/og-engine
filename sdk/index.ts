/**
 * OG Engine TypeScript SDK
 *
 * Lightweight client for the OG Engine API.
 * Zero dependencies — works in Node.js, Bun, Deno, and browsers.
 *
 * @example
 * ```ts
 * import { OGEngine } from '@og-engine/sdk';
 *
 * const og = new OGEngine({ apiKey: 'oge_sk_...' });
 * const png = await og.render({ format: 'og', title: 'Hello World' });
 * ```
 */

export interface OGEngineOptions {
  apiKey: string;
  baseUrl?: string;
}

export type ImageFormat = 'og' | 'twitter' | 'square' | 'linkedin' | 'story';
export type TemplateName = 'default' | 'social-card' | 'blog-hero' | 'email-banner';
export type OutputFormat = 'png' | 'webp' | 'pdf';
export type Layout = 'left' | 'center' | 'bottom';

export interface RenderStyle {
  accent?: string;
  layout?: Layout;
  font?: string;
  titleSize?: number;
  descSize?: number;
  gradient?: string;
  overlayOpacity?: number;
  autoFit?: boolean;
}

export interface RenderRequest {
  format: ImageFormat;
  title: string;
  template?: TemplateName | `custom:${string}`;
  description?: string;
  author?: string;
  tag?: string;
  style?: RenderStyle;
  output?: {
    format?: OutputFormat;
    quality?: number;
  };
}

export interface RenderResult {
  buffer: ArrayBuffer;
  contentType: string;
  renderTimeMs: string;
  titleLines: number;
  descLines: number;
  overflow: boolean;
  cached: boolean;
}

export interface ValidateRequest {
  format: ImageFormat;
  title: string;
  description?: string;
  font?: string;
  titleSize?: number;
  descSize?: number;
  maxTitleLines?: number;
  maxDescLines?: number;
}

export interface ValidateResult {
  fits: boolean;
  title: { lines: number; maxLines: number; overflow: boolean };
  description?: { lines: number; maxLines: number; overflow: boolean };
  computeTimeMs: number;
}

export interface BatchRequest {
  items: RenderRequest[];
}

export interface HealthResult {
  status: string;
  fonts: string[];
  formats: string[];
  templates: string[];
  version: string;
}

export interface UsageResult {
  plan: string;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    periodStart: string;
  };
  usage: {
    total: number;
    byEndpoint: Record<string, number>;
    byFormat: Record<string, number>;
  };
}

export interface OGEngineError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  docs?: string;
}

export class OGEngineAPIError extends Error {
  status: number;
  body: OGEngineError;

  constructor(status: number, body: OGEngineError) {
    super(body.message);
    this.name = 'OGEngineAPIError';
    this.status = status;
    this.body = body;
  }
}

export class OGEngine {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: OGEngineOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://og-engine.com').replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: 'unknown',
        message: `HTTP ${res.status}`,
      })) as OGEngineError;
      throw new OGEngineAPIError(res.status, err);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Generate an image from text + configuration.
   * Returns the raw image buffer with metadata.
   */
  async render(req: RenderRequest): Promise<RenderResult> {
    const res = await fetch(`${this.baseUrl}/render`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: 'unknown',
        message: `HTTP ${res.status}`,
      })) as OGEngineError;
      throw new OGEngineAPIError(res.status, err);
    }

    return {
      buffer: await res.arrayBuffer(),
      contentType: res.headers.get('Content-Type') ?? 'image/png',
      renderTimeMs: res.headers.get('X-Render-Time-Ms') ?? '0',
      titleLines: Number(res.headers.get('X-Title-Lines') ?? 0),
      descLines: Number(res.headers.get('X-Desc-Lines') ?? 0),
      overflow: res.headers.get('X-Layout-Overflow') === 'true',
      cached: res.headers.get('X-Cache') === 'hit',
    };
  }

  /**
   * Render and save to file (Node.js/Bun only).
   */
  async renderToFile(req: RenderRequest, filePath: string): Promise<RenderResult> {
    const result = await this.render(req);
    // Use dynamic import to support browser environments
    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, Buffer.from(result.buffer));
    return result;
  }

  /**
   * Check if text fits a given layout without generating an image.
   */
  async validate(req: ValidateRequest): Promise<ValidateResult> {
    return this.request<ValidateResult>('POST', '/validate', req);
  }

  /**
   * Render multiple images in one request. Returns a ZIP archive.
   */
  async batch(req: BatchRequest): Promise<{ buffer: ArrayBuffer; count: number; renderTimeMs: string }> {
    const res = await fetch(`${this.baseUrl}/render/batch`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: 'unknown',
        message: `HTTP ${res.status}`,
      })) as OGEngineError;
      throw new OGEngineAPIError(res.status, err);
    }

    return {
      buffer: await res.arrayBuffer(),
      count: Number(res.headers.get('X-Batch-Count') ?? 0),
      renderTimeMs: res.headers.get('X-Render-Time-Ms') ?? '0',
    };
  }

  /**
   * Check API health and available resources.
   */
  async health(): Promise<HealthResult> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new OGEngineAPIError(res.status, { error: 'health_check_failed', message: `HTTP ${res.status}` });
    return res.json() as Promise<HealthResult>;
  }

  /**
   * Get current usage statistics for the authenticated user.
   */
  async usage(): Promise<UsageResult> {
    return this.request<UsageResult>('GET', '/usage');
  }
}

export default OGEngine;
