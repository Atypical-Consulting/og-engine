import { Hono } from 'hono';
import { renderCard } from '../engine/renderer';
import { batchSchema } from '../schemas/request';

export const batchRoute = new Hono();

batchRoute.post('/render/batch', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json(
      {
        error: 'invalid_request',
        message: 'Request body must be valid JSON.',
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const parsed = batchSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json(
      {
        error: 'invalid_request',
        message: issues[0]?.message ?? 'Validation failed.',
        details: { fields: issues },
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const { items } = parsed.data;
  const t0 = performance.now();

  // Render all items
  const results = await Promise.all(
    items.map(async (data) => {
      const result = await renderCard({
        title: data.title,
        description: data.description,
        author: data.author,
        tag: data.tag,
        format: data.format,
        template: data.template,
        accent: data.style.accent,
        layout: data.style.layout,
        titleSize: data.style.titleSize,
        descSize: data.style.descSize,
        fontName: data.style.font,
        gradient: data.style.gradient,
        bgImageBuffer: null,
        overlayOpacity: data.style.overlayOpacity,
        autoFit: data.style.autoFit,
        outputFormat: data.output.format,
        outputQuality: data.output.quality,
      });
      return result;
    }),
  );

  // Build ZIP archive (minimal implementation — local file headers + central directory)
  const files = results.map((r, i) => {
    const ext = r.contentType === 'image/webp' ? 'webp' : r.contentType === 'application/pdf' ? 'pdf' : 'png';
    return { name: `image-${String(i + 1).padStart(3, '0')}.${ext}`, data: r.buffer };
  });

  const zipBuffer = buildZip(files);
  const totalMs = (performance.now() - t0).toFixed(2);

  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="og-engine-batch.zip"',
      'X-Render-Time-Ms': totalMs,
      'X-Batch-Count': String(results.length),
    },
  });
});

// ─── Minimal ZIP builder (no dependencies) ───────────────────

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZip(files: ZipEntry[]): Buffer {
  const entries: { header: Buffer; offset: number; name: Buffer; data: Buffer }[] = [];
  let offset = 0;

  // Build local file headers + data
  const localParts: Buffer[] = [];

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header (30 bytes + name + data)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression (store)
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc32
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26); // filename length
    local.writeUInt16LE(0, 28); // extra field length

    entries.push({ header: local, offset, name: nameBytes, data: file.data });
    localParts.push(local, nameBytes, file.data);
    offset += 30 + nameBytes.length + size;
  }

  // Central directory
  const centralStart = offset;
  const centralParts: Buffer[] = [];

  for (const entry of entries) {
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // compression
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    // Copy crc, sizes from local header
    entry.header.copy(central, 16, 14, 26); // crc + sizes (12 bytes)
    central.writeUInt16LE(entry.name.length, 28); // filename length
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(entry.offset, 42); // local header offset

    centralParts.push(central, entry.name);
  }

  const centralSize = centralParts.reduce((s, b) => s + b.length, 0);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir disk
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12); // central dir size
  eocd.writeUInt32LE(centralStart, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
