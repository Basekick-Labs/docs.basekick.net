---
sidebar_position: 3
---

# Querying

`arcctl query` runs SQL against an Arc cluster and renders the result in your chosen format. Defaults are operator-friendly: pretty table on stdout, errors on stderr, exit 0 on success, exit 1 on any failure.

## Quick reference

```bash
# Pretty table (default)
arcctl query "SELECT host, value FROM cpu ORDER BY value LIMIT 10"

# Different database for one call
arcctl query --database metrics "SELECT count(*) FROM cpu"

# SQL from a file
arcctl query -f reports/p99.sql

# SQL from stdin
echo "SELECT 1" | arcctl query
```

## SQL input

`arcctl query` accepts SQL three ways, in this precedence:

1. **Positional argument** — `arcctl query "SELECT 1"`
2. **`-f file.sql` flag** — `arcctl query -f reports/p99.sql`
3. **Stdin** — used when neither arg nor `-f` is given and stdin is a pipe (not a TTY)

If you run `arcctl query` interactively with no arguments, it exits immediately with a clear error rather than hanging waiting for stdin.

## Output formats

Pass `-o` (`--output`) to switch:

| Format | When to use |
|---|---|
| `table` (default) | Interactive use; pretty-printed with column headers |
| `json` | Pipe to `jq`, save as `.json`, parse from another script |
| `csv` | Save to a spreadsheet, load into pandas/R, RFC 4180 with header |
| `arrow` | Stream Arrow IPC bytes; pipe to pyarrow / duckdb / polars for analytical post-processing |

### Table

```bash
$ arcctl query "SELECT host, value FROM cpu ORDER BY value"
┌──────────┬───────┐
│   HOST   │ VALUE │
├──────────┼───────┤
│ server-1 │ 42.5  │
│ server-2 │ 43.2  │
│ server-3 │ 44.1  │
└──────────┴───────┘
```

Modifiers:

- `--no-header` — drop the column header row
- `--limit N` — cap output rows client-side (the server still computes the full result; use `LIMIT` in your SQL if you want to bound server work)

Empty result (e.g. measurement that has never been written): prints `(0 rows)` instead of nothing, so you know the query ran.

### JSON

```bash
$ arcctl query "SELECT host, value FROM cpu LIMIT 2" -o json
{
  "columns": ["host", "value"],
  "data": [
    ["server-1", 42.5],
    ["server-2", 43.2]
  ],
  "row_count": 2,
  "execution_time_ms": 1
}
```

The shape is row-major (`data[i]` is row i). This is the raw Arc JSON query response, indented for readability — pipe to `jq` for one-liner transformations:

```bash
arcctl query "SELECT * FROM cpu" -o json | jq '.data[] | {host: .[0], val: .[1]}'
```

### CSV

```bash
$ arcctl query "SELECT host, value FROM cpu ORDER BY value" -o csv
host,value
server-1,42.5
server-2,43.2
server-3,44.1
```

RFC 4180 with a header row by default; `--no-header` drops it. Cell types are stringified — `true`/`false` for bools, `null` cells render as empty fields, integers print without a decimal tail, floats use compact `strconv` formatting.

### Arrow IPC

```bash
arcctl query "SELECT * FROM cpu" -o arrow > out.arrow
# arrow: 4096 bytes, server execution 12ms       (stderr)
```

The Arrow IPC stream goes to stdout; the byte count and server-side execution time go to stderr. Stream the result into pyarrow, DuckDB, or polars:

```bash
# DuckDB
arcctl query "SELECT * FROM cpu" -o arrow | \
  duckdb -c "SELECT count(*) FROM read_arrow('/dev/stdin')"

# pyarrow
arcctl query "SELECT * FROM cpu" -o arrow | python3 -c '
import pyarrow.ipc as ipc, sys
print(ipc.open_stream(sys.stdin.buffer).read_all())
'
```

If the stream is interrupted mid-flight (network drop, client kill, server reset), `arcctl` writes a clear `arrow: stream interrupted after N bytes` line to stderr along with the error. The partial bytes on stdout will not parse cleanly — that's a feature, not a bug; truncated IPC should fail loud.

## Database selection

The default database for a query is taken from the active connection's `default_database` (set via `arcctl config create --default-database NAME`). Override per-call with `--database`:

```bash
arcctl query --database logs "SELECT count(*) FROM access"
```

If neither the connection default nor `--database` is set, Arc applies its own server-side default (`default`).

## Timeouts

```bash
arcctl query --timeout 5m "SELECT count(*) FROM giant_table"
```

`--timeout` is the **per-request HTTP timeout** (default 60s). It must be `> 0`. For long-running queries override it explicitly; arcctl does not infer a longer timeout from the SQL.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Query succeeded (even if 0 rows returned) |
| 1 | Any failure: bad config, network error, server error, malformed flags |

Error messages go to stderr; output goes to stdout. Standard Unix conventions, so this works:

```bash
arcctl query "SELECT * FROM cpu" -o json > out.json 2> err.log
```

## Errors

Server errors are surfaced with the original message and HTTP status:

```bash
$ arcctl query "SELECT FROM cpu"
Error: arc: Parser Error: syntax error at end of input (HTTP 500)
```

Client-side errors (bad flags, missing connection) are caught before any network call:

```bash
$ arcctl query --output yaml "SELECT 1"
Error: invalid --output "yaml" (valid: table, json, csv, arrow)
```
