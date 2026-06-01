---
sidebar_position: 7
---

# Bulk Import

`arcctl import` is the migration entry point: load CSV, line protocol, Parquet, or TLE files into an Arc cluster in one shot. All four subcommands hit Arc's `/api/v1/import/*` endpoints and require an **admin** token.

The upload body is streamed via `io.Pipe` — even multi-GB files don't buffer in memory.

## Common shape

Every subcommand:

| Flag | Required | Description |
|---|---|---|
| `-f, --file PATH` | yes | Input file on the local filesystem |
| `--database NAME` | yes | Target database (also reads from the active connection's `default_database`) |
| `--measurement NAME` | depends | Required for `csv` and `parquet`; **optional filter** for `lp`; **optional override** for `tle` (server default: `satellite_tle`) |
| `-o, --output FORMAT` | no | `table` (default) or `json` — no `csv`/`arrow` since the result is a single summary record |
| `--timeout DURATION` | no | Per-request HTTP timeout (default 60s — bump it for large files) |

Plus the standard connection flags (`-c/--connection`, `--endpoint`, `--token`, `--insecure`) shared by every arcctl command.

## `import csv`

```bash
arcctl import csv -f data.csv --database metrics --measurement cpu
```

Full options:

| Flag | Server default | Description |
|---|---|---|
| `--time-column` | `time` | Column whose values become the row timestamp |
| `--time-format` | empty (auto) | `epoch_s`, `epoch_ms`, `epoch_us`, `epoch_ns`; empty means "let DuckDB infer", which works for ISO-8601 strings |
| `--delimiter` | `,` | Field separator |
| `--skip-rows` | `0` | Number of header rows to skip before parsing |

Example with everything:

```bash
arcctl import csv -f data.csv --database metrics --measurement cpu \
    --time-column ts --time-format epoch_ms --delimiter ';' --skip-rows 1
```

## `import lp`

Line protocol files self-declare their measurement(s) in the line syntax, so `--measurement` here acts as a **server-side filter** rather than a destination. Lines whose measurement doesn't match are dropped.

```bash
arcctl import lp -f telegraf-snapshot.lp --database metrics
arcctl import lp -f data.lp.gz --database metrics --precision ms
arcctl import lp -f data.lp --database metrics --measurement cpu  # filter to cpu only
```

- **Gzip auto-detection.** The server inspects magic bytes (`0x1f 0x8b`); pass either `.lp` or `.lp.gz`.
- **Size cap.** 500 MB decompressed.
- **`--precision`** accepts `ns` / `us` / `ms` / `s` (default `ns`). Validated client-side before the upload starts.

A successful import shows the measurements that were ingested (LP can write to multiple in one file):

```
$ arcctl import lp -f mixed.lp --database metrics
OK
  database:      metrics
  measurements:  cpu, mem, disk
  rows_imported: 12450
  precision:     ns
  duration_ms:   137
```

## `import parquet`

Parquet preserves column types end-to-end — faster + lossless compared to CSV for the same data.

```bash
arcctl import parquet -f data.parquet --database metrics --measurement cpu
arcctl import parquet -f data.parquet --database metrics --measurement cpu --time-column ts
```

Only one option besides the common shape: `--time-column` (defaults to `time` server-side).

## `import tle`

TLE (two-line element) is the standard NORAD/NASA format for orbital state vectors — each three-line record contains a satellite name, a "line 1", and a "line 2". The server parses every record and writes one row per satellite to the target measurement.

```bash
arcctl import tle -f starlink.tle --database satellites
arcctl import tle -f starlink.tle --database satellites --measurement starlink
```

- `--measurement` is **optional**; omitting it makes the server use `satellite_tle`.
- TLE checksums are enforced. Records with bad checksums show up in `parse_warnings` on the result and are skipped (the import doesn't fail unless every record is bad).

```
$ arcctl import tle -f mixed.tle --database satellites
OK
  database:        satellites
  measurement:     satellite_tle
  satellite_count: 1247
  rows_imported:   1247
  duration_ms:     89
  parse_warnings (3):
    - entry 17 (UNKNOWN): line 2 checksum mismatch
    - entry 312 (CUBESAT-X): line 1 checksum mismatch
    - entry 489 (BEACON-9): name line missing
```

## Output formats

```bash
# Table (default) — operator-friendly
arcctl import lp -f file.lp --database metrics

# JSON — pipe to jq, save for scripts
arcctl import lp -f file.lp --database metrics -o json
```

`csv` and `arrow` are not valid here — the "result" is a single summary record describing the outcome, not tabular data.

## Database selection

Every subcommand picks the database from the usual precedence:

1. `--database NAME` flag
2. Active connection's `default_database`

If neither is set, the command exits with a clear "no database specified" error before any network call. See [Connection management](/arc/cli/connections#precedence).

## Authentication

**All import endpoints require an admin token.** A read- or write-only token gets HTTP 403 from the server, surfaced verbatim:

```bash
$ arcctl import lp -f file.lp --database metrics
Error: arc: Admin permission required (HTTP 403)
```

Create or rotate admin tokens via the Arc API; arcctl's token-management subcommand ships in a later PR.

## Common errors

| Error | Cause |
|---|---|
| `arc: file is empty (HTTP 400)` | The uploaded file has zero bytes |
| `arc: no file uploaded ...` | Multipart field name mismatch (arcctl always uses `file`; this should not happen) |
| `arc: file exceeds 500MB limit` | LP files cap at 500 MB decompressed |
| `arc: invalid database name ...` | Database name doesn't match alphanumeric + `_-`, max 64 chars |
| `arc: measurement query parameter is required` | You forgot `--measurement` on a CSV or Parquet command |
| `Error: open /path: no such file or directory` | Client-side: the local file doesn't exist |
| `Error: --file is required` | Client-side: you didn't pass `-f` |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Import succeeded (even if `parse_warnings` were emitted for some rows) |
| 1 | Any failure: missing flags, file errors, network errors, server errors |

Error messages go to stderr; results go to stdout. Standard Unix conventions apply:

```bash
arcctl import lp -f data.lp --database metrics -o json > result.json 2> err.log
```
