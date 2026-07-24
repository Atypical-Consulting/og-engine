/**
 * Minimal S3-compatible object storage client (Fly.io Tigris / AWS S3).
 * Uses the Web Crypto API — no extra dependencies.
 *
 * Required env vars:
 *   TIGRIS_ACCESS_KEY_ID      - AWS-compatible access key
 *   TIGRIS_SECRET_ACCESS_KEY  - AWS-compatible secret key
 *   TIGRIS_ENDPOINT_URL       - e.g. https://fly.storage.tigris.dev
 *   TIGRIS_BUCKET_NAME        - target bucket
 */

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return hex(await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer));
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const encoded = new TextEncoder().encode(data);
  return crypto.subtle.sign('HMAC', cryptoKey, encoded.buffer as ArrayBuffer);
}

async function deriveSigningKey(
  secretKey: string,
  date: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const seed = new TextEncoder().encode(`AWS4${secretKey}`);
  const kDate = await hmacSha256(seed.buffer as ArrayBuffer, date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl: string;
  bucketName: string;
  region: string;
}

function getS3Config(): S3Config {
  const accessKeyId = process.env.TIGRIS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.TIGRIS_SECRET_ACCESS_KEY;
  const endpointUrl = process.env.TIGRIS_ENDPOINT_URL ?? 'https://fly.storage.tigris.dev';
  const bucketName = process.env.TIGRIS_BUCKET_NAME;
  const region = process.env.TIGRIS_REGION ?? 'auto';

  if (!accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('Missing S3/Tigris env vars: TIGRIS_ACCESS_KEY_ID, TIGRIS_SECRET_ACCESS_KEY, TIGRIS_BUCKET_NAME');
  }
  return { accessKeyId, secretAccessKey, endpointUrl, bucketName, region };
}

async function signedRequest(
  config: S3Config,
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  body: Uint8Array | string,
): Promise<Response> {
  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzdate = `${now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, '')
    .slice(0, 15)}Z`;

  const bodyBytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  const payloadHash = await sha256Hex(bodyBytes);

  const url = new URL(`${config.endpointUrl}/${config.bucketName}${path}`);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }

  const canonicalHeaders: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzdate,
    ...headers,
  };

  const sortedHeaderKeys = Object.keys(canonicalHeaders).sort();
  const canonicalHeaderStr = sortedHeaderKeys.map((k) => `${k}:${canonicalHeaders[k]}\n`).join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  const sortedQuery = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [method, url.pathname, sortedQuery, canonicalHeaderStr, signedHeaders, payloadHash].join(
    '\n',
  );

  const credentialScope = `${datestamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzdate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');

  const signingKey = await deriveSigningKey(config.secretAccessKey, datestamp, config.region, 's3');
  const signature = hex(await hmacSha256(signingKey, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    ...canonicalHeaders,
    Authorization: authHeader,
  };
  if (bodyBytes.length > 0) {
    fetchHeaders['Content-Length'] = String(bodyBytes.length);
  }

  return fetch(url.toString(), {
    method,
    headers: fetchHeaders,
    body: bodyBytes.length > 0 ? (bodyBytes.buffer as ArrayBuffer) : undefined,
  });
}

export async function s3PutObject(
  key: string,
  body: Uint8Array,
  contentType = 'application/octet-stream',
): Promise<void> {
  const config = getS3Config();
  const res = await signedRequest(config, 'PUT', `/${key}`, {}, { 'content-type': contentType }, body);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 PUT failed (${res.status}): ${text}`);
  }
}

export interface S3Object {
  key: string;
  lastModified: Date;
  size: number;
}

export async function s3ListObjects(prefix: string): Promise<S3Object[]> {
  const config = getS3Config();
  const res = await signedRequest(config, 'GET', '/', { 'list-type': '2', prefix }, {}, '');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 LIST failed (${res.status}): ${text}`);
  }
  const xml = await res.text();
  const objects: S3Object[] = [];
  const matches = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
  for (const match of matches) {
    const content = match[1];
    const key = content.match(/<Key>(.*?)<\/Key>/)?.[1] ?? '';
    const lastModified = new Date(content.match(/<LastModified>(.*?)<\/LastModified>/)?.[1] ?? 0);
    const size = Number(content.match(/<Size>(.*?)<\/Size>/)?.[1] ?? 0);
    objects.push({ key, lastModified, size });
  }
  return objects;
}

export async function s3DeleteObject(key: string): Promise<void> {
  const config = getS3Config();
  const res = await signedRequest(config, 'DELETE', `/${key}`, {}, {}, '');
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`S3 DELETE failed (${res.status}): ${text}`);
  }
}
