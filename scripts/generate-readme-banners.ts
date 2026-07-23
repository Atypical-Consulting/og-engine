// scripts/generate-readme-banners.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registerFonts } from '../src/engine/fonts';
import { renderCard } from '../src/engine/renderer';
import { collectRepos } from './banners/collect';
import { commitBanner } from './banners/commit';
import { renderContactSheet } from './banners/contact-sheet';
import { buildBannerRenderOptions } from './banners/render-input';

interface Flags {
  account: string;
  only?: string[];
  skipForks: boolean;
  skipArchived: boolean;
  dryRun: boolean;
  commit: boolean;
  limit?: number;
}

function parseFlags(argv: string[]): Flags {
  const get = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (k: string): boolean => argv.includes(`--${k}`);
  return {
    account: get('account') ?? 'all',
    only: get('only')?.split(','),
    skipForks: !has('include-forks'),
    skipArchived: !has('include-archived'),
    dryRun: has('dry-run'),
    commit: has('commit'),
    limit: get('limit') ? Number(get('limit')) : undefined,
  };
}

const ACCOUNTS = ['phmatray', 'Atypical-Consulting'];

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const owners = flags.account === 'all' ? ACCOUNTS : [flags.account];
  const outDir = join(process.cwd(), 'out', 'banners');
  await mkdir(outDir, { recursive: true });
  await registerFonts(join(process.cwd(), 'fonts'));

  // Phase A — collect
  const repos = (
    await Promise.all(
      owners.map((o) =>
        collectRepos(o, {
          skipForks: flags.skipForks,
          skipArchived: flags.skipArchived,
          only: flags.only,
          limit: flags.limit,
        }),
      ),
    )
  ).flat();
  console.log(`Collected ${repos.length} repos across ${owners.length} account(s).`);

  // Phase B — render
  const sheet: Array<{ file: string; name: string; owner: string }> = [];
  for (const repo of repos) {
    const res = await renderCard(buildBannerRenderOptions(repo));
    const file = `${repo.owner}__${repo.name}.png`;
    await writeFile(join(outDir, file), res.buffer);
    sheet.push({ file, name: repo.name, owner: repo.owner });
    if (res.overflow) console.warn(`  overflow: ${repo.owner}/${repo.name}`);
  }
  console.log(`Rendered ${sheet.length} banners to ${outDir}`);

  // Phase C — contact sheet
  await writeFile(join(outDir, 'index.html'), renderContactSheet(sheet));
  console.log(`Contact sheet: ${join(outDir, 'index.html')}`);

  // Phase D — commit (opt-in)
  if (flags.commit || flags.dryRun) {
    const workdir = join(process.cwd(), 'out', 'clones');
    await mkdir(workdir, { recursive: true });
    for (const repo of repos) {
      const png = join(outDir, `${repo.owner}__${repo.name}.png`);
      const r = await commitBanner({
        owner: repo.owner, name: repo.name, pngPath: png, workdir, dryRun: flags.dryRun,
      });
      console.log(`  ${r.action}: ${r.repo}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
