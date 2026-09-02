# Front-matter style contract

Binding for every page converted during the Fumadocs migration. Three agents
work in parallel on three products and never see each other's output, so this
file is the only thing keeping their voice consistent.

## Why this exists

105 of 109 pages have neither `title` nor `description`. Docusaurus inferred
the title from the H1 and derived a description from the first paragraph.
Fumadocs requires `title`, and uses `description` for the `<meta>` tag, the
search index, the sidebar cards and the `llms.txt` index. So every page needs
both, written by hand.

## title

Take the body H1 verbatim, then delete the H1 from the body. Fumadocs renders
the title as the page's `<h1>` - verified, exactly one per page - so leaving
it in the body produces two.

Four pages already set a `title` that deliberately differs from their H1:

    docs/migration/questdb.md      Migrate from QuestDB       (H1 adds " to Arc")
    docs/migration/timescaledb.md  Migrate from TimescaleDB
    docs/migration/clickhouse.md   Migrate from ClickHouse
    docs/migration/influxdb.md     Migrate from InfluxDB

Keep those titles as they are. The shorter form is what belongs in the
sidebar; the H1 is the longer prose form. Do not "fix" them from the H1.

## description

**Length: 150-200 characters**, with the distinguishing detail inside the
first 155 - that is where search results truncate. Measured from the four
descriptions already in the repo, which run 172-210 and read well.

**Say what the page lets the reader do, and name concrete nouns**: commands,
file formats, endpoints, config keys, protocols. A description made only of
abstractions is worthless in a search result and worthless in the sidebar.

**Never** open with "This page describes", "Learn about", "A guide to" or
"Documentation for". Start with the substance.

No marketing language. No superlatives. Sentence case. It is a sentence, not
a headline - end it with a period.

The model to follow, already in the repo:

    Step-by-step guide to migrating from ClickHouse to Arc: export MergeTree
    tables to CSV or Parquet, import into Arc, move ongoing writes, and
    translate ClickHouse SQL to standard SQL.

Grammatical mood follows the page type:

- **Task pages** (install, configure, integrate) - imperative, describing
  what the reader will accomplish:
      Run Arc in Docker: pull the image, mount a data volume, set the admin
      token, and verify ingestion with a line-protocol write.

- **Reference pages** (API, config keys, CLI) - noun phrase, describing what
  is catalogued:
      Configuration keys for the write-ahead log: sync mode, segment size,
      retention, and the recovery behaviour applied on restart.

- **Concept pages** (architecture, internals) - explain the mechanism, not
  the feature name:
      How Arc buffers writes in the WAL before flushing Parquet, why that
      bounds data loss to the sync interval, and what to tune under sustained
      ingest.

## OSS and Enterprise near-duplicates

30 pages exist in near-identical OSS and Enterprise versions - some differ by
under a dozen lines out of 600. Two agents writing them independently will
produce near-duplicate meta descriptions on near-duplicate pages, which is
worse for search than either choice alone.

Rule: **name the product in the description, and describe what actually
differs.** Never let the two descriptions be interchangeable.

    docs/integrations/grafana.md
      Connect Grafana to Arc with the Arc data source plugin: install it,
      add the connection, and build panels from SQL queries against your
      measurements.

    docs-arc-enterprise/integrations/grafana.md
      Connect Grafana to Arc Enterprise: install the Arc data source, point
      it at a cluster endpoint, and scope dashboard access with RBAC-aware
      tokens.

If the pages genuinely do not differ in a way worth describing, say so by
being specific about the product and its deployment context. Do not pad.

The full list lives in `.claude/DUPLICATE-PAGES.md`.

## What not to touch

- `docs/changelog.md` keeps its historical version numbers and throughput
  figures. A changelog recording what shipped in a release is a historical
  record, not a performance claim, and is exempt from the rate-claim strip.
- Any technical claim you cannot confirm in the Arc source. See
  `.claude/VALIDATION.md`.
