---
title: "arcli backup"
description: "Server-side Arc backups from arcli: backup create, list, show, status, restore and delete, --wait polling, the single operation slot, what INCOMPLETE counts, restore modes (merge and replace on Arc 27.01.1+ clusters), metadata and config, and the cluster-wide compaction pause."
---

Arc writes backups on the server itself. Up to Arc 26.09 they go to the directory in `backup.local_path`; Arc 27.01.1+ can also write them to remote targets (`backup.targets`) and take a backup scoped to some databases (the `databases` field of `POST /api/v1/backup`). There is no incremental mode, and `backup.enabled = false` turns the feature off. `arcli backup` drives that over `/api/v1/backup`. Every subcommand needs an **admin** token. arcli always creates a full backup of every database (it has no flag for a scoped one), but it lists, shows and restores scoped backups like any other.

On a cluster running Arc 27.01.1+, create, restore and delete must be sent to the **primary writer**; any other node answers HTTP 503 before the operation starts. Backup storage is per node when it is local, so `restore` and `delete` on a node that does not hold the backup answer HTTP 404 before the prompt.

Several behaviours below are in arcli `main` but not yet in a published arcli release (the latest is 26.09.4). They are marked **arcli 26.09.5**, **arcli 27.01.1** or **next arcli release**, after the release-note files that list them.

## Quick reference

```bash
arcli backup create --wait
arcli backup list
arcli backup show backup-20260908-000537-3969cf1d
arcli backup status
arcli backup restore backup-20260908-000537-3969cf1d --wait
arcli backup restore backup-20261110-120000-abcdef12 --mode replace --wait   # Arc 27.01.1+ cluster
arcli backup delete backup-20260908-000537-3969cf1d
```

## create

```text
$ arcli backup create --wait
Backup backup-20260908-000537-3969cf1d started; waiting...
Backup backup-20260908-000537-3969cf1d completed: 2 files, 1.7 KiB
```

The server accepts the request and returns immediately; arcli prints the id at once and, with `--wait`, polls `status` until the operation finishes (progress to stderr, `--wait-timeout` default 2h). Ids are `backup-YYYYMMDD-HHMMSS-<8 hex>`. A backup includes the data files plus the metadata database and the server config file; `--no-metadata` and `--no-config` leave those out. Create, restore and delete share one slot on the server: a second operation while one runs is refused. When the finished backup has gaps, the `--wait` success line ends with them (skipped files, files that could not be listed and, from the next arcli release, files present only in the cluster manifest of an Arc 27.01.1+ cluster) and points at `arcli backup show` for the breakdown.

| Flag | Description | Default |
|---|---|---|
| `--no-config` | exclude the server config file |  |
| `--no-metadata` | exclude the metadata store (tokens, policies, continuous queries) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--wait` | poll until the backup has finished |  |
| `--wait-timeout` `duration` | give up waiting after this long (with --wait) | `2h0m0s` |

## list, show, status

```text
$ arcli backup show backup-20260908-000537-3969cf1d
backup id:   backup-20260908-000537-3969cf1d
created:     2026-09-08T00:05:37Z
type:        full (server dev)
contents:    2 files, 1.7 KiB, metadata true, config false

