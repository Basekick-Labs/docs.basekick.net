# Docusaurus -> Fumadocs conversion rules

Mechanical rules. Apply them identically across all three products.

## File placement

    docs/<path>.md                 ->  content/docs/arc/<path>.md
    docs-arc-enterprise/<path>.md  ->  content/docs/arc-enterprise/<path>.md
    docs-launchpad/<path>.md       ->  content/docs/launchpad/<path>.md

URLs are unchanged: `content/docs/arc/cli/query.md` serves `/arc/cli/query/`.

Three pages carry `slug: /` and become their product's `index`:

    docs/intro.md                     -> content/docs/arc/index.mdx
    docs-arc-enterprise/overview.md   -> content/docs/arc-enterprise/index.mdx
    docs-launchpad/overview.md        -> content/docs/launchpad/index.mdx

## .md or .mdx

Use `.mdx` **only** where the page needs components (Tabs, LatestVersion,
GitHubStars). 17 files use Tabs; everything else stays `.md`.

This matters for comments. `{/* ... */}` is a comment in MDX but **literal
visible text** in plain Markdown. In a `.md` file use an HTML comment:

    <!-- TODO(screenshot): ... -->

Callouts work in `.md` too - fumadocs-mdx processes both - so a page that
only gains Callouts does not need renaming.

`docs-arc-enterprise/configuration/clustering.md` imports Tabs but never uses
them. Delete the import; the file stays `.md`.

## Front matter

Delete `sidebar_position` - ordering moves to `meta.json`.
Delete `slug` on the three index pages - position in the tree defines it.
Add `title` and `description` per `.claude/STYLE-CONTRACT.md`.
Delete the body `<h1>`; Fumadocs renders the title as the h1.

## Admonitions -> Callout

Valid types are exactly: `info`, `warn`, `error`, `success`, `warning`,
`idea`. There is no `note`, `tip` or `danger`.

    :::note      ->  <Callout type="info">
    :::info      ->  <Callout type="info">
    :::tip       ->  <Callout type="idea">
    :::warning   ->  <Callout type="warn">
    :::caution   ->  <Callout type="warn">
    :::danger    ->  <Callout type="error">

`:::tip` maps to `idea`, not `success`: `success` renders with green
checkmark semantics that misread on "Latest Version" or "Cron Schedule
Syntax" notes.

**Preserve the title on the opening line.** Many admonitions carry one, and a
naive regex drops it:

    :::warning Save This Token
    Body text.
    :::

becomes

    <Callout type="warn" title="Save This Token">
    Body text.
    </Callout>

## Tabs

    import Tabs from '@theme/Tabs';          <- delete
    import TabItem from '@theme/TabItem';    <- delete

    <Tabs>
      <TabItem value="docker" label="Docker">body</TabItem>
      <TabItem value="native" label="Native">body</TabItem>
    </Tabs>

becomes

    <Tabs items={['Docker', 'Native']}>
      <Tab value="Docker">body</Tab>
      <Tab value="Native">body</Tab>
    </Tabs>

`items` holds the visible labels; each `Tab`'s `value` must match its label
exactly. Where the original used `groupId`, keep it: `<Tabs groupId="os"
items={[...]}>`.

## Links

The URL scheme is unchanged, so **absolute links are already correct**. Do
not rewrite them. Two things only:

1. Ensure a trailing slash: `/arc/cli/query` -> `/arc/cli/query/`.
2. `docs/advanced/edge-sync.md` has the one relative link in the corpus
   (`./compaction.md#files-per-batch`); point it at the absolute form.

**Never touch a link whose prefix is another product.** 22 links cross
product boundaries. They resolve because the other agent is preserving that
URL. Rewriting them creates conflicts nobody can verify.

## Code fences

143 fences have no language tag. Add one - `bash`, `sql`, `python`, `go`,
`json`, `toml`, `yaml`, `text`. Fences with `title="..."` port unchanged.

## meta.json

One per directory, with an explicit `pages` array reproducing the order the
sidebar shows today (derived in the migration inventory). Where a directory
has an index page, list `"index"` first.

    { "title": "Installation", "pages": ["index", "docker", "native", "kubernetes"] }

Product roots additionally carry `"root": true`, which scopes the sidebar to
that product and drives the product switcher.

Six directories have `sidebar_position` collisions resolved today only by
alphabetical tiebreak, plus one fractional `6.5`. Pin the current visible
order explicitly; do not re-sort.

## Section landing pages

25 categories used Docusaurus `generated-index`, which has no Fumadocs
equivalent. Author each as a real `index.mdx` in that directory, seeded from
the `description` in the old `_category_.json`, with a short paragraph and
links to the pages in the section.

Note these serve `/arc/installation/`, **not** the old
`/arc/category/installation/`. The legacy URLs are handled by redirects; the
landing pages are a navigation and SEO improvement, not URL preservation.

## Screenshot placeholders

Where a diagram or screenshot would genuinely help, leave a marker naming
what to capture and why:

    <!-- TODO(screenshot): the compaction tab mid-run, showing queued vs
         completed jobs - the text describes states the reader cannot picture -->

Launchpad already has 14 real screenshots under `/img/launchpad/`. Reuse
them; do not request replacements.

## Rate claims

Strip inline throughput and latency numbers ("18M records/sec"), replacing
them with qualitative wording. The benchmark pages become short stubs linking
to the blog - see `.claude/BENCHMARK-LINKS.md`.

`docs/changelog.md` is exempt: it is a historical record of what shipped.
