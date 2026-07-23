# Design — README Banner Generator

**Date:** 2026-07-23
**Status:** Approved (design), pending spec review
**Owner:** Philippe Matray (@phmatray)

## Goal

Generate a consistent, branded banner image for every repository across two GitHub
accounts (`phmatray`, `Atypical-Consulting`) and commit it (`.github/banner.png`) into
each repo's README.
This closes the biggest gap surfaced by the portfolio README audit: only **6 %** of
READMEs currently have a logo/banner. og-engine already renders GitHub-style repo
cards; this feature adds a purpose-built template plus a batch CLI that turns the
whole portfolio into a uniform visual family.

The same 1280×640 asset doubles as the repo's GitHub **social preview** image.

## User stories

- As the portfolio owner, I run one command and get a banner PNG for every repo,
  committed via one PR per repo, so I can harmonize 327 repos without manual design.
- As a visitor, I see a recognizable, on-brand banner at the top of every README, with
  the repo name, a one-line pitch, primary language, and star count.
- As the owner of a flagship repo, I can override the tagline / accent / emoji via a
  small `.og/banner.json` file when the defaults aren't good enough.

## Decisions (settled during brainstorming)

| Axis | Decision |
|---|---|
| Delivery | Static PNG committed into each repo (`.github/banner.png`), referenced at top of README. CLI batch. |
| Content source | Hybrid: GitHub metadata by default; tagline from README's first meaningful line (fallback: GitHub description); optional `.og/banner.json` override. |
| Visual identity | One template `readme-banner`; **accent = primary language color** (GitHub linguist palette) for per-repo variety on a common layout. |
| Wordmark | Per owner: `Philippe Matray` on `phmatray` repos, `Atypical Consulting` on `Atypical-Consulting` repos. Common layout otherwise. |
| Format | 1280×640 (OG standard; reusable as GitHub social preview). Slim variant deferred. |

## Banner anatomy (`readme-banner` template)

```
┌── brand mesh, dark, tinted by accent ───────────────────┐
│  ◆ PHILIPPE MATRAY                          ● C#        │  wordmark (per owner) + language chip
│                                                         │
│  FormCraft                                              │  repo name — bold sans, autofit
│  Dynamic forms for Blazor — fluent + attributes         │  tagline (README 1st line / desc)
│                                                         │
│  github.com/phmatray/FormCraft                 ★ 53     │  Geist Mono, muted + stars
└─────────────────────────────────────────────────────────┘
```

- **Unity** comes from the fixed layout + per-owner wordmark.
- **Variety** comes from `accent = language color`, applied to: language dot/chip, the
  separator line, and a subtle background glow. Text stays light (`#e6edf3`) on a dark
  mesh for legibility regardless of accent lightness.
- **Typography:** repo name + wordmark in a bold sans already loaded by the engine
  (`Outfit`); the `github.com/owner/repo` line in `Geist Mono` (present in `fonts/`).
