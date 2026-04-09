# License Design — OG Engine

**Date:** 2026-04-10
**Status:** Draft — awaiting review
**Author:** Philippe Matray (brainstormed with Claude)

## 1. Context & Goal

OG Engine currently ships with no `LICENSE` file at the repo root and no `license`
field in `package.json`. The `sdk/package.json` declares `"license": "MIT"` but
ships no `LICENSE` file alongside it. This leaves the project in an ambiguous
legal state: by default, "no license" means **all rights reserved**, which is
the opposite of what a would-be OSS-friendly project wants.

Philippe is a solo developer running OG Engine as a bootstrapped SaaS via
Atypical Consulting SRL. The goal of adding a license is to make the project
**credibly open for individuals and OSS projects, while pushing companies
onto a paid path**. The license is the primary revenue-protection mechanism
for a one-person shop that cannot afford to have its work cloned and resold.

## 2. Goals

- Individual developers can read, modify, and self-host `src/` for their own
  personal or side projects without paying or asking permission.
- Open-source projects can self-host `src/` as part of their own OSS stack.
- Companies that want to **host OG Engine as a service to their own users**,
  or **embed OG Engine inside a product they sell**, must purchase a
  commercial license.
- Any company can freely integrate the SDK (`sdk/`) to call OG Engine's
  hosted API — the SDK must be permissively licensed so corporate legal teams
  approve it without friction.
- The license must be **off-the-shelf**, not custom-drafted. A solo dev
  should not be shipping custom license text.
- The project must have a **credible OSS promise**: every release should
  eventually become fully open source on a fixed clock.

## 3. Non-Goals

- Charging companies for purely internal use of OG Engine (e.g. BigCo's
  marketing team rendering 10 OG cards per month on their own infra).
  Enforcement is infeasible and the revenue is negligible.
- Blocking individuals from doing freelance client work with OG Engine.
  "Individual" is defined by the person doing the work, not the billing
  relationship.
- Relicensing dependencies (`@chenglou/pretext`, `@napi-rs/canvas`, `hono`,
  etc.). They keep their own licenses.
- Setting up a Contributor License Agreement (CLA). YAGNI until the first
  non-trivial external contribution.
- Writing a trademark policy for the "OG Engine" name.
- Adding self-host pricing tiers to `og-engine.com/pricing/`. That is a
  product decision, not a licensing decision.

## 4. Decision: FSL-1.1-Apache-2.0 for `src/`, Apache-2.0 for `sdk/`

### 4.1 `src/` and repo root → **FSL-1.1-Apache-2.0**

