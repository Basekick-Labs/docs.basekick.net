---
title: "Diagnostics"
description: "Check an Arc server from arcli: ping for health and token verification, logs by level and time window, scheduler status for the CQ and retention schedulers, and the process-wide import counters."
---

Four read-only commands for "is it up, is my token good, what is it doing".

## ping

```text
$ arcli ping
endpoint:   http://localhost:8000 (connection local)
health:     ok (uptime 925.342375ms, latency 4.9ms) storage: hot=ok
auth:       ok as "admin" (id 1, read,write,delete,admin)
```

`ping` calls `GET /health` without a token, then `/api/v1/auth/verify` with it. Exit 0 means both passed (or the server runs without authentication); exit 1 otherwise. `-o json` prints the same report as a document even on failure, so a script can distinguish "server down" from "token rejected":

```bash
arcli ping -o json | jq -r '[.health.status, .auth.valid] | @tsv'
```

`ping` is unauthenticated on the health side, so it never counts as CLI usage in Arc's telemetry (see [Privacy](/arcli/reference/privacy/)).

| Flag | Description | Default |
|---|---|---|
| `-o`, `--output` `string` | output format: table\|json | `"table"` |

## logs

```text
$ arcli logs --level info --limit 3
┌──────────────────────┬───────┬───────────┬──────────────────────────────┐
│         TIME         │ LEVEL │ COMPONENT │           MESSAGE            │
├──────────────────────┼───────┼───────────┼──────────────────────────────┤
│ 2026-09-08T00:05:37Z │ INFO  │ backup    │ Backup completed             │
│ 2026-09-08T00:05:37Z │ WARN  │ backup    │ Failed to backup config file │
│ 2026-09-08T00:05:37Z │ INFO  │ backup    │ SQLite database backed up    │
└──────────────────────┴───────┴───────────┴──────────────────────────────┘
```

Reads `GET /api/v1/logs` (**admin** token), newest first. Arc keeps the last 10 000 entries in memory per process and returns at most 1000 per call. `--level` is a minimum (`warn` returns warn, error and fatal), `--since` is a window ending now from 1m to 24h (default 1h, rounded up to whole minutes), `--limit` 1 to 1000 (default 100). Behind a load balancer each call may reach a different node. Messages are what the server captured; one containing a double quote may be cut short by the server's log parser. Table, json or csv (`-o csv` adds the caller column).

| Flag | Description | Default |
|---|---|---|
| `--level` `string` | minimum level: debug\|info\|warn\|error\|fatal |  |
| `--limit` `int` | maximum entries (1-1000) | `100` |
| `--no-header` | suppress column header row (table + csv) |  |
| `-o`, `--output` `string` | output format: table\|json\|csv | `"table"` |
| `--since` `duration` | window ending now (1m-24h) | `1h0m0s` |

## scheduler status

```text
$ arcli scheduler status
continuous queries:  not running (Enterprise license required)
retention:           not running (Enterprise license required)
```

Whether the continuous-query and retention schedulers are running on this server. On Arc OSS they are not; run [retention policies](/arcli/commands/retention/) and [continuous queries](/arcli/commands/cq/) by hand. Any token.

## import stats

```text
$ arcli import stats
requests: 1
records:  2
errors:   0
```

Process-wide counters across every import format since the server started (per node, reset on restart). Any token; documented with [arcli import](/arcli/commands/import/#stats).

All of these take the [connection flags](/arcli/reference/connections/#per-command-flags).
