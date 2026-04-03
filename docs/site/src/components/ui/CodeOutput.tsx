import { useState } from 'react';
import type { FormatKey } from '../engine/formats';

interface Config {
  format: FormatKey; title: string; description: string; author: string; tag: string;
  accent: string; font: string; titleSize: number; descSize: number; layout: string; gradient: string;
}

interface Props { config: Config; accent: string; }

function buildCurl(config: Config): string {
  const body: Record<string, unknown> = { format: config.format, title: config.title };
  if (config.description) body.description = config.description;
  if (config.author) body.author = config.author;
  if (config.tag) body.tag = config.tag;
  const style: Record<string, unknown> = {};
  if (config.accent !== '#38ef7d') style.accent = config.accent;
  if (config.font !== 'Outfit') style.font = config.font;
  if (config.titleSize !== 48) style.titleSize = config.titleSize;
  if (config.descSize !== 22) style.descSize = config.descSize;
  if (config.layout !== 'left') style.layout = config.layout;
  if (Object.keys(style).length > 0) body.style = style;
  const json = JSON.stringify(body, null, 2);
  return `curl -X POST https://api.og-engine.com/render \\
  -H "Authorization: Bearer oge_sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${json}' \\
  --output image.png`;
}

function buildSDK(config: Config): string {
  const opts: string[] = [`  format: '${config.format}'`, `  title: '${config.title}'`];
  if (config.description) opts.push(`  description: '${config.description}'`);
  if (config.tag) opts.push(`  tag: '${config.tag}'`);
  const styleOpts: string[] = [];
  if (config.accent !== '#38ef7d') styleOpts.push(`    accent: '${config.accent}'`);
  if (config.font !== 'Outfit') styleOpts.push(`    font: '${config.font}'`);
  if (styleOpts.length > 0) opts.push(`  style: {\n${styleOpts.join(',\n')}\n  }`);
  return `import { OGEngine } from 'og-engine-sdk'\n\nconst og = new OGEngine(process.env.OG_ENGINE_API_KEY!)\n\nconst image = await og.render({\n${opts.join(',\n')}\n})`;
}

export function CodeOutput({ config, accent }: Props) {
  const [tab, setTab] = useState<'curl' | 'sdk'>('curl');
  const [copied, setCopied] = useState(false);
  const code = tab === 'curl' ? buildCurl(config) : buildSDK(config);
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['curl', 'sdk'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: 9, color: tab === t ? accent : '#475569', background: 'none',
              border: 'none', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'inherit', padding: 0,
            }}>{t}</button>
          ))}
        </div>
        <button onClick={copy} style={{ fontSize: 9, color: copied ? accent : '#475569', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6, color: '#94a3b8', overflowX: 'auto', background: '#0c0f1a', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
