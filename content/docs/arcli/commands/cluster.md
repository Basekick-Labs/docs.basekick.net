---
title: "arcli cluster"
description: "Arc Enterprise cluster inspection from arcli: cluster status, nodes, node show, node remove and health, role and state filters, the leader rule for removals, and the standalone-server output."
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
arcli cluster node remove node-c        # admin, leader only; prompts
```

## status, health

`status` reports the cluster name, this node's role, the leader, and node counts by state; `health` is the cluster-wide health summary. Both take any token. `-o json` prints the server's document as is.

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

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags). Compaction across the cluster is inspected with [arcli compaction](/arcli/commands/compaction/).