The [Functional Source License](https://fsl.software), v1.1, with Apache-2.0
as the Future License. This is an off-the-shelf license written by Sentry in
2023 for exactly this threat model (solo maintainers / small teams running an
OSS-credible SaaS and needing commercial protection).

**Fill-in fields:**

| Field | Value |
|---|---|
| Licensor | Atypical Consulting SRL |
| Software | OG Engine |
| Change Date | Release date + 2 years, per release |
| Change License | Apache License, Version 2.0 |

**Permitted Purpose (FSL term):** any purpose other than a Competing Use.

**Competing Use (FSL term):** making the software available to third parties
in a manner that substitutes for a commercial offering of the Licensor.

**How this maps to the goals:**

| Scenario | Permitted? |
|---|---|
| Solo dev using OG Engine on their personal blog | Yes |
| OSS project self-hosting OG Engine in its own stack | Yes |
| Freelancer using OG Engine to deliver a client project | Yes |
| Company running OG Engine internally to render its own marketing site's cards | Yes |
| Company self-hosting OG Engine to serve image generation to *its customers* | **No — Competing Use, needs commercial license** |
| Company embedding OG Engine's server inside a product it sells | **No — Competing Use, needs commercial license** |
| Anyone launching a rival hosted OG-image-generation service | **No — Competing Use, needs commercial license** |

**2-year auto-conversion:** every release automatically relicenses to
Apache-2.0 two years after its release date. This is the community-credibility
mechanism: the code *will* become fully open source, just not the latest
version. Users who want the latest get it under FSL terms; users willing to
run 2-year-old code get Apache-2.0.

### 4.2 `sdk/` → **Apache-2.0**

The SDK must be freely usable by any company, because restricting the SDK
would prevent corporate customers from calling the hosted API — i.e. it would
block the primary revenue funnel. Apache-2.0 is preferred over MIT for the
explicit patent grant, which makes corporate legal teams happier.

**Note:** `sdk/package.json` currently declares `"license": "MIT"` with no
accompanying `LICENSE` file. This spec overrides that declaration:
`sdk/package.json` will be updated to `"license": "Apache-2.0"` and a
`sdk/LICENSE` file added. Confirmed by Philippe during review.

### 4.3 Alternatives considered and rejected

| License | Why not |
|---|---|
| **PolyForm Noncommercial** | Blocks individuals doing freelance work. Contradicts "individuals free." |
| **PolyForm Small Business** | Gated on company size, not the goal. A €900k-revenue competitor could still self-host for free. |
| **Elastic License 2.0** | No time-delayed OSS conversion. Weaker community story. |
| **n8n Sustainable Use License** | Allows all internal business use even for large companies, no auto-conversion. Non-standard, no SPDX. |
| **BSL (Business Source License)** | Predecessor to FSL. Each release specifies its own Additional Use Grant — more error-prone for a solo maintainer. FSL strictly dominates. |
| **Custom license** | Needs a lawyer. Corporate legal teams balk at unfamiliar text. High risk of drafting bugs. |
| **MIT / Apache for `src/`** | No commercial protection at all. Any company could self-host and resell. |

## 5. Files to Create

### 5.1 `LICENSE` (repo root)

Full text of FSL-1.1-Apache-2.0 with the fill-in fields from §4.1. The
canonical template lives at <https://fsl.software/FSL-1.1-Apache-2.0.template.md>.
The root `LICENSE` applies to the entire repo **except** any subdirectory
that contains its own `LICENSE` file — which `sdk/` will.

### 5.2 `LICENSE-APACHE-2.0` (repo root)

The full Apache License 2.0 text, referenced by the FSL's conversion clause.
Required so that readers can see what the Future License actually says
without leaving the repo.

### 5.3 `sdk/LICENSE`

Full Apache-2.0 text, scoped to the SDK directory. Standard Apache-2.0
boilerplate with `Copyright 2026 Atypical Consulting SRL`.

### 5.4 `COMMERCIAL-LICENSE.md` (repo root)

Plain-English explainer. Draft content:

```markdown
# Commercial License

OG Engine's server is free to use, modify, and self-host for most purposes
under the [Functional Source License](./LICENSE). **You need a commercial
license only if:**

- You host OG Engine as a service that your own users call (even
  internally-marketed, even free-to-your-users).
- You embed OG Engine's server code inside a product you sell, license, or
  distribute.
- You operate a hosted OG-image-generation service that competes with OG
  Engine's own hosted API.

**You do NOT need a commercial license if:**

- You're calling OG Engine's hosted API at `api.og-engine.com` — that's what
  your subscription plan at <https://og-engine.com/pricing/> covers.
- You're a developer using it for personal projects, side projects, or your
  own learning.
- You're an open-source project self-hosting it as part of your own OSS stack.
- You're a company using it purely internally — e.g. rendering OG images for
  your own marketing site — without exposing it to your users or customers
  as a feature.

## I just want to call the hosted API

You're in the right place: <https://og-engine.com/pricing/>. No commercial
license needed — your plan covers it.

## I need to self-host or embed

Email **philippe@atypical.consulting** with:

- Your company name
- A one-line description of how you plan to use OG Engine
- Expected render volume per month

We'll get back to you within 2 business days with terms.

## Not sure which side of the line you're on?

Email **philippe@atypical.consulting** with your use case. We'll tell you
for free. No gotchas.
```

### 5.5 `LICENSE-HISTORY.md` (repo root)

Tracks, for each release, the date it converts to Apache-2.0. FSL requires
this to be discoverable. Format:

```markdown
# License History

Every release of OG Engine ships under FSL-1.1-Apache-2.0 and automatically
converts to Apache-2.0 two years after its release date.

| Version | Release Date | Converts to Apache-2.0 on |
|---------|--------------|---------------------------|
| 0.1.0   | TBD          | TBD (release date + 2 years) |
```

The first row uses `TBD` because `v0.1.0` has not yet shipped. The
release-checklist task in §6 ensures the row is filled in at release time.

## 6. Files to Modify

### 6.1 `README.md`

Add a "License" section near the bottom with the blurb from brainstorming
Section 2. Links to `LICENSE`, `sdk/LICENSE`, and `COMMERCIAL-LICENSE.md`.

### 6.2 `package.json` (root)

Change `"license"` to `"SEE LICENSE IN LICENSE"` (npm's convention for
non-SPDX licenses — FSL is not yet registered with SPDX). Currently the
field is **absent**; this adds it.

### 6.3 `sdk/package.json`

Change `"license": "MIT"` to `"license": "Apache-2.0"`.

### 6.4 `CLAUDE.md` (or new `RELEASING.md`)

Add a release checklist note:

> When cutting a release, append a row to `LICENSE-HISTORY.md` with:
> `| <version> | <YYYY-MM-DD today> | <YYYY-MM-DD today + 2 years> |`
>
> This is required by FSL for the Change Date to be discoverable.

Placement decision deferred to implementation: if a `RELEASING.md` already
exists or is planned, the note goes there; otherwise append to the CLAUDE.md
"Build Priorities" section.

## 7. Implementation Sequencing

All changes land in a **single atomic commit** so the repo is never in a
half-licensed state.

1. Create `LICENSE` (FSL-1.1-Apache-2.0, filled in).
2. Create `LICENSE-APACHE-2.0` (full Apache text).
3. Create `sdk/LICENSE` (Apache-2.0 boilerplate).
4. Create `COMMERCIAL-LICENSE.md`.
5. Create `LICENSE-HISTORY.md` with placeholder first row.
6. Modify `README.md` — add License section.
7. Modify `package.json` — add `license` field.
8. Modify `sdk/package.json` — update `license` field.
9. Add release-checklist note to `CLAUDE.md` or `RELEASING.md`.
10. Commit as one change: `chore(license): add FSL-1.1-Apache-2.0 for server, Apache-2.0 for SDK`.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| FSL is not SPDX-registered, so tooling (GitHub license detection, npm, dependency scanners) will report "unknown license" | Accepted cost. Sentry, Keygen, Gitpod all ship on FSL and survive it. The README and `package.json` `SEE LICENSE IN LICENSE` convention handle the human-readable case. |
| A company self-hosts, claims "internal use," and actually runs it as a feature for their customers | Out-of-scope for the license itself; this is a detection/enforcement question, not a drafting question. The license gives the legal grounds; enforcement is a business decision if/when it happens. |
| Philippe forgets to update `LICENSE-HISTORY.md` on a release and a release ships with no Change Date recorded | Mitigated by the release-checklist note in §6.4. Could be further mitigated by a lefthook pre-tag check in a future iteration — out of scope for this spec. |
| An OSS contributor submits a PR and there's no CLA, so the contribution rights are ambiguous | Accepted until the first non-trivial external contribution. FSL does not require a CLA. Revisit if/when it becomes a real problem. |
| Corporate legal reviewers reject FSL because it's unfamiliar | Mitigated by the `COMMERCIAL-LICENSE.md` file giving them a clear path to a commercial license and explicit answers to "do I need one?" |

## 9. Open Questions for User Review

1. **Release-checklist placement:** `CLAUDE.md` or a new `RELEASING.md`?
   (§6.4) No existing `RELEASING.md` found. Default: append to `CLAUDE.md`.
2. **`LICENSE-HISTORY.md` first row:** leave as `TBD | TBD` placeholder, or
   pre-fill `v0.1.0` with today's date? Default: `TBD` until the actual
   release ships, to avoid a stale "released" date in an unreleased version.
