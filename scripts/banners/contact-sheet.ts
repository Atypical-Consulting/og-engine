export function renderContactSheet(
  items: Array<{ file: string; name: string; owner: string }>,
): string {
  const cards = items
    .map(
      (it) => `<figure>
      <img src="${it.file}" alt="${it.name} banner" loading="lazy" width="640" height="320">
      <figcaption>${it.owner}/<b>${it.name}</b></figcaption>
    </figure>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>README banners — contact sheet (${items.length})</title>
<style>
  body{margin:0;background:#0e1116;color:#e6edf3;font:15px system-ui,sans-serif;padding:24px}
  h1{font-size:18px;margin:0 0 18px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px}
  figure{margin:0;background:#161b22;border:1px solid #28303b;border-radius:12px;overflow:hidden}
  img{display:block;width:100%;height:auto}
  figcaption{padding:8px 12px;font-size:13px;color:#8b94a2}
  figcaption b{color:#e6edf3}
</style></head>
<body><h1>${items.length} banners</h1><div class="grid">${cards}</div></body></html>`;
}