┌──────────┬─────────────┬───────┬─────────┐
│ DATABASE │ MEASUREMENT │ FILES │  SIZE   │
├──────────┼─────────────┼───────┼─────────┤
│ metrics  │ cpu         │ 1     │ 687 B   │
│ metrics  │ mem         │ 1     │ 1.0 KiB │
└──────────┴─────────────┴───────┴─────────┘
```

```text
$ arcli backup list
┌─────────────────────────────────┬──────────────────────┬──────┬───────────┬───────┬─────────┬────────────────────────────────────────┐
│               ID                │       CREATED        │ TYPE │ DATABASES │ FILES │  SIZE   │               INCOMPLETE               │
├─────────────────────────────────┼──────────────────────┼──────┼───────────┼───────┼─────────┼────────────────────────────────────────┤
│ backup-20260917-000000-aaaaaaaa │ 2026-09-17T00:00:00Z │ full │ 1         │ 21    │ 2.0 KiB │ 3 skipped, 1 metadata, 2 unaddressable │
│ backup-20260908-000537-3969cf1d │ 2026-09-08T00:05:37Z │ full │ 1         │ 2     │ 1.7 KiB │ -                                      │
└─────────────────────────────────┴──────────────────────┴──────┴───────────┴───────┴─────────┴────────────────────────────────────────┘
```

`list` is newest first. `INCOMPLETE` (arcli 26.09.5) says what the backup lacks, as the server counts it (Arc 26.09.3+), with the counts kept apart because they are different populations: **skipped** data files were inventoried (they are in `FILES`) but not stored; **metadata** files (Iceberg metadata, compaction recovery state, not in `FILES`) were skipped; **unaddressable** files have a key no listing can return, so they were never inventoried. `-` means none reported, which is a complete backup or an Arc older than 26.09.3. With `-o csv`, three columns follow `total_size_bytes`: `skipped_files`, `skipped_metadata_files`, `unaddressable_files`.

### Cluster backups (Arc 27.01.1+)

On a cluster, Arc 27.01.1+ cross-checks the backup node's storage listing against the cluster file manifest, which adds four counts. From the next arcli release, `INCOMPLETE` uses them as follows:

- **manifest-only** files are listed in the cluster manifest, but the backup node did not hold them when the run ended (typically a new primary still catching up). They are missing from the backup, so they count as incomplete; a re-run on a caught-up node closes the gap.
- **skipped** counts only the skips that are still missing data. A skip whose file had left the cluster manifest by the end of the run (compaction, retention or tiering removed it while the backup ran) is **reconciled** and is subtracted.
- **unregistered** files were in local storage but not in the cluster manifest, so Arc did not copy them (compaction or retention inputs awaiting unlink, pre-cluster files, dropped registrations). They are not backup data and are not counted.
- **left-manifest** files were copied, then dropped from the backup again because the manifest no longer listed them at the end of the copy. Not a gap either: the backup holds what the cluster held.

Unregistered, left-manifest and reconciled are information only; they appear in `show` and in CSV. With `-o csv`, four more columns follow `unaddressable_files` (next arcli release): `unregistered_skipped`, `manifest_only_files`, `left_manifest_during_run`, `skipped_reconciled`. The CSV `skipped_files` is the server's raw count, before reconciled skips are subtracted. Scripts that take the last column by position should be updated.

`show` names the files (arcli 26.09.5). For an incomplete backup its `INCOMPLETE` line gives the counts in words, including how many files were skipped for a key too long to store, and is followed by one `skipped:` line per file the manifest names (up to 32) and one `unaddressable:` line per file in that sample:

```text
contents:    21 files, 2.0 KiB, metadata true, config false
INCOMPLETE:  3 of 21 files and 1 metadata file were skipped while backing up (1 for a key too long to store); 2 files could not be listed (unaddressable)
  skipped:       mydb/cpu/2026/09/17/00/a.parquet
  skipped:       mydb/cpu/2026/09/17/00/b.parquet
  unaddressable: mydb/cpu/2026/09/17/00/.hidden.parquet
```

From the next arcli release, `show` also prints the cluster cross-check of an Arc 27.01.1+ cluster backup, with the sample the manifest keeps for each count (up to 32 paths each):

```text
contents:    40 files, 12.3 KiB, metadata false, config false
INCOMPLETE:  2 files were present only in the cluster manifest
unregistered:     2 local data files were not in the cluster manifest and were not backed up
cluster manifest: checked
  unregistered:  mydb/cpu/2026/11/10/13/old-a.parquet
  unregistered:  mydb/cpu/2026/11/10/13/old-b.parquet
  manifest-only: mydb/cpu/2026/11/10/14/c.parquet
  manifest-only: mydb/cpu/2026/11/10/14/d.parquet
