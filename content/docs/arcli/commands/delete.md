---
title: "arcli delete"
description: "Delete rows from an Arc measurement by SQL predicate with arcli delete --where: dry-run preflight, confirmation and --yes, the delete.enabled gate, NULL-predicate handling, and time-bounded deletes."
---

`arcli delete` removes the rows of one measurement that match a SQL predicate, by rewriting the Parquet files that contain them. It needs an **admin** token and a server with `delete.enabled = true` in `arc.toml`; in a cluster only the primary writer accepts it.

## Quick reference

```bash
arcli delete --database metrics --measurement cpu --where "host = 'web-4'" --dry-run
arcli delete --database metrics --measurement cpu --where "host = 'web-4'"
arcli delete --database metrics --measurement cpu --where "time < '2026-01-01' AND region = 'eu-west'" --yes
```

```text
$ arcli delete --database metrics --measurement cpu --where "host = 'web-4'" --dry-run
Would delete 1 rows from metrics.cpu across 1 file(s)
duration: 2ms

$ arcli delete --database metrics --measurement cpu --where "host = 'web-4'"
Delete 1 rows from metrics.cpu by rewriting 1 file(s)? Server limits: confirmation threshold 10000 rows, max 1000000 rows per delete. [y/N] y
Deleted 1 rows from metrics.cpu (1 file(s) rewritten, 1 affected)
duration: 10ms
```

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | database holding the measurement |  |
| `--dry-run` | report what would be deleted without deleting |  |
| `--measurement` `string` | measurement to delete from |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--where` `string` | SQL predicate selecting the rows to delete ("1=1" for all) |  |
| `-y`, `--yes` | skip the preflight scan and the confirmation prompt |  |

Plus the [connection flags](/arcli/reference/connections/#per-command-flags).

## How the predicate is applied

`--where` is a SQL boolean expression over the measurement's columns. arcli sends it as `(<where>) IS TRUE`, so rows where the predicate evaluates to NULL (a missing tag, a NULL field) are **kept**, the same way a `WHERE` clause keeps them out of a result. Put time bounds inside the predicate; there is no separate `--before` or `--after`.

Before deleting, arcli runs the same request as a dry run and folds its row and file counts, together with the server's limits (the row count above which Arc itself demands confirmation, and the maximum rows per delete), into the `[y/N]` prompt on stderr. `--yes` skips **both** the preflight and the prompt, so keep it for scripts whose predicate you have already tested with `--dry-run`. When the preflight reports zero matching rows, arcli additionally checks the predicate with a `COUNT`, so a typo in a column name is an error rather than a silent "0 rows".

## Runtime and interruption

A delete rewrites every file that holds a matching row, so it can take minutes on a large measurement; the default `--timeout` is 30m. If arcli times out or you press Ctrl-C, the server continues the rewrite: check with a query rather than re-running blindly. In the output, `affected` is the number of files that contained matching rows and `rewritten` the number the server rewrote successfully.

For age-based deletion on a schedule, use [retention policies](/arcli/commands/retention/) instead.
