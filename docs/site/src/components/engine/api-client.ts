export interface ApiRenderResult {
  imageUrl: string;
  renderTimeMs: number;
  titleLines: number;
  descLines: number;
  overflow: boolean;
}

export async function apiRender(
  baseUrl: string,
  config: {
    format: string;
    template?: string;
    title: string;
    description: string;
    author: string;
    tag: string;
    accent: string;
    layout: string;
    font: string;
    titleSize: number;
    descSize: number;
    gradient: string;
    overlayOpacity?: number;
    autoFit?: boolean;
  },
): Promise<ApiRenderResult> {
  const res = await fetch(`${baseUrl}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: config.format,
      template: config.template ?? 'default',
      title: config.title,
      description: config.description,
      author: config.author,
      tag: config.tag,
      style: {
        accent: config.accent,
        layout: config.layout,
        font: config.font,
        titleSize: config.titleSize,
        descSize: config.descSize,
        gradient: config.gradient,
        overlayOpacity: config.overlayOpacity ?? 0.65,
        autoFit: config.autoFit ?? false,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(err.message ?? `API error: ${res.status}`);
  }

  const blob = await res.blob();
  const imageUrl = URL.createObjectURL(blob);

  return {
    imageUrl,
    renderTimeMs: Number(res.headers.get('X-Render-Time-Ms') ?? '0'),
    titleLines: Number(res.headers.get('X-Title-Lines') ?? '0'),
    descLines: Number(res.headers.get('X-Desc-Lines') ?? '0'),
    overflow: res.headers.get('X-Layout-Overflow') === 'true',
  };
}

export async function checkApiAvailable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body.status === 'ok';
  } catch {
    return false;
  }
}