```

A `reconciled:` line says how many skipped files later left the manifest (not incomplete), and a `left manifest:` line how many copied files were dropped again, followed by `left-manifest:` sample lines.

`status` shows the last operation (or `idle`) with files and bytes done, and is what `--wait` polls. It lists the skipped files the server names, reports files a backup could not list (their names are in the manifest once the backup has completed, otherwise in the server log), and, for a restore, says what the restored backup already lacked when it was taken and how many Iceberg warehouse files were not restored because the node has no outside-root warehouse. For a backup on an Arc 27.01.1+ cluster it also reports manifest-only files with their sample (next arcli release). For a restore on Arc 27.01.1+ it adds the [restore progress](#restore-progress) lines below.

## restore

```text
$ arcli backup restore backup-20260908-003222-1f611f94 --wait --yes
Restore of backup-20260908-003222-1f611f94 started; waiting...
Restore of backup-20260908-003222-1f611f94 completed: 4 files, 3.7 KiB written
The server reports that restored metadata or config requires a restart. Restart the server after the restore completes.
```

That restart line is arcli 27.01.1's; arcli 26.09.4 and earlier print a different one. A restore writes the backup's data files into the server's storage; files at the same paths are replaced. arcli prompts unless `--yes`, and warns before restoring a backup that lacks files for any reason its manifest records. The restore runs in the background: without `--wait`, arcli prints that it started and exits, and `arcli backup status` follows it.

Stop writers first. What else to do depends on the Arc version:

- **Arc 27.01.1+ on a cluster:** every restore, merge or replace, pauses compaction cluster-wide for its duration and releases the pause at the end, and registers every data file it writes in the cluster file manifest, so the other nodes replicate it. Every node must run 27.01.1+: an older node refuses or never acknowledges the pause, and the restore fails. A backup taken before 27.01.1 has no sidecar, and a cluster node refuses to restore it; restore it on a standalone node or take it again.
- **Arc 26.06 to 26.09 on a cluster:** stop compaction yourself. Restored files are not registered in the cluster manifest, so the other nodes do not learn about them.
- **Standalone, any version:** stop compaction yourself.

### Modes: merge and replace

`--mode merge|replace` (next arcli release) chooses how an Arc 27.01.1+ server restores the data:

- **merge** is additive: the backup's files are written next to whatever is there. On a cluster this also resurrects every file that retention, compaction or a delete removed since the backup was taken, on every node. It is the default for a full backup, and the only mode a standalone server runs.
- **replace** (cluster only) first removes the current hot-tier files of each restored database from every node, including data written after the backup was taken, then writes and registers the backup's files. Paths the backup holds are overwritten rather than removed; cold-tier objects are not removed.

Without `--mode`, arcli sends no mode and Arc decides: **merge**, except that on a cluster node with the file manifest a **scoped** backup resolves to **replace**, since restoring one database on a cluster means putting that database back. Pass `--mode merge` to keep the current files in that case. Arc echoes the mode it will run, and arcli adds `(mode: replace)` to its started and completed lines when that is what Arc reported; a merge prints the lines earlier releases print.

Arc refuses a replace in these cases:

| Case | When Arc refuses |
|---|---|
| Standalone server, or a cluster node without the cluster file manifest (`cluster.raft_data_dir` not set) | HTTP 400, before the restore starts |
| Scoped backup that holds no data files for one of its databases (replace would only remove that database's current files) | HTTP 400, before the restore starts, for an explicit or an implicit replace |
| Incomplete backup: unreconciled skips, unaddressable or manifest-only files, or files missing or unreadable in backup storage | after the 202, as a failed restore |
| More than 10% of the data files the backup node listed were unregistered (a backup taken against a stale manifest view) | after the 202, as a failed restore |

The last two are found by the restore itself, after compaction has been paused, so without `--wait` arcli has already reported the restore as started and exited 0; the failure shows only in `arcli backup status`. For an explicit `--mode replace`, arcli itself refuses a backup whose manifest records skipped, unaddressable or manifest-only files, before it prompts. An implicit replace of a scoped backup is decided by Arc, so use `--wait` or pass `--mode merge`.

**Arc 26.09 and earlier** have no restore modes: they ignore `--mode` and merge. An unechoed `--mode merge` is therefore accepted. When Arc does not confirm `--mode replace`, arcli warns and exits nonzero, but the accepted restore may still be running as a merge: check `arcli backup status` and verify the data before retrying.

### Metadata and config

`--with-metadata` and leaving metadata to the server's default are arcli 27.01.1; `--data-only` and `--with-config` are older:

- With none of them, arcli leaves metadata to the server's default. Arc 27.01.1+ restores the metadata store on a standalone node when the backup contains it and skips it on a cluster node. Arc 26.09 and earlier restore it by default on any node; pass `--data-only` there to keep a cluster node's own metadata.
- `--with-metadata` asks for the metadata store explicitly. Arc 27.01.1+ cluster nodes refuse it with HTTP 400: the SQLite database holds Raft-replicated tokens, the node's tier rows and the audit log.
- `--with-config` also restores the server config file. Arc 27.01.1+ cluster nodes refuse it too, because `arc.toml` holds the node's identity.
- `--data-only` restores data files only. It cannot be combined with either of the other two.

arcli 26.09.4 and earlier request the metadata store whenever the backup holds it, so on an Arc 27.01.1+ cluster node their restore is refused with HTTP 400 unless `--data-only` is given.

Restored metadata and config are only **staged**: the server applies them at its next start. arcli prints restart guidance when the server says a restart is required; wait for the restore to complete before restarting. A scoped backup never carries the metadata store.

### Restore progress

With `--wait`, and in `arcli backup status`, a restore on Arc 27.01.1+ reports more than files and bytes (next arcli release):

```text
$ arcli backup restore backup-20261110-120000-abcdef12 --mode replace --wait --yes
Restore of backup-20261110-120000-abcdef12 started; waiting...
compaction pause: waiting
compaction pause: paused
compaction pause: released
Restore of backup-20261110-120000-abcdef12 completed: 40 files, 12.3 KiB written (mode: replace)
restore:    40 files registered, 0 registration failures, 0 sidecar mismatches, 6 files replaced
```

- **mode**: the mode Arc is running, printed when it is `replace`.
- **restore**: data files written and registered in the cluster manifest; files written but not registered because the manifest refused a batch (the restore stops there and fails; nothing re-registers them, so run the restore again); backup files not written because their bytes do not match the backup's sidecar (the live copy stays and the restore fails); and the current manifest entries a replace removed before writing. `registration-failed:` and `sidecar-mismatch:` lines name up to 32 of the files.
- **compaction pause**, on a cluster: `waiting` while every node quiesces, `paused` while the restore runs under the pause, `released` once it is resumed, and `lost` when the pause stopped being this restore's mid-run. A `lost` pause fails the restore and arcli prints a warning: inspect the restore error and the server log, then take a fresh backup and restore again. `--wait` prints each state change it observes; polling can miss a short-lived state. `arcli cluster status` shows the [pause lease](/arcli/commands/cluster/#compaction-pause).
- **backup had** / **backup info**: what the restored backup already lacked when it was taken, and how many files were not listed in the cluster manifest at that time.

| Flag | Description | Default |
|---|---|---|
| `--data-only` | restore data files only (skip metadata and config) |  |
| `--mode` `string` | restore mode: merge\|replace (default: the server's) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--wait` | poll until the restore has finished |  |
| `--wait-timeout` `duration` | give up waiting after this long (with --wait) | `2h0m0s` |
| `--with-config` | also restore the server config file (staged) |  |
| `--with-metadata` | also restore the metadata store (staged; unavailable on clusters) |  |
| `-y`, `--yes` | skip the confirmation prompt |  |

## delete

Removes the backup from the server's backup storage. Prompts unless `--yes`. On an Arc 27.01.1+ cluster only the primary writer can delete a backup; any other node answers HTTP 503 after the prompt, and nothing is deleted.

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags).
