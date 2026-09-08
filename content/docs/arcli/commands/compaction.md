---
title: "arcli compaction"
description: "Arc compaction from arcli: compaction status, stats, candidates, history and trigger, tier schedules and counters, candidate scans, the 409 on a running cycle, and --wait on a manual trigger."
---

Compaction merges small Parquet files into larger ones on two tiers (hourly and daily). `arcli compaction` reads `/api/v1/compaction/*`; `trigger` needs an **admin** token, the rest work with any token.

## Quick reference

```bash
arcli compaction status
arcli compaction stats
arcli compaction candidates --database metrics
arcli compaction history
arcli compaction trigger --tier hourly --wait
```

## status, stats

```text
$ arcli compaction status
jobs:        0 completed, 0 failed, active -

┌───────────┬─────────┬─────────┬───────────┬──────────────────────┬────────────┐
│ SCHEDULER │ ENABLED │ RUNNING │ SCHEDULE  │     NEXT RUN UTC     │ ROLE GATED │
├───────────┼─────────┼─────────┼───────────┼──────────────────────┼────────────┤
│ daily     │ true    │ true    │ 0 3 * * * │ 2026-09-08T09:00:00Z │ -          │
│ hourly    │ true    │ true    │ 5 * * * * │ 2026-09-08T01:05:00Z │ -          │
└───────────┴─────────┴─────────┴───────────┴──────────────────────┴────────────┘

$ arcli compaction stats
jobs:            0 completed, 0 failed
files compacted: 0
bytes saved:     0 B
manifests:       0 recovered
cycle:           idle (current id 0)

┌────────┬─────────┬─────────┬───────────┬─────────────┬───────┬───────┐
│  TIER  │ ENABLED │ MIN AGE │ MIN FILES │ COMPACTIONS │ FILES │ SAVED │
├────────┼─────────┼─────────┼───────────┼─────────────┼───────┼───────┤
│ hourly │ true    │ 1h      │ 10        │ 0           │ 0     │ 0 B   │
│ daily  │ true    │ 24h     │ 12        │ 0           │ 0     │ 0 B   │
└────────┴─────────┴─────────┴───────────┴─────────────┴───────┴───────┘
```

`status` is the schedulers' view (cron schedule, next run, whether the node's role gates it in a cluster) plus the active job; `stats` is the per-tier configuration and lifetime counters. `-o json` on either prints the server's document unchanged.

## candidates, history

`candidates` asks the server to scan for partitions that qualify for compaction and lists them; the server bounds the scan at 30 seconds, so a very large store may return a partial list. `--database` filters the result client-side. `history` is the server's list of recent jobs: it keeps at most 10, oldest first, without timestamps.

## trigger

```bash
arcli compaction trigger --tier hourly,daily --wait
```

Starts a compaction cycle now. `--tier` picks tiers (both by default); a tier that is disabled in the server config is skipped silently by Arc, so arcli warns first. A cycle already running is a 409, reported as an error. `--wait` polls `stats` until the cycle finishes (`--wait-timeout` default 30m), printing progress to stderr. The server reports the id the triggered cycle is expected to get, and that can be off by one, or a scheduled cycle can start in the same instant and take the manual trigger's place; when the reported cycle id stays below the expected one for three polls, `--wait` gives up and says so rather than wait for a cycle that will never appear.

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | limit the cycle to one database |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--tier` `strings` | tier(s) to run: hourly, daily (repeat or comma-join; default all enabled) |  |
| `--wait` | poll until the cycle has finished |  |
| `--wait-timeout` `duration` | give up waiting after this long (with --wait) | `30m0s` |

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags). Compaction settings themselves live in `arc.toml`; see [Compaction](/arc/advanced/compaction/).
