/**
 * OG Engine TypeScript SDK
 *
 * Lightweight client for the OG Engine API.
 * Zero dependencies — works in Node.js, Bun, Deno, and browsers.
 *
 * @example
 * ```ts
 * import { OGEngine } from '@atypical-consulting/og-engine-sdk';
 *
 * const og = new OGEngine('oge_sk_...');
 * const image = await og.render({ format: 'og', title: 'Hello World' });
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageFormat = 'og' | 'twitter' | 'square' | 'linkedin' | 'story';
export type TemplateName = 'default' | 'social-card' | 'blog-hero' | 'email-banner';
export type OutputFormat = 'png' | 'webp' | 'pdf';
export type Layout = 'left' | 'center' | 'bottom';

export interface OGEngineOptions {
  /** Override for self-hosted instances (default: https://og-engine.com) */
  baseUrl?: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
  /** Retry count for 5xx errors (default: 3) */
  retries?: number;
}

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
  backgroundImage?: Buffer | Uint8Array;
}

export interface RenderMeta {
  renderTimeMs: number;
  titleLines: number;
  descLines: number;
  layoutOverflow: boolean;
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
  autoFit?: boolean;
}

export interface ValidateResult {
  fits: boolean;
  title: { lines: number; maxLines: number; overflow: boolean };
  description: { lines: number; maxLines: number; overflow: boolean };
  computeTimeMs: number;
}

export interface HealthResult {
  status: string;
  version: string;
  fonts: string[];
  formats: string[];
  templates: string[];
}

export interface UsageResult {
  plan: 'free' | 'starter' | 'pro' | 'scale';
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class OGEngineConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OGEngineConfigError';
  }
}

export class OGEngineError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown> | null;

  constructor(status: number, body: { error?: string; code?: string; message: string; details?: Record<string, unknown> }) {
    super(body.message);
    this.name = 'OGEngineError';
    this.code = body.code ?? body.error ?? 'unknown';
    this.status = status;
    this.details = body.details ?? null;
  }
}

// ---------------------------------------------------------------------------
// Buffer with metadata
// ---------------------------------------------------------------------------

type BufferWithMeta = Buffer & { meta: RenderMeta };

function attachMeta(buf: Buffer, meta: RenderMeta): BufferWithMeta {
  const out = buf as BufferWithMeta;
  out.meta = meta;
  return out;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://og-engine.com';
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 3;
const RETRY_BASE_MS = 200;

export class OGEngine {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(apiKey: string, options?: OGEngineOptions) {
    if (!apiKey) {
      throw new OGEngineConfigError(
        'Missing API key. Pass your key as the first argument: new OGEngine("oge_sk_...")',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    this.retries = options?.retries ?? DEFAULT_RETRIES;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const res = await fetch(url, { ...init, signal: controller.signal });

        // Don't retry client errors (4xx)
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          return res;
        }

        // 5xx — retry with exponential backoff
        lastError = new Error(`HTTP ${res.status}`);
        if (attempt < this.retries) {
          await sleep(RETRY_BASE_MS * 2 ** attempt);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.retries) {
          await sleep(RETRY_BASE_MS * 2 ** attempt);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  private async requestJSON<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchWithRetry(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({
        message: `HTTP ${res.status}`,
      }))) as Record<string, unknown>;
      throw new OGEngineError(res.status, err as { message: string });
    }

    return res.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Generate an image from text + configuration.
   * Returns a `Buffer` with a `.meta` property containing render diagnostics.
   */
  async render(request: RenderRequest): Promise<BufferWithMeta> {
    const res = await this.fetchWithRetry(`${this.baseUrl}/render`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({
        message: `HTTP ${res.status}`,
      }))) as Record<string, unknown>;
      throw new OGEngineError(res.status, err as { message: string });
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    return attachMeta(buf, {
      renderTimeMs: Number.parseFloat(res.headers.get('X-Render-Time-Ms') ?? '0'),
      titleLines: Number(res.headers.get('X-Title-Lines') ?? 0),
      descLines: Number(res.headers.get('X-Desc-Lines') ?? 0),
      layoutOverflow: res.headers.get('X-Layout-Overflow') === 'true',
      cached: res.headers.get('X-Cache') === 'hit',
    });
  }

  /**
   * Render and save to file (Node.js/Bun only).
   */
  async renderToFile(request: RenderRequest, filePath: string): Promise<BufferWithMeta> {
    const result = await this.render(request);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(filePath, result);
    return result;
  }

  /**
   * Check if text fits a given layout without generating an image.
   */
  async validate(request: ValidateRequest): Promise<ValidateResult> {
    return this.requestJSON<ValidateResult>('POST', '/validate', request);
  }

  /**
   * Render multiple images in a single API call.
   * Returns a `Buffer` containing a ZIP archive.
   */
  async batch(items: RenderRequest[]): Promise<Buffer> {
    const res = await this.fetchWithRetry(`${this.baseUrl}/render/batch`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({
        message: `HTTP ${res.status}`,
      }))) as Record<string, unknown>;
      throw new OGEngineError(res.status, err as { message: string });
    }

    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Check service status and available resources.
   */
  async health(): Promise<HealthResult> {
    const res = await this.fetchWithRetry(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      throw new OGEngineError(res.status, { message: `HTTP ${res.status}` });
    }

    return res.json() as Promise<HealthResult>;
  }

  /**
   * Get current usage statistics for the authenticated user.
   */
  async usage(): Promise<UsageResult> {
    return this.requestJSON<UsageResult>('GET', '/usage');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default OGEngine;
