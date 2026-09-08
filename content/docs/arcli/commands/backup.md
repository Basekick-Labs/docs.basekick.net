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

`list` is newest first and shows what the manifest says; it cannot tell an interrupted backup from a complete one, so `show` the one you plan to restore: it reports skipped files. `status` shows the last operation (or `idle`) with files and bytes done, and is what `--wait` polls.

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
