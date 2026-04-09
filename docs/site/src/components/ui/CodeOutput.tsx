import { useState } from 'react';
import type { FormatKey } from '../engine/formats';
import { SyntaxPre } from './SyntaxPre';

interface Config {
  format: FormatKey; template?: string; title: string; description: string; author: string; tag: string;
  accent: string; font: string; titleSize: number; descSize: number; layout: string; gradient: string;
  overlayOpacity?: number; autoFit?: boolean;
}

interface Props { config: Config; accent: string; }

function buildBody(config: Config): Record<string, unknown> {
  const body: Record<string, unknown> = { format: config.format, title: config.title };
  if (config.template && config.template !== 'default') body.template = config.template;
  if (config.description) body.description = config.description;
  if (config.author) body.author = config.author;
  if (config.tag) body.tag = config.tag;
  const style: Record<string, unknown> = {};
  if (config.accent !== '#38ef7d') style.accent = config.accent;
  if (config.font !== 'Outfit') style.font = config.font;
  if (config.titleSize !== 48) style.titleSize = config.titleSize;
  if (config.descSize !== 22) style.descSize = config.descSize;
  if (config.layout !== 'left') style.layout = config.layout;
  if (config.gradient && config.gradient !== 'void') style.gradient = config.gradient;
  if (config.overlayOpacity !== undefined && Math.abs(config.overlayOpacity - 0.65) > 0.001) {
    style.overlayOpacity = Math.round(config.overlayOpacity * 100) / 100;
  }
  if (config.autoFit) style.autoFit = true;
  if (Object.keys(style).length > 0) body.style = style;
  return body;
}

function buildCurl(config: Config): string {
  const json = JSON.stringify(buildBody(config), null, 2);
  return `curl -X POST https://og-engine.com/render \\
  -H "Authorization: Bearer oge_sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${json}' \\
  --output image.png`;
}

function buildSDK(config: Config): string {
  const opts: string[] = [`  format: '${config.format}'`, `  title: '${config.title}'`];
  if (config.template && config.template !== 'default') opts.push(`  template: '${config.template}'`);
  if (config.description) opts.push(`  description: '${config.description}'`);
  if (config.tag) opts.push(`  tag: '${config.tag}'`);
  const styleOpts: string[] = [];
  if (config.accent !== '#38ef7d') styleOpts.push(`    accent: '${config.accent}'`);
  if (config.font !== 'Outfit') styleOpts.push(`    font: '${config.font}'`);
  if (config.autoFit) styleOpts.push(`    autoFit: true`);
  if (styleOpts.length > 0) opts.push(`  style: {\n${styleOpts.join(',\n')}\n  }`);
  return `import { OGEngine } from '@atypical-consulting/og-engine-sdk'\n\nconst og = new OGEngine(process.env.OG_ENGINE_API_KEY!)\n\nconst image = await og.render({\n${opts.join(',\n')}\n})`;
}

function buildJSON(config: Config): string {
  const body = buildBody(config);
  body.output = { format: 'png', quality: 90 };
  return JSON.stringify(body, null, 2);
}

type Tab = 'curl' | 'sdk' | 'json';

export function CodeOutput({ config, accent }: Props) {
  const [tab, setTab] = useState<Tab>('curl');
  const [copied, setCopied] = useState(false);
  const code = tab === 'curl' ? buildCurl(config) : tab === 'sdk' ? buildSDK(config) : buildJSON(config);
  const lang = tab === 'curl' ? 'bash' : tab === 'sdk' ? 'typescript' : 'json';
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['curl', 'sdk', 'json'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: 9, color: tab === t ? accent : 'var(--pg-text-secondary)', background: 'none',
              border: 'none', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'inherit', padding: 0,
              transition: 'color 0.15s ease',
            }}>{t}</button>
          ))}
        </div>
        <button onClick={copy} style={{ fontSize: 9, color: copied ? accent : 'var(--pg-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s ease' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxPre code={code} language={lang} />
    </div>
  );
}
