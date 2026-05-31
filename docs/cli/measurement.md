---
sidebar_position: 6
---

# Measurement Listing

`arcctl measurement list` shows the measurements inside one database. It's a thin wrapper over `GET /api/v1/databases/:name/measurements` — the same data as `arcctl db show <name>`, but presented measurement-first.

Use `arcctl db show` when you want database metadata plus its measurements. Use `arcctl measurement list` when measurements are the primary thing you care about (scripts, CI, alerts).

## Quick reference

```bash
# Use the active connection's default_database
arcctl measurement list

# Explicit database
arcctl measurement list --database metrics

# Pipe to jq
arcctl measurement list --database logs -o json | jq '.measurements[].name'

# Save to CSV (includes the database column for downstream joins)
arcctl measurement list --database production -o csv > production-measurements.csv
```

## Database selection

The database name comes from one of three places, in this precedence:

1. `--database NAME` flag
2. Active connection's `default_database` (set via `arcctl config create --default-database NAME`)
3. *(nothing else)*

If neither is set, the command exits with a clear error before any network call:

```bash
$ arcctl measurement list
Error: no database specified (pass --database or set default_database on the active connection)
```

## Output formats

### Table (default)

```bash
$ arcctl measurement list --database production
┌─────────────┬───────┐
│ MEASUREMENT │ FILES │
├─────────────┼───────┤
│ cpu         │       │
│ disk        │       │
│ mem         │       │
│ net         │       │
└─────────────┴───────┘
```

Rows sorted alphabetically. `FILES` is empty when the server omits the field (older Arc versions or when file counts haven't been computed).

Empty database: `(no measurements in database "X")` so you know the call ran.

### JSON

```bash
$ arcctl measurement list --database production -o json
{
  "database": "production",
  "measurements": [
    { "name": "cpu" },
    { "name": "disk" },
    { "name": "mem" },
    { "name": "net" }
  ],
  "count": 4
}
```

Server-reported `count` is passed through verbatim — not re-derived from `len(measurements)` — so a future Arc server that paginates results will not silently disagree with itself.

### CSV

```bash
$ arcctl measurement list --database production -o csv
database,measurement,file_count
production,cpu,
production,disk,
production,mem,
production,net,
```

The CSV includes a leading `database` column so you can concatenate output across multiple `arcctl measurement list` calls without losing context:

```bash
for db in production staging logs; do
  arcctl measurement list --database "$db" -o csv --no-header
done > all-measurements.csv
```

## Connection overrides

Same flags as every other arcctl command:

```bash
arcctl measurement list -c prod --database metrics
arcctl measurement list --endpoint https://arc.x.example.com --token YOUR-TOKEN --database logs
ARC_CONNECTION=prod arcctl measurement list --database metrics
```

See [Connection management](/arc/cli/connections#precedence).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (including 0 measurements) |
| 1 | Any failure: missing database, network error, server error, missing connection |
