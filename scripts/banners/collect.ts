import { extractTagline } from './tagline';
import type { BannerOverride, RepoDescriptor } from './render-input';

export interface GhRepo {
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  isFork: boolean;
  isArchived: boolean;
}

export interface CollectOpts {
  skipForks: boolean;
  skipArchived: boolean;
  only?: string[];
  limit?: number;
}

export async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`${cmd.join(' ')} exited ${code}: ${err.trim()}`);
  }
  return out;
}

export function parseRepoList(
  json: string,
  opts: { skipForks: boolean; skipArchived: boolean },
): GhRepo[] {
  const raw = JSON.parse(json) as Array<Record<string, unknown>>;
  return raw
    .map((r) => ({
      name: String(r.name),
      owner: (r.owner as { login?: string })?.login ?? '',
      description: (r.description as string | null) ?? null,
      language: (r.primaryLanguage as { name?: string } | null)?.name ?? null,
      stars: Number(r.stargazerCount ?? 0),
      isFork: Boolean(r.isFork),
      isArchived: Boolean(r.isArchived),
    }))
    .filter((r) => !(opts.skipForks && r.isFork))
    .filter((r) => !(opts.skipArchived && r.isArchived));
}

async function fetchReadme(owner: string, name: string): Promise<string | null> {
  try {
    return await run(['gh', 'api', `repos/${owner}/${name}/readme`, '-H', 'Accept: application/vnd.github.raw']);
  } catch {
    return null;
  }
}

async function fetchOverride(owner: string, name: string): Promise<BannerOverride | null> {
  try {
    const raw = await run([
      'gh', 'api', `repos/${owner}/${name}/contents/.og/banner.json`,
      '-H', 'Accept: application/vnd.github.raw',
    ]);
    return JSON.parse(raw) as BannerOverride;
  } catch {
    return null;
  }
}

export async function collectRepos(owner: string, opts: CollectOpts): Promise<RepoDescriptor[]> {
  const fields = 'name,description,primaryLanguage,stargazerCount,isFork,isArchived,owner';
  const json = await run(['gh', 'repo', 'list', owner, '--limit', '500', '--json', fields]);
  let repos = parseRepoList(json, opts);
  if (opts.only?.length) repos = repos.filter((r) => opts.only?.includes(r.name));
  // --limit caps how many of the SELECTED repos to process, applied after --only/filters.
  if (opts.limit != null) repos = repos.slice(0, opts.limit);

  const out: RepoDescriptor[] = [];
  for (const r of repos) {
    const readme = await fetchReadme(r.owner, r.name);
    const override = await fetchOverride(r.owner, r.name);
    out.push({
      owner: r.owner,
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stars,
      tagline: readme ? extractTagline(readme) : null,
      override,
    });
  }
  return out;
}
