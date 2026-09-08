---
title: "arcli retention"
description: "Arc retention policies from arcli: retention create, list, show, update, delete, execute and executions, retention and buffer days, dry runs, full-replace updates, and running policies by hand on OSS."
---

A retention policy names a database (and optionally one measurement) and a number of days; executing it deletes the Parquet files whose **newest** row is older than now minus retention plus buffer days. A file that straddles the cutoff is kept whole. `list` and `show` work with any token; `create`, `update`, `delete` and `execute` need admin.

## Quick reference

```bash
arcli retention create --name cpu-30d --database metrics --measurement cpu --retention-days 30
arcli retention list
arcli retention show cpu-30d
arcli retention update cpu-30d --buffer-days 2
arcli retention execute cpu-30d --dry-run
arcli retention execute cpu-30d
arcli retention executions cpu-30d
arcli retention delete cpu-30d
```

## create

```text
$ arcli retention create --name cpu-30d --database metrics --measurement cpu --retention-days 30
Created retention policy "cpu-30d" (id 1)
id:             1
name:           cpu-30d
database:       metrics
measurement:    cpu
retention:      30 days (+0 buffer)
active:         true
last run:       never
…
note: the retention scheduler is not running on this server (Enterprise license required); run it manually with `arcli retention execute 1`
```

Omit `--measurement` to cover every measurement in the database. arcli creates policies **active** by default (the server's own default is inactive, and an inactive policy refuses to execute); pass `--inactive` to create a paused one. The trailing note appears on Arc OSS, where the scheduler that would run policies on a timer is an Enterprise feature: execute them yourself, from cron if you like.

| Flag | Description | Default |
|---|---|---|
| `--buffer-days` `int` | extra safety margin in days added to retention-days |  |
| `--database` `string` | database the policy applies to |  |
| `--inactive` | create the policy disabled / disable it |  |
| `--measurement` `string` | restrict to one measurement (default: all; pass "" to clear on update) |  |
| `--name` `string` | policy name (unique) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--retention-days` `int` | delete files whose newest row is older than this many days (plus buffer) |  |

## list, show, executions

```text
$ arcli retention list
┌────┬─────────┬──────────┬─────────────┬───────────┬────────┬────────┬──────────┬─────────────┬──────────────┐
│ ID │  NAME   │ DATABASE │ MEASUREMENT │ RETENTION │ BUFFER │ ACTIVE │ LAST RUN │ LAST STATUS │ LAST DELETED │
├────┼─────────┼──────────┼─────────────┼───────────┼────────┼────────┼──────────┼─────────────┼──────────────┤
│ 1  │ cpu-30d │ metrics  │ cpu         │ 30d       │ 0d     │ true   │ never    │ -           │ -            │
└────┴─────────┴──────────┴─────────────┴───────────┴────────┴────────┴──────────┴─────────────┴──────────────┘
```

`executions NAME` lists past runs newest first (`--limit`, default 50): time, status, rows deleted, the cutoff used, duration and any error. Table, json or csv.

## update

Only the flags you pass change; `--measurement ""` clears the measurement so the policy covers the whole database; `--active` / `--inactive` toggle it. Arc's update endpoint is a full replace, so arcli reads the policy, merges your flags and writes it back; two people updating the same policy at once means the last writer wins.

| Flag | Description | Default |
|---|---|---|
| `--active` | enable the policy |  |
| `--buffer-days` `int` | extra safety margin in days added to retention-days |  |
| `--database` `string` | database the policy applies to |  |
| `--inactive` | create the policy disabled / disable it |  |
| `--measurement` `string` | restrict to one measurement (default: all; pass "" to clear on update) |  |
| `--name` `string` | policy name (unique) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--retention-days` `int` | delete files whose newest row is older than this many days (plus buffer) |  |

## execute

```text
$ arcli retention execute cpu-30d --dry-run
Would delete 1 files (4 rows) older than 2026-08-09T00:05:55Z from database "metrics"
measurements: cpu
duration:     1ms
```

`--dry-run` reports what would go. Without it, arcli runs the same dry run first and folds it into the prompt on stderr: `Delete 2 files (5 rows) whose newest row is older than 2026-08-09T00:32:21Z from database "metrics" (measurements: cpu)? The server recomputes the cutoff at execution time. [y/N]`; `--yes` skips the prompt (a non-terminal stdin without `--yes` is refused with exit 1). The execution is synchronous and can take a while on large databases, so the default `--timeout` here is 30m; if arcli gives up or is interrupted, the server carries on. In a cluster, reader nodes accept the dry run but refuse the real execution (503): point arcli at a writer.

| Flag | Description | Default |
|---|---|---|
| `--dry-run` | report what would be deleted without deleting |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `-y`, `--yes` | skip the dry-run preflight and the confirmation prompt |  |

## delete

Removes the policy, not any data. Prompts unless `--yes`.

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags). To delete rows by predicate rather than by age, see [arcli delete](/arcli/commands/delete/).
