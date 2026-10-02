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

Needs a token with `read` permission. `-o json` prints the server document;
`-o csv` on `db show` emits the measurements only. `--no-header` applies to
table and csv.

### When the token is scoped to specific databases

Where Arc restricts reads per database, `db list` needs a grant covering
every database. A token scoped to particular ones is refused rather than
given a filtered list — the same bar `SHOW DATABASES` applies — so arcli says
so and names the way forward instead of printing a status code:

```text
$ arcli db list
Error: this token is scoped to specific databases, so Arc will not list them
all; name a database you are granted (`arcli db show <database>`,
`arcli measurement list --database <database>`)

$ arcli db show analytics
Error: this token has no read grant for database "analytics"; name a database
it is granted, or ask an Arc administrator to grant it

$ arcli db show production
Database: production
Measurements: 2
```

This is a normal state for a tenant-scoped token, not a failure, and arcli
does not retry it. Three other answers are reported separately, because they
need different fixes:

| What arcli says | Fix |
|---|---|
| `this token does not carry the read permission Arc requires…` | use a token with `read`; naming a database will not help |
| `Arc requires a token to list databases but this connection has none` | `arcli config update NAME --token …` |
| `Arc rejected this connection's token…` | the token is invalid, expired or revoked — issue a new one |
| `arc could not read its own permission data…` | a server-side fault, not this token — check the Arc server log |

`db show` on a database that does not exist still reports
`Database 'x' not found (HTTP 404)`, so "you may not read it" and "it is not
there" stay distinguishable. Note that on a server with per-database reads a
database you have *no grant for* answers the former, not the latter — the
permission check runs first, which is what stops the endpoint being used to
enumerate names.

See [RBAC](/arc-enterprise/security/rbac/#what-a-scoped-token-can-and-cannot-list)
for how grants are decided.

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

Destructive, and gated twice. The server only allows it when `delete.enabled = true` in `arc.toml` (otherwise 403), and the token must be admin. arcli asks `Delete database "staging" and ALL its files? [y/N]` on stderr; anything but `y` or `yes` ends with `Error: aborted` and exit 1, and when stdin is not a terminal the prompt is refused (exit 1) unless `--yes` is given, so no request is sent either way. The request is sent with `?confirm=true`, so the server never asks a second time.

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
