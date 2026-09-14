---
title: "Backup & Restore"
description: "Back up Arc's Parquet data, SQLite metadata, and arc.toml through the REST API, track async job progress, and restore selectively from an existing backup."
---

Arc includes a full backup and restore system via REST API. Backups capture parquet data files, SQLite metadata (auth, audit, MQTT config), and the `arc.toml` configuration file -- with async operations, real-time progress tracking, and selective restore.

<Callout type="info" title="Available since v26.03.1">
Backup & Restore is available starting Arc v26.03.1 (March 2026).
</Callout>

<Callout type="warn" title="Admin Required">
All backup and restore endpoints require admin authentication.
</Callout>

## Configuration

```toml
[backup]
enabled = true                  # default: true
local_path = "./data/backups"   # default: ./data/backups
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/backup` | Trigger a full backup (async) |
| `GET` | `/api/v1/backup` | List all available backups |
| `GET` | `/api/v1/backup/status` | Progress of active operation |
| `GET` | `/api/v1/backup/:id` | Get backup manifest |
| `DELETE` | `/api/v1/backup/:id` | Delete a backup |
| `POST` | `/api/v1/backup/restore` | Restore from a backup (async) |

## Creating a backup

```bash
curl -X POST "http://localhost:8000/api/v1/backup" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

**Response (202 Accepted):**
```json
{
  "message": "Backup started",
  "status": "running"
}
```

The backup runs asynchronously in the background. Poll the status endpoint to monitor progress.

### Polling progress

```bash
curl "http://localhost:8000/api/v1/backup/status" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

```json
{
  "operation": "backup",
  "backup_id": "backup-20260211-143022-a1b2c3d4",
  "status": "running",
  "total_files": 1200,
  "processed_files": 450,
  "total_bytes": 5368709120,
  "processed_bytes": 2147483648
}
```

## Listing backups

```bash
curl "http://localhost:8000/api/v1/backup" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Viewing a backup manifest

```bash
curl "http://localhost:8000/api/v1/backup/backup-20260211-143022-a1b2c3d4" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### Backup structure

```text
{backup_id}/
  manifest.json        # metadata: databases, measurements, file counts, sizes
  data/                # parquet files preserving partition layout
  metadata/arc.db      # SQLite database snapshot
  config/arc.toml      # configuration file
```

## Restoring from a backup

<Callout type="warn" title="Destructive Operation">
Restore overwrites existing data. Existing SQLite and config files are preserved with a `.before-restore` suffix before overwriting.
</Callout>

```bash
curl -X POST "http://localhost:8000/api/v1/backup/restore" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_id": "backup-20260211-143022-a1b2c3d4",
    "restore_data": true,
    "restore_metadata": true,
    "restore_config": false,
    "confirm": true
  }'
```

### Restore options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backup_id` | string | *(required)* | ID of the backup to restore |
| `restore_data` | bool | `true` | Restore parquet data files |
| `restore_metadata` | bool | `true` | Restore SQLite database (auth, audit, MQTT) |
| `restore_config` | bool | `false` | Restore `arc.toml` configuration |
| `confirm` | bool | *(required)* | Must be `true` to proceed |

### Selective restore examples

```bash
# Restore only data (keep current auth tokens and config)
curl -X POST "http://localhost:8000/api/v1/backup/restore" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_id": "backup-20260211-143022-a1b2c3d4",
    "restore_data": true,
    "restore_metadata": false,
    "restore_config": false,
    "confirm": true
  }'

# Restore everything including config
curl -X POST "http://localhost:8000/api/v1/backup/restore" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_id": "backup-20260211-143022-a1b2c3d4",
    "restore_data": true,
    "restore_metadata": true,
    "restore_config": true,
    "confirm": true
  }'
```

### Incomplete restores

A restore that could not restore every data file ends with `status: failed`,
even though every file it could read was written and stays in place. The status
endpoint says what is absent:

```json
{
  "operation": "restore",
  "backup_id": "backup-20260913-175728-541f0e8c",
  "status": "failed",
  "total_files": 3,
  "processed_files": 2,
  "skipped_files": 1,
  "skipped_sample": [
    "backup-20260913-175728-541f0e8c/data/smoke/cpu/2026/09/13/16/cpu_20260913_175727_441274000.parquet"
  ],
  "error": "restore incomplete: 1 data files could not be read from backup storage and 0 files the backup inventoried were missing from it; the files that could be restored are in place, see skipped_sample"
}
```

| Field | Meaning |
|-------|---------|
| `skipped_files` | Backup objects that could not be read. Up to 32 of their paths are listed in `skipped_sample`. |
| `unaddressable_files` | Data files present in backup storage under names its listing cannot return, such as a dot-prefixed key an object store handed back at backup time. Up to 32 are listed in `unaddressable_sample`; rename them in the backup and re-run to recover them. |
| `missing_files` | Data files the backup's manifest inventoried that are neither listed nor unaddressable in backup storage: they are gone, for example after a partial sync or a deleted object. |
| `backup_skipped_files`, `backup_unaddressable_files` | Files the backup itself lacked when it was taken (see its manifest). Reported so a gap that predates the restore is not mistaken for one it caused; they do not fail the restore. |

There is no tolerated fraction: any skipped, unaddressable, or missing file fails the restore.
A write into data storage that fails (a full or read-only volume) aborts the
restore immediately rather than being skipped. Treat `failed` as final and read
the counts; re-running against the same backup reproduces the same gap until
the backup is repaired.

## Deleting a backup

```bash
curl -X DELETE "http://localhost:8000/api/v1/backup/backup-20260211-143022-a1b2c3d4" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

Deletion is refused with `409 Conflict` while a backup or restore is running -- deleting the backup a restore is reading would tear files out from under it. Retry once the operation finishes.

## Key behaviors

- **Async operations** -- backup and restore run in background goroutines with a 2-hour timeout. Clients poll `/status` for progress.
- **Serialized operations** -- only one backup, restore, or delete can run at a time. Attempting a concurrent operation returns `409 Conflict`.
- **Pre-restore safety** -- existing SQLite and config files are copied with `.before-restore` suffix before overwriting.
- **Destructive restore protection** -- restore requires explicit `confirm: true` in the request body.
- **Incomplete restores fail** -- a restore that could not restore every data file ends `failed`, with `skipped_files` and `missing_files` on the status endpoint; the files that could be restored stay in place.
- **What gets backed up** -- parquet data files, SQLite database (with WAL checkpoint for consistency), and `arc.toml` config.
- **All storage backends** -- works with local filesystem, S3, and Azure Blob Storage.

## Error responses

| Status | Description |
|--------|-------------|
| `401` | Authentication required |
| `403` | Admin role required |
| `404` | Backup not found |
| `409` | Another operation is already running (returned by backup, restore, and delete) |
| `500` | Backup or restore execution error |
