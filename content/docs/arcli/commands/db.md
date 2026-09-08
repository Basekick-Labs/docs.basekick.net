---
title: "arcli db"
description: "Arc databases from arcli: db list, show, create and drop (confirmation prompt, --yes for scripts, the delete.enabled gate), plus measurement list for a database's measurements and file counts."
---

Databases in Arc are namespaces for measurements. `arcli db` wraps `/api/v1/databases`; `arcli measurement list` wraps a database's measurement listing.

## Quick reference

```bash
arcli db list
arcli db create metrics
arcli db show metrics
arcli measurement list --database metrics
arcli db drop staging          # prompts; --yes to skip in scripts
```

```text
$ arcli db list
┌─────────┬──────────────┬────────────┐
│  NAME   │ MEASUREMENTS │ CREATED AT │
├─────────┼──────────────┼────────────┤
│ metrics │ 2            │            │
└─────────┴──────────────┴────────────┘

$ arcli db show metrics
Database: metrics
Measurements: 2

┌─────────────┬───────┐
│ MEASUREMENT │ FILES │
├─────────────┼───────┤
│ cpu         │       │
│ mem         │       │
└─────────────┴───────┘
```

## db list, db show

Any token. `-o json` prints the server document; `-o csv` on `db show` emits the measurements only. `--no-header` applies to table and csv.

| Flag | Description | Default |
|---|---|---|
| `--no-header` | suppress column header row (table + csv) |  |
| `-o`, `--output` `string` | output format: table\|json\|csv | `"table"` |

## db create

```text
$ arcli db create metrics
Created database "metrics" (created_at: 2026-09-08T00:32:22Z)
```

Names start with a letter and contain letters, digits, `_` or `-`, at most 64 characters; `system`, `internal` and `_internal` are reserved. An existing name is a 409 from the server, reported as an error.

## db drop

Destructive, and gated twice. The server only allows it when `delete.enabled = true` in `arc.toml` (otherwise 403), and the token must be admin. arcli asks `Delete database "staging" and ALL its files? [y/N]` on stderr; anything but `y` prints `Aborted.` and exits 0 without a request, which is also what happens when stdin is not a terminal, so scripts must pass `--yes`. The request is sent with `?confirm=true`, so the server never asks a second time.

| Flag | Description | Default |
|---|---|---|
| `-y`, `--yes` | skip the confirmation prompt (destructive!) |  |

## measurement list

```text
$ arcli measurement list --database metrics
┌─────────────┬───────┐
│ MEASUREMENT │ FILES │
├─────────────┼───────┤
│ cpu         │       │
│ mem         │       │
└─────────────┴───────┘
```

Needs a database: `--database`, else the profile's `default_database`; with neither, arcli errors before making a request. Table, json or csv output.

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | database to list measurements from (defaults to connection's default_database) |  |
| `--no-header` | suppress column header row (table + csv) |  |
| `-o`, `--output` `string` | output format: table\|json\|csv | `"table"` |

All of these take the [connection flags](/arcli/reference/connections/#per-command-flags).
