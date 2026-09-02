# Arc Documentation

Documentation for [Arc](https://github.com/Basekick-Labs/arc), Arc Enterprise and
Arc Launchpad. Live at [docs.basekick.net](https://docs.basekick.net).

## Stack

- **[Fumadocs](https://fumadocs.dev)** on Next.js 16 (App Router), exported as a
  fully static site
- **React 19**, **Tailwind 4**, **TypeScript**
- **MDX** for content
- **GitHub Actions** → rsync over Tailscale → **nginx** behind **Traefik**

## Local development

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export into out/
npm run typecheck
npm start          # serve the built out/ locally
```

There is no cache-clearing step. If a build misbehaves, remove `.next/` and
`.source/`.

## Layout

```
content/docs/arc/**             -> /arc/*
content/docs/arc-enterprise/**  -> /arc-enterprise/*
content/docs/launchpad/**       -> /launchpad/*

app/(docs)/[...slug]/           the docs route
app/(home)/                     the landing page
components/mdx.tsx              MDX component registration
lib/source.ts                   content source and loader
public/img/**                   images, referenced as /img/...
scripts/                        the URL contract and its checker
```

## Writing docs

Add a `.md` file under the right product directory, then list it in that
directory's `meta.json`. Ordering is explicit — filename order is not used.

Front matter requires both `title` and `description`:

```yaml
---
title: "Run Arc in Docker"
description: "Pull the image, mount a data volume, set the admin token, and verify ingestion with a line-protocol write."
---
```

`.claude/STYLE-CONTRACT.md` has the rules for writing descriptions, including
length and voice. Use `.mdx` only when a page needs components — note that
`{/* ... */}` is a comment in MDX but renders as literal text in `.md`, where
you want an HTML comment instead.

Available components (registered in `components/mdx.tsx`): `Callout`, `Tabs`/
`Tab`, `Steps`/`Step`, `Accordions`/`Accordion`, `Files`/`Folder`/`File`,
`Cards`/`Card`, plus `LatestVersion` and `GitHubStars`.

`Callout` types are `info`, `warn`, `error`, `success`, `warning` and `idea` —
there is no `note`, `tip` or `danger`.

## URLs are a contract

`scripts/keep-urls.txt` lists every URL that existed before the Fumadocs
migration. All of them must keep resolving:

```bash
npm run build
./scripts/verify-urls.sh out scripts/keep-urls.txt
```

The deploy workflow runs the same check against the live site, plus the 410s in
`dropped-urls.txt` and the redirects in `category-urls.txt`, and fails if any
regress.

Trailing slash is canonical (`/arc/cli/query/`); nginx 301s the un-slashed form.
Renaming a page means adding a redirect in `nginx.conf`, not just moving a file.

## Deployment

Pushing to `main` builds the site and ships it. Each deploy lands in
`releases/<timestamp>-<sha>` on the server and is published by an atomic symlink
swap, so rollback is a symlink repoint rather than a rebuild:

```bash
ssh <user>@<host>
cd /opt/services/docs.basekick.net
ls -1dt releases/*/          # pick the previous release
ln -sfn releases/<RELEASE> html.new && mv -Tf html.new html
```

No container restart is needed — nginx resolves the symlink per request. The
five most recent releases are kept, and the one currently being served is never
pruned.

## Retired products

Memtrace and Liftbridge documentation has been retired. Those URLs return
**410 Gone**. Their content remains in git history before commit `9286270`.
