# docs.basekick.net - Claude Code Instructions

## Project Overview

The docs site for Arc — Fumadocs (Next.js App Router) + TypeScript + MDX.
Three products: Arc OSS, Arc Enterprise, Arc Launchpad. Auto-deploys via
GitHub Actions to nginx behind Traefik.

Memtrace and Liftbridge are **retired**. Their source directories remain in
the repo for history but are not built, not linked, and their old URLs return
410 Gone.

**Tech stack:** Next.js 16 (static export), Fumadocs 16, React 19, Tailwind 4,
TypeScript, MDX. Static site — no runtime backend.

## Build & Test

```bash
npm run dev        # dev server
npm run build      # static export into out/
npm run typecheck  # next typegen && tsc --noEmit
```

There is no cache-clearing step; if a build behaves oddly, remove `.next/`
and `.source/`.

## Layout

```
content/docs/arc/**             -> /arc/*
content/docs/arc-enterprise/**  -> /arc-enterprise/*
content/docs/launchpad/**       -> /launchpad/*
app/(docs)/[...slug]/           the docs route (REQUIRED catch-all)
app/(home)/                     the landing page at /
components/mdx.tsx              MDX component registration
lib/source.ts                   content source + loader
public/img/**                   images, referenced as /img/...
```

## Conventions

### URLs are a contract
Every URL that exists today must keep working. They are enumerated in
`scripts/keep-urls.txt` and asserted by the post-deploy check. Renaming a
page means adding a redirect in `nginx.conf`, not just moving the file.

Trailing slash is canonical (`/arc/cli/query/`). nginx 301s the un-slashed
form.

### Content
- New pages go under the right product directory in `content/docs/`.
- Ordering and grouping live in `meta.json` per directory, with an explicit
  `pages` array. Never rely on filename order.
- Front matter: `title` and `description` are both **required** — see
  `.claude/STYLE-CONTRACT.md` for the rules, including length and mood.
- Use `.mdx` only when the page needs components; otherwise `.md`.
  `{/* ... */}` is a comment in MDX but literal text in `.md` — use HTML
  comments there.
- Cross-link with absolute paths including the trailing slash.
- Every code block gets a language tag.

### Style
- **Sentence case for headings**: "## Cache layers", "### When it helps",
  "## This configuration" (never "## This Configuration"). Only the first word
  and proper nouns are capitalized; the first word after a colon is also
  capitalized ("### Step 2: Use Arc token"). Hyphenated compounds follow the
  same rule per part ("## Multi-writer clusters", "write-ahead" mid-heading).
  Product names, acronyms and literal identifiers keep their own casing:
  `Arc`, `SQL`, `DuckDB`, `MinIO`, `mTLS`, `adapter-node`, "404 Not Found",
  "Write-Ahead Log (WAL)". Decided 2026-09-03; the corpus was converted from
  Title Case in the same change. Front-matter `description` is also a
  sentence, so it is sentence case too. See `.claude/STYLE-CONTRACT.md`.
- Code samples must be runnable as written — no placeholders without `<...>`.
- Don't ship `TODO:` into main. `TODO(screenshot:)` and `TODO(verify:)`
  markers are deliberate and tracked.
- Don't invent flags, endpoints, config keys or version numbers. Check
  against the Arc source — see `.claude/VALIDATION.md`.
- Throughput and latency numbers live on the blog, not in the docs. The
  exception is `changelog.md`, which is a historical record.

### Git & PRs
- Branch from main: `docs/<topic>`, `feat/<topic>`, `fix/<topic>`.
- Commit format: `docs(scope): description`.

## Reference files

- `.claude/STYLE-CONTRACT.md` — front-matter rules
- `.claude/MDX-CONVERSION.md` — Docusaurus→Fumadocs mechanics
- `.claude/SIDEBAR-ORDER.md` — the navigation order to preserve
- `.claude/DUPLICATE-PAGES.md` — the 30 OSS/Enterprise near-duplicates
- `.claude/VALIDATION.md` — where to verify technical claims
- `.claude/BENCHMARK-LINKS.md` — verified blog URLs (and one that 404s)

## Post-Implementation Review

As last step, use parallel agents to review. Frame each as a **staff/principal
docs engineer or technical-writing reviewer**. The bar is "would a sharp human
reviewer flag this on the next PR pass?"

Every review prompt must include: *"Do a line-level pass — flag broken links,
mismatched code samples vs current API, dead front matter, missing language
tags on code blocks, meta.json entries pointing at nonexistent files. Don't be
deferential. Output file:line for every finding."*

Run these THREE agents in parallel:

1. **Correctness** — code samples run? CLI flags match the binary? API
   examples match current handler signatures? Versions consistent?
   Cross-product references still valid?
2. **Style & structure** — sentence-case headings, consistent voice, no
   marketing fluff in reference pages. One topic per page. Front-matter
   `title` and `description` present and per contract. Code blocks tagged.
3. **Build & deployment hygiene** — `npm run build` clean; every page reachable
   from a `meta.json`; no orphans; images under `public/img/`; no committed
   `out/`, `.next/` or `.source/`.

### Review Loop Discipline

Address all internal-review findings in a single follow-up commit BEFORE
asking external reviewers. If a later reviewer flags something the internal
pass missed, spawn a fresh round of the three agents looking for issues *of
the same shape* before fixing.

## Common Pitfalls

- `<Tabs>`, `<Steps>`, `<Files>` and `<Accordion>` are **not** auto-registered.
  An unregistered component does not warn — it fails the build during
  prerender. Register in `components/mdx.tsx`.
- `Callout` has no `note`, `tip` or `danger` type. Valid: `info`, `warn`,
  `error`, `success`, `warning`, `idea`.
- An optional catch-all (`[[...slug]]`) collides with `app/(home)/page.tsx`.
  The docs route is a required catch-all by necessity.
- Broken links are a release blocker, not a warning. The corpus was at zero
  when it migrated; keep it there.