- **Brand mark:** a small `◆` diamond glyph drawn directly on the canvas in the accent
  color, immediately left of the wordmark. No external SVG asset (the repo's `logo.svg`
  is og-engine's own logo, not the portfolio brand). Self-contained and accent-tinted.
- **Background:** reuse `paintBackgroundMesh(ctx, W, H, 'void', accent)` — the existing
  void preset tinted by the language accent. No new gradient asset required.

### Accent = language color

New map `src/engine/language-colors.ts` using the GitHub linguist palette. Portfolio
covers mostly:

| Language | Hex | Language | Hex |
|---|---|---|---|
| C# | `#178600` | Rust | `#dea584` |
| TypeScript | `#3178c6` | Java | `#b07219` |
| JavaScript | `#f1e05a` | Python | `#3572A5` |
| HTML | `#e34c26` | CSS | `#563d7c` |
| Shell | `#89e051` | Go | `#00ADD8` |
| Dockerfile | `#384d54` | TeX | `#3D6117` |
| GDScript | `#355570` | Swift | `#F05138` |

Fallback for unknown/`null` language: the engine's default accent `#38ef7d`.

## Architecture

### og-engine changes (in-repo, reused by the API too)

1. **`src/engine/templates/readme-banner.ts`** — new `TemplateFn`, derived from
   `github-repo.ts`. Consumes `content.title` (repo name), `content.description`
   (tagline), and `variables`: `owner`, `wordmark`, `language`, `stars`, `repoPath`
   (`owner/repo`). Renders wordmark top-left, language chip top-right, name + tagline,
   bottom mono line + stars. Returns the standard `TemplateResult` (line counts / overflow).
2. **`src/engine/language-colors.ts`** — `languageColor(lang: string | null): string`.
3. **`src/engine/templates/index.ts`** — register `'readme-banner'`.
4. No changes to renderer, autofit, fonts, formats, cache — all reused.

### New CLI — `scripts/generate-readme-banners.ts`

Run with `bun run scripts/generate-readme-banners.ts [flags]`. Phased so nothing is
committed before visual QA.

**Phase A — collect** (per account): `gh repo list <owner> --json name,description,`
`stargazerCount,primaryLanguage,isFork,isArchived,owner`. For each repo, fetch the
README's first meaningful line via `gh api repos/{owner}/{name}/readme` (raw) — the
first non-heading, non-badge, non-blank line — as the tagline; fallback to the GitHub
description. Read optional `.og/banner.json` (`{ tagline?, accent?, emoji?, wordmark? }`)
if present in the repo.

**Phase B — render**: build the render input (`template: 'readme-banner'`, content,
variables, `style.accent = override.accent ?? languageColor(language)`, format
`1280×640 png`) and call **`renderCard` in-process** (no HTTP server needed). Write PNG
to `out/<owner>__<name>.png`.

**Phase C — contact sheet**: emit `out/index.html` — a responsive grid of every banner
with repo name + owner, for visual QA and design iteration. (Mirrors the audit dashboard.)

**Phase D — commit** (opt-in, `--commit`): for each selected repo, using a shallow
clone or existing local checkout: copy PNG to `.github/banner.png`, insert
`![<repo> banner](.github/banner.png)` as the first line of `README.md` if not already
present, commit on branch `chore/readme-banner`, push, open PR via `gh pr create`.

**Flags:** `--account <phmatray|Atypical-Consulting|all>`, `--only <repo,...>`,
`--skip-archived` (default true), `--skip-forks` (default true), `--dry-run`,
`--commit`, `--batch <N>` (validation pause between waves), `--limit <N>`.

### Data flow

```
gh (repos + README 1st line) ─┐
.og/banner.json (optional) ───┼─► build input ─► renderCard() ─► PNG ─► out/ ─► contact sheet
                              │                                              │
                              └──────────────────────────────────────────────┴─► (--commit) .github/banner.png + README + PR
```

## Override schema — `.og/banner.json`

```json
{
  "tagline": "The fastest way to build dynamic Blazor forms",
  "accent": "#8844AE",
  "emoji": "🎨",
  "wordmark": "Philippe Matray"
}
```

All fields optional. `accent` overrides the language color; `wordmark` overrides the
per-owner default; `emoji` is prepended to the repo name if set.

## Testing strategy (vitest)

- `tests/engine/language-colors.test.ts` — known languages map correctly; unknown →
  fallback; case-insensitive.
- `tests/engine/readme-banner.test.ts` — template renders at 1280×640 without throwing;
  returns `overflow: true` when title/tagline exceed line budgets; long names autofit.
- `tests/scripts/tagline-extract.test.ts` — first-meaningful-line extraction skips `#`
  headings, `![badge]`/shields lines, HTML comments, and blank lines; falls back to
  description when the README has no prose line.
- CLI is exercised via a `--dry-run` unit that asserts the built render input for a
  fixture repo (no network, `gh` mocked).

## Rollout plan

1. Implement template + language-colors + CLI on `feat/readme-banner-generator`.
2. Generate `out/` for **all** repos, review the contact sheet, iterate the design.
3. Commit in waves with `--commit --batch 5`, starting with ~20 flagship repos
   (TaLibStandard, FormCraft, BlazorMVU, SalesPitch, RoselineMCP, Koine…), validating
   each wave before the next.
4. Set the same PNG as GitHub social preview (manual or `gh` follow-up) — optional.

## Out of scope (YAGNI / deferred)

- **GitHub Action** for auto-refresh on push/schedule — deferred to a phase 2 (idea 4.2
  in `docs/analysis/FEATURES-IDEAS.md`); the static CLI covers the harmonization goal now.
- **Live render URL** in READMEs — rejected (service-uptime dependency, camo caching).
- **Slim `1280×384` variant** — deferred until the 640 format is validated.
- **Full README parsing** for features/bullets — rejected as fragile across 296 uneven READMEs.

## Resolved decisions (were open questions)

- **Banner file location → `.github/banner.png`** for all repos. It is a presentation/meta
  asset, so `.github/` (unobtrusive, conventional) is preferred over polluting `docs/` or
  adding a top-level `assets/` folder. Referenced as `![<repo> banner](.github/banner.png)`.
- **Wordmark → text + canvas-drawn `◆` mark**, no external SVG. The repo's `logo.svg` is
  og-engine's own logo, not the portfolio brand, so it is deliberately not used.
- **GitHub `description` rewrite → out of scope.** Sourcing the tagline from the README for
  the banner does not mutate the repo's GitHub description. A portfolio-wide description
  cleanup is a separate task, not coupled to banner generation.
