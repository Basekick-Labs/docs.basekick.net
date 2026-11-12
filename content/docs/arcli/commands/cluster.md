---
title: "arcli cluster"
description: "Arc Enterprise cluster inspection from arcli: cluster status, nodes, node show, node remove, health and files, role and state filters, the leader rule for removals, the compaction pause lease a restore holds, paging through the cluster file manifest, and the standalone-server output."
---

Clustering is an [Arc Enterprise](/arc-enterprise/configuration/clustering/) feature. `arcli cluster` reads `/api/v1/cluster/*`; on a standalone server only `status` succeeds, and says so:

```text
$ arcli cluster status
clustering:  disabled (Enterprise license not configured)
mode:        standalone
```

## Quick reference

```bash
arcli cluster status
arcli cluster nodes
arcli cluster nodes --role reader --state healthy
arcli cluster node show node-b
arcli cluster health
arcli cluster files --database metrics  # admin
arcli cluster node remove node-c        # admin, leader only; prompts
```

## status, health

`status` reports the cluster name, this node's role, the leader, and node counts by state; `health` is the cluster-wide health summary. Both take any token. `-o json` prints the server's document as is.

### Compaction pause

On Arc 27.01.1+, a [cluster restore](/arcli/commands/backup/#restore) pauses compaction on every node for its duration. From the next arcli release, `status` shows that pause in its table output while it is active, and also when its lease has expired without being released:

```text
$ arcli cluster status
clustering:  enabled
cluster:     prod
running:     true
local node:  writer-1 (writer)
nodes:       3 total, 3 healthy (writers 1, readers 1, compactors 1)
raft:        Leader, leader writer-1, this node is leader: true
compaction:  paused by writer-1 for restore backup-20261110-120000-abcdef12, lease expires 2026-11-10T15:06:00Z, waiting for compactor-1
...
```

The line names the node that requested the pause, its reason, the lease expiry, and the nodes that have not acknowledged it yet (`all nodes acknowledged` once none are left; the restore starts only then). The restore renews the lease while it runs, so the expiry is not when the pause will end. An expired lease is printed as `pause lease expired (...)`, with a pointer to the restore and the server log: the restore that held it stopped renewing it. Older Arc versions report no pause and print no line, and `-o json` is unchanged (the server's `compaction_pause` object is in it when Arc reports one).

## nodes, node show

`nodes` lists every member with role, state, address and last heartbeat. `--role` filters to `writer`, `reader`, `compactor` or `standalone`; `--state` to `healthy`, `unhealthy`, `dead`, `unknown`, `joining` or `leaving`; the two combine. `node show ID` prints one node in full. Table, json or csv.

| Flag | Description | Default |
|---|---|---|
| `--no-header` | suppress column header row (table + csv) |  |
| `-o`, `--output` `string` | output format: table\|json\|csv | `"table"` |
| `--role` `string` | filter by role |  |
| `--state` `string` | filter by state |  |

## node remove

Removes a node from membership. Requires an admin token and must be sent to the **leader**: when you address another node, arcli names the leader in its error rather than retrying elsewhere, so you can decide which endpoint to use. The server refuses to remove itself. Prompts unless `--yes`.

| Flag | Description | Default |
|---|---|---|
| `-y`, `--yes` | skip the confirmation prompt |  |

## files

`files` reads the cluster file manifest, the Raft-replicated list of every data file the cluster knows, one bounded page at a time (next arcli release; `file` is an alias). It needs an **admin** token and an Arc that pages the manifest (26.06.2+); arcli rejects a response without a `next_cursor` rather than treat a whole manifest as one page. On a standalone server it exits 1 with the server's reason.

```bash
arcli cluster files
arcli cluster files --database metrics --limit 500 -o json
arcli cluster files --cursor 'metrics/cpu/2026/10/27/part.parquet'
```

A page holds 1,000 entries by default; `--limit` takes 1 to 10,000. `--database` filters by database, and `--cursor` continues after the path the previous page returned as its next cursor. Entries come in the manifest's path order, which the cursor follows. The table has the columns `PATH`, `DATABASE`, `MEASUREMENT`, `TIER`, `SIZE`, `PARTITION TIME`, `ORIGIN NODE` and the SHA-256. Below the rows arcli prints the page count and, while more pages follow, the cursor to pass next:

```text
files on this page: 2
next cursor: metrics/mem/2026/11/10/14/mem_20261110_140000_1.parquet
```

With `-o csv` the rows go to stdout (`path`, `database`, `measurement`, `tier`, `size_bytes`, `sha256`, `partition_time`, `origin_node_id`, `created_at`, `lsn`, `cov2_inherited`, `compaction_job`; sizes in bytes, strings verbatim) and the count and cursor lines go to stderr, so stdout stays valid CSV. `-o json` prints the server's response, including `files`, `total` and `next_cursor`. Table and CSV timestamps are UTC RFC3339; `--time-output rfc3339nano` keeps fractional seconds.

| Flag | Description | Default |
|---|---|---|
| `--cursor` `string` | continue after a path returned as next_cursor |  |
| `--database` `string` | filter by database |  |
| `--limit` `int` | maximum files in this page (1-10000) | `1000` |
| `--no-header` | suppress column header row (table + csv) |  |
| `-o`, `--output` `string` | output format: table\|json\|csv | `"table"` |

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags). Compaction across the cluster is inspected with [arcli compaction](/arcli/commands/compaction/).
