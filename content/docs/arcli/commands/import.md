---
title: "arcli import"
description: "Bulk-load files into Arc with arcli import csv, lp, parquet or tle: measurement and time-column mapping, delimiter and time-format flags, the 500 MB line-protocol cap, and arcli import stats."
---

`arcli import` uploads one file to Arc's `/api/v1/import/*` endpoints, which parse it server-side and write Parquet directly. All four importers need an **admin** token. `-f` is the file, `--database` the target (or the profile's `default_database`).

## Quick reference

```bash
arcli import csv     -f usage.csv   --database metrics --measurement cpu_import --time-column time
arcli import lp      -f cpu.lp      --database metrics
arcli import parquet -f cpu.parquet --database metrics --measurement cpu
arcli import tle     -f sats.tle    --database space
arcli import stats
```

```text
$ arcli import csv -f usage.csv --database metrics --measurement cpu_import --time-column time
OK
  database:           metrics
  measurement:        cpu_import
  rows_imported:      2
  partitions_created: 1
  time_range:         [2026-09-07T00:00:00Z … 2026-09-07T00:01:00Z]
  columns:            time, host, usage
  duration_ms:        0
```

`-o json` prints the server's response document instead.

## csv

Requires `--measurement`. The header row names the columns; `--time-column` picks the timestamp column (server default `time`) and `--time-format` its encoding when it is an epoch (`epoch_s`, `epoch_ms`, `epoch_us`, `epoch_ns`); left empty, the server lets DuckDB infer the format, which handles ISO 8601 strings. `--delimiter` overrides the server default `,`; `--skip-rows` drops leading lines before the header.

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | target database (required; can also come from active connection's default_database) |  |
| `--delimiter` `string` | field separator (server default: ,) |  |
| `-f`, `--file` `string` | path to the input file (required) |  |
| `--measurement` `string` | target measurement name (required) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--skip-rows` `int` | number of header rows to skip before parsing |  |
| `--time-column` `string` | column to use as the row timestamp (server default: time) |  |
| `--time-format` `string` | epoch_s\|epoch_ms\|epoch_us\|epoch_ns (empty = let DuckDB infer, works for ISO-8601 strings) |  |

## lp

Line protocol from a file. The measurement comes from each line, so `--measurement` is a **filter** here: lines for other measurements are skipped. The server caps the decompressed body at 500 MB and detects gzip automatically. `--precision` sets the timestamp unit (server default nanoseconds).

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | target database (required; can also come from active connection's default_database) |  |
| `-f`, `--file` `string` | path to the input file (required) |  |
| `--measurement` `string` | filter to a single measurement (LP lines for other measurements are dropped) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--precision` `string` | timestamp precision: ns\|us\|ms\|s (default: server-side default = ns) |  |

## parquet

Requires `--measurement`. The file's schema becomes the measurement's columns; `--time-column` names the timestamp column when it is not `time`.

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | target database (required; can also come from active connection's default_database) |  |
| `-f`, `--file` `string` | path to the input file (required) |  |
| `--measurement` `string` | target measurement name (required) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--time-column` `string` | column to use as the row timestamp (server default: time) |  |

## tle

Two-line element sets (satellite orbits). The measurement defaults to `satellite_tle`.

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | target database (required; can also come from active connection's default_database) |  |
| `-f`, `--file` `string` | path to the input file (required) |  |
| `--measurement` `string` | target measurement (server default: satellite_tle) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |

## stats

```text
$ arcli import stats
requests: 1
records:  2
errors:   0
```

Process-wide counters across every import format since the server started; per node, reset on restart, any token. `-o json` prints the raw document.

Every subcommand also takes the [connection flags](/arcli/reference/connections/#per-command-flags).

## Alternatives

For streaming writes from a pipeline use [arcli write](/arcli/commands/write/) (line protocol, MessagePack or JSON on stdin); for migrations from InfluxDB, [tsm2arc](/arc/migration/tsm2arc/) reads TSM files directly.
