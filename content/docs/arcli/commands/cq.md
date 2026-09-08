---
title: "arcli cq"
description: "Arc continuous queries from arcli: cq create, list, show, update, delete, execute and executions, the {start_time}/{end_time} placeholders, database-qualified sources, and windowed manual runs."
---

A continuous query (CQ) runs a SQL statement over a time window on an interval and writes the result into a destination measurement: rollups, downsampling, derived series. Every `cq` subcommand, including `list` and `show`, needs an **admin** token.

## Quick reference

```bash
arcli cq create --name cpu-hourly --database metrics --source cpu --destination cpu_hourly --interval 1h \
  --query "SELECT date_trunc('hour', time) AS time, host, avg(usage) AS usage FROM metrics.cpu WHERE time >= {start_time} AND time < {end_time} GROUP BY 1, 2"
arcli cq list
arcli cq show cpu-hourly
arcli cq execute cpu-hourly --start 2026-09-07T00:00:00Z --end 2026-09-07T02:00:00Z
arcli cq executions cpu-hourly
arcli cq update cpu-hourly --interval 30m
arcli cq delete cpu-hourly
```

## Writing the query

Two things the server requires, both checked by arcli before the request:

- The statement must contain the `{start_time}` and `{end_time}` placeholders. The server substitutes the window bounds as timestamp literals on each run.
- The source must be written database-qualified, `FROM metrics.cpu`, because that is the form the server rewrites to the underlying files. arcli warns when it sees a bare `FROM cpu`; the CQ is created but its executions fail with "table does not exist".

The result's columns become the destination measurement's columns; include a `time` column. `--tag-column` marks columns to store as tags (repeatable). `--query-file` reads the statement from a file (at most 64 KiB) instead of `--query`.

## create

```text
$ arcli cq create --name cpu-hourly --database metrics --source cpu --destination cpu_hourly --interval 1h --query "…"
Created continuous query "cpu-hourly" (id 2)
id:              2
name:            cpu-hourly
database:        metrics
source:          cpu
destination:     cpu_hourly
interval:        1h
tag columns:     -
active:          true
last run:        never
…
note: the cq scheduler is not running on this server (Enterprise license required); run it manually with `arcli cq execute 2`
```

`--interval` is a Go duration (`30m`, `1h`) of at least 10s: the server's scheduler clamps anything shorter to 10s, and an interval it cannot parse is stored without complaint and never scheduled, so arcli validates both before sending. On Arc OSS the scheduler is an Enterprise feature (`arcli scheduler status` shows it), so run CQs with `execute`, from cron if needed.

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | database holding the source measurement |  |
| `--description` `string` | free-text description ("" clears on update) |  |
| `--destination` `string` | destination measurement (letter first; letters, digits, _ -) |  |
| `--inactive` | create the query disabled / disable it |  |
| `--interval` `string` | run interval as a Go duration (30s, 5m, 1h); minimum 10s |  |
| `--name` `string` | query name (unique) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--query` `string` | aggregation SQL with {start_time} and {end_time} placeholders |  |
| `--query-file` `string` | read the SQL from a file instead of --query |  |
| `--source` `string` | source measurement |  |
| `--tag-column` `strings` | tag column(s) in the result; repeat or comma-join |  |

`update NAME` takes the same flags, changing only those you pass; `--clear-tag-columns` empties the tag list.

## execute

```text
$ arcli cq execute cpu-hourly --start 2026-09-07T00:00:00Z --end 2026-09-07T02:00:00Z
status:       completed (cq-exec-eb18a16e)
window:       2026-09-07T00:00:00Z → 2026-09-07T02:00:00Z
destination:  cpu_hourly
written:      0 records
duration:     3ms
```

Without `--start`/`--end` the window runs from the last processed time (or one hour ago on a first run) to now. The server caps a single execution at 10 minutes, and it moves the CQ's watermark to `--end` whether or not rows were written, so a backfill should walk windows in order. `--dry-run` returns the SQL the server would run, with the placeholders filled in, without writing. The default `--timeout` here is 10m.

| Flag | Description | Default |
|---|---|---|
| `--dry-run` | show the SQL the server would run without executing it |  |
| `--end` `string` | window end (RFC3339) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--start` `string` | window start (RFC3339) |  |

## executions

```text
$ arcli cq executions cpu-hourly
┌──────────────────────┬───────────┬─────────────────────────────────────────────┬─────────┬──────────┬───────┐
│         TIME         │  STATUS   │                   WINDOW                    │ WRITTEN │ DURATION │ ERROR │
├──────────────────────┼───────────┼─────────────────────────────────────────────┼─────────┼──────────┼───────┤
│ 2026-09-08T00:06:19Z │ completed │ 2026-09-07T00:00:00Z → 2026-09-07T02:00:00Z │ 0       │ 3ms      │ -     │
└──────────────────────┴───────────┴─────────────────────────────────────────────┴─────────┴──────────┴───────┘
```

Newest first, `--limit` rows (default 50); table, json or csv.

## delete

Removes the CQ, not the destination measurement. Prompts unless `--yes`.

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags).
