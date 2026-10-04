---
title: "arcli backup"
description: "Server-side Arc backups from arcli: backup create, list, show, status, restore and delete, the backup.local_path target, --wait polling, the single operation slot, and what a restore overwrites."
---

Arc writes backups to the directory in `backup.local_path` on the server itself (there is no remote target and no incremental mode; `backup.enabled = false` turns the feature off). `arcli backup` drives that over `/api/v1/backup`. Every subcommand needs an **admin** token.

## Quick reference

```bash
arcli backup create --wait
arcli backup list
arcli backup show backup-20260908-000537-3969cf1d
arcli backup status
arcli backup restore backup-20260908-000537-3969cf1d --wait
arcli backup delete backup-20260908-000537-3969cf1d
```

## create

```text
$ arcli backup create --wait
Backup backup-20260908-000537-3969cf1d started; waiting...
Backup backup-20260908-000537-3969cf1d completed: 2 files, 1.7 KiB
```

The server accepts the request and returns immediately; arcli prints the id at once and, with `--wait`, polls `status` until the operation finishes (progress to stderr, `--wait-timeout` default 2h). Ids are `backup-YYYYMMDD-HHMMSS-<8 hex>`. A backup includes the data files plus the metadata database and the server config file; `--no-metadata` and `--no-config` leave those out. Create, restore and delete share one slot on the server: a second operation while one runs is refused.

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

`list` is newest first. `INCOMPLETE` says what the backup lacks, as the server counts it (Arc 26.09.3+), with the three counts kept apart because they are different populations: **skipped** data files were inventoried (they are in `FILES`) but not stored; **metadata** files (Iceberg metadata, compaction recovery state, not in `FILES`) were skipped; **unaddressable** files have a key no listing can return, so they were never inventoried. `-` means none reported, which is a complete backup or an Arc older than 26.09.3. With `-o csv`, three columns follow `total_size_bytes`: `skipped_files`, `skipped_metadata_files`, `unaddressable_files`.

`show` names the files. For an incomplete backup its `INCOMPLETE` line gives the counts in words, including how many files were skipped for a key too long to store, and is followed by one `skipped:` line per file the manifest names (up to 32) and one `unaddressable:` line per file in that sample:

```text
contents:    21 files, 2.0 KiB, metadata true, config false
INCOMPLETE:  3 of 21 files and 1 metadata file were skipped while backing up (1 for a key too long to store); 2 files could not be listed (unaddressable)
  skipped:       mydb/cpu/2026/09/17/00/a.parquet
  skipped:       mydb/cpu/2026/09/17/00/b.parquet
  unaddressable: mydb/cpu/2026/09/17/00/.hidden.parquet
```

`status` shows the last operation (or `idle`) with files and bytes done, and is what `--wait` polls. It lists the skipped files the server names, reports files a backup could not list (their names are in the manifest once the backup has completed, otherwise in the server log), and, for a restore, says what the restored backup already lacked when it was taken and how many Iceberg warehouse files were not restored because the node has no outside-root warehouse.

## restore

```text
$ arcli backup restore backup-20260908-003222-1f611f94 --wait --yes
Restore of backup-20260908-003222-1f611f94 started; waiting...
Restore of backup-20260908-003222-1f611f94 completed: 4 files, 3.7 KiB written
Metadata/config are staged in the server's metadata directory (.pending-restore) and applied at the next server start; data files are already overwritten. Restart the server to complete the restore.
```

Data files from the backup are written over the server's storage **unconditionally**; files at the same paths are replaced. Run it on a quiescent server: stop writers and compaction first. Metadata is staged and applied on the next server start; `--data-only` skips it, `--with-config` also restores the config file. arcli prompts unless `--yes`. In a cluster the manifest of the other nodes is not updated by a restore.

| Flag | Description | Default |
|---|---|---|
| `--data-only` | restore data files only (skip metadata and config) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--wait` | poll until the restore has finished |  |
| `--wait-timeout` `duration` | give up waiting after this long (with --wait) | `2h0m0s` |
| `--with-config` | also restore the server config file (staged) |  |
| `-y`, `--yes` | skip the confirmation prompt |  |

## delete

Removes the backup directory on the server. Prompts unless `--yes`.

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags).
