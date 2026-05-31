---
sidebar_position: 5
---

# Database Administration

`arcctl db` manages databases on an Arc cluster. The subcommands map directly onto Arc's `/api/v1/databases` endpoints.

## Quick reference

```bash
# List every database the active token can see
arcctl db list

# Inspect one database (info + its measurements)
arcctl db show production

# Create an empty database
arcctl db create metrics

# Drop a database and ALL its files (prompts y/N; use --yes to skip)
arcctl db drop old_metrics
```

## `db list`

```bash
arcctl db list
arcctl db list -o json | jq '.databases[] | select(.measurement_count > 0)'
arcctl db list -o csv > inventory.csv
```

Output formats: `table` (default), `json`, `csv`. Rows are sorted by name across every format so JSON / CSV / table agree on row order.

Empty server (no databases) renders `(no databases)` so you know the call ran.

## `db show <name>`

```bash
$ arcctl db show production
Database: production
Measurements: 4

┌─────────────┬───────┐
│ MEASUREMENT │ FILES │
├─────────────┼───────┤
│ cpu         │       │
│ disk        │       │
│ mem         │       │
│ net         │       │
└─────────────┴───────┘
```

Combines `GET /api/v1/databases/:name` with `GET /api/v1/databases/:name/measurements`. JSON output (`-o json`) composes them into one object:

```json
{
  "database":     { "name": "production", "measurement_count": 4 },
  "measurements": [{ "name": "cpu" }, { "name": "disk" }, ...],
  "count":        4
}
```

`-o csv` emits only the measurements list — the database header isn't tabular-shaped.

If either API call fails, `arcctl` exits with that error and prints nothing — better to fail loud than render half a view.

## `db create <name>`

```bash
$ arcctl db create metrics
Created database "metrics" (created_at: 2026-05-31T23:39:58Z)
```

Server-side validation:

- Name must start with a letter and contain only alphanumeric, underscore (`_`), or hyphen (`-`) characters, max 64.
- Names `system`, `internal`, `_internal` are reserved.
- Creating a database that already exists returns HTTP 409.

The server's error messages surface verbatim, so a rejected create gives an actionable hint:

```bash
$ arcctl db create 1bad
Error: arc: Invalid database name: must start with a letter and contain only alphanumeric characters, underscores, or hyphens (max 64 characters) (HTTP 400)
```

## `db drop <name>`

**Destructive.** Drops a database and **all** of its files.

```bash
# Interactive: prompts y/N
$ arcctl db drop old_metrics
Delete database "old_metrics" and ALL its files? [y/N] y
Deleted database "old_metrics"

# Scripted: --yes skips the prompt
$ arcctl db drop --yes ci_scratch
Deleted database "ci_scratch"
```

Layered safety. arcctl gates the call client-side; Arc gates it server-side:

1. **Client-side prompt** — default is N. Pass `--yes` (or `-y`) to skip; anything other than `y` / `yes` (case-insensitive) aborts.
2. **Server requires `delete.enabled=true`** in `arc.toml`. If not set, the server returns HTTP 403 with the verbatim message `"Delete operations are disabled. Set delete.enabled=true in arc.toml to enable."` — arcctl surfaces it as-is.
3. **Server requires admin token.** A read- or write-only token gets HTTP 403 from the server, surfaced verbatim.
4. **Server blocks reserved names** (`system`, `internal`, `_internal`). HTTP 403, surfaced verbatim.
5. **Server requires `?confirm=true`** on the request URL. arcctl always sends it; no operator-visible knob.

`arcctl` never bypasses any of these. If a drop fails, the message will tell you why.

## Connection overrides

All `db` subcommands accept the same connection flags as `query` and `write`:

```bash
# Named profile
arcctl db list --connection prod

# Ad-hoc (no profile)
arcctl db list --endpoint https://arc.x.example.com --token YOUR-TOKEN

# CI-friendly env vars
ARC_CONNECTION=prod arcctl db list
ARC_ENDPOINT=https://... ARC_TOKEN=... arcctl db list
```

See [Connection management](/arc/cli/connections#precedence) for the full precedence rules.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (including `Aborted.` on a declined `db drop` prompt) |
| 1 | Any failure: bad flags, network error, server error, missing connection |
