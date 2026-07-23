// scripts/generate-readme-banners.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { registerFonts } from '../src/engine/fonts';
import { renderCard } from '../src/engine/renderer';
import { collectRepos } from './banners/collect';
import { commitBanner } from './banners/commit';
import { renderContactSheet } from './banners/contact-sheet';
import { buildBannerRenderOptions, type RepoDescriptor } from './banners/render-input';

interface Flags {
  account: string;
  only?: string[];
  skipForks: boolean;
  skipArchived: boolean;
  dryRun: boolean;
  commit: boolean;
  noPr: boolean;
  limit?: number;
  batch?: number;
}

/**
 * Parses a numeric flag's raw value into a positive integer. When the flag is
 * absent, returns undefined. When it's present but not a positive integer
 * (0, negative, or non-numeric/NaN), fails loudly and exits before any side
 * effect — a silently-ignored bad value here (e.g. `--batch 0`) would
 * otherwise fall through as "unset" and defeat both the safety guard and the
 * wave gate below.
 */
function parsePositiveInt(flag: string, raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`--${flag} must be a positive integer (got ${JSON.stringify(raw)}).`);
    process.exit(1);
  }
  return n;
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
    noPr: has('no-pr'),
    limit: parsePositiveInt('limit', get('limit')),
    batch: parsePositiveInt('batch', get('batch')),
  };
}

const ACCOUNTS = ['phmatray', 'Atypical-Consulting'];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  // SAFETY GUARD: never let --commit run unscoped against every repo on the
  // account(s) — require the caller to explicitly bound the blast radius
  // before anything is cloned or pushed.
  if (flags.commit && !flags.only?.length && flags.limit == null && flags.batch == null) {
    console.error(
      'Refusing to --commit to ALL repos unscoped. Pass --only <repos>, --limit <N>, or --batch <N>.',
    );
    process.exit(1);
  }

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
  const renderFailures: Array<{ repo: string; error: unknown }> = [];
  for (const repo of repos) {
    try {
      const res = await renderCard(buildBannerRenderOptions(repo));
      const file = `${repo.owner}__${repo.name}.png`;
      await writeFile(join(outDir, file), res.buffer);
      sheet.push({ file, name: repo.name, owner: repo.owner });
      if (res.overflow) console.warn(`  overflow: ${repo.owner}/${repo.name}`);
    } catch (e) {
      const label = `${repo.owner}/${repo.name}`;
      renderFailures.push({ repo: label, error: e });
      console.error(`  render failed: ${label}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`Rendered ${sheet.length} banners to ${outDir}`);
  if (renderFailures.length) {
    console.log(`Render failures: ${renderFailures.length}`);
    for (const f of renderFailures) {
      console.log(`  - ${f.repo}: ${f.error instanceof Error ? f.error.message : f.error}`);
    }
  }

  // Phase C — contact sheet
  await writeFile(join(outDir, 'index.html'), renderContactSheet(sheet));
  console.log(`Contact sheet: ${join(outDir, 'index.html')}`);

  // Phase D — commit (opt-in)
  if (flags.commit || flags.dryRun) {
    const workdir = join(process.cwd(), 'out', 'clones');
    await mkdir(workdir, { recursive: true });

    const results: Array<{ repo: string; action: 'pr-opened' | 'pushed' | 'skipped' | 'dry-run' }> =
      [];
    const failures: Array<{ repo: string; error: unknown }> = [];

    const runOne = async (repo: RepoDescriptor): Promise<void> => {
      const label = `${repo.owner}/${repo.name}`;
      const png = join(outDir, `${repo.owner}__${repo.name}.png`);
      try {
        const r = await commitBanner({
          owner: repo.owner, name: repo.name, pngPath: png, workdir,
          dryRun: flags.dryRun, noPr: flags.noPr,
        });
        console.log(`  ${r.action}: ${r.repo}`);
        results.push(r);
      } catch (e) {
        console.error(`  failed: ${label}: ${e instanceof Error ? e.message : e}`);
        failures.push({ repo: label, error: e });
      }
    };

    // --dry-run is a pure log — no clone/push happens, so batching adds no
    // safety value there. Only chunk into waves for a real --commit run.
    if (!flags.dryRun && flags.batch && flags.batch > 0) {
      const waves = chunk(repos, flags.batch);
      for (let w = 0; w < waves.length; w++) {
        const wave = waves[w];
        let waveCommitted = 0;
        let waveSkipped = 0;
        let waveFailed = 0;
        for (const repo of wave) {
          const failedBefore = failures.length;
          await runOne(repo);
          if (failures.length > failedBefore) {
            waveFailed++;
            continue;
          }
          const last = results[results.length - 1];
          if (last?.action === 'skipped') waveSkipped++;
          else waveCommitted++;
        }
        console.log(
          `Wave ${w + 1}/${waves.length}: committed=${waveCommitted}, skipped=${waveSkipped}, failed=${waveFailed}`,
        );
        const isLastWave = w === waves.length - 1;
        if (!isLastWave) {
          if (process.stdin.isTTY) {
            await waitForEnter(`Press Enter to continue to wave ${w + 2}/${waves.length}...`);
          } else {
            console.log('Non-interactive stdin — continuing automatically.');
          }
        }
      }
    } else {
      for (const repo of repos) await runOne(repo);
    }

    const skippedCount = results.filter((r) => r.action === 'skipped').length;
    if (flags.dryRun) {
      const wouldCommitCount = results.filter((r) => r.action === 'dry-run').length;
      console.log(
        `\nWould commit: ${wouldCommitCount}, Skipped: ${skippedCount}, Failed: ${failures.length}`,
      );
    } else {
      const committedCount = results.filter(
        (r) => r.action === 'pr-opened' || r.action === 'pushed',
      ).length;
      console.log(
        `\nCommitted: ${committedCount}, Skipped: ${skippedCount}, Failed: ${failures.length}`,
      );
    }
    if (failures.length) {
      console.log('Failed repos:');
      for (const f of failures) {
        console.log(`  - ${f.repo}: ${f.error instanceof Error ? f.error.message : f.error}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
