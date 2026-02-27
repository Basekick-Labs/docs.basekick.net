---
sidebar_position: 2
---

# Backup & Restore

Arc includes a full backup and restore system via REST API. Backups capture parquet data files, SQLite metadata (auth, audit, MQTT config), and the `arc.toml` configuration file -- with async operations, real-time progress tracking, and selective restore.

:::info Available since v26.03.1
Backup & Restore is available starting Arc v26.03.1 (March 2026).
:::

:::caution Admin Required
All backup and restore endpoints require admin authentication.
:::

## Configuration

```toml
[backup]
enabled = true                  # default: true
local_path = "./data/backups"   # default: ./data/backups
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/backup` | Trigger a full backup (async) |
| `GET` | `/api/v1/backup` | List all available backups |
| `GET` | `/api/v1/backup/status` | Progress of active operation |
| `GET` | `/api/v1/backup/:id` | Get backup manifest |
| `DELETE` | `/api/v1/backup/:id` | Delete a backup |
| `POST` | `/api/v1/backup/restore` | Restore from a backup (async) |

## Creating a Backup

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

### Polling Progress

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

## Listing Backups

```bash
curl "http://localhost:8000/api/v1/backup" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Viewing a Backup Manifest

```bash
curl "http://localhost:8000/api/v1/backup/backup-20260211-143022-a1b2c3d4" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### Backup Structure

```
{backup_id}/
  manifest.json        # metadata: databases, measurements, file counts, sizes
  data/                # parquet files preserving partition layout
  metadata/arc.db      # SQLite database snapshot
  config/arc.toml      # configuration file
```

## Restoring from a Backup

:::warning Destructive Operation
Restore overwrites existing data. Existing SQLite and config files are preserved with a `.before-restore` suffix before overwriting.
:::

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

### Restore Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backup_id` | string | *(required)* | ID of the backup to restore |
| `restore_data` | bool | `true` | Restore parquet data files |
| `restore_metadata` | bool | `true` | Restore SQLite database (auth, audit, MQTT) |
| `restore_config` | bool | `false` | Restore `arc.toml` configuration |
| `confirm` | bool | *(required)* | Must be `true` to proceed |

### Selective Restore Examples

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

## Deleting a Backup

```bash
curl -X DELETE "http://localhost:8000/api/v1/backup/backup-20260211-143022-a1b2c3d4" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Key Behaviors

- **Async operations** -- backup and restore run in background goroutines with a 2-hour timeout. Clients poll `/status` for progress.
- **Serialized operations** -- only one backup or restore can run at a time. Attempting a second operation returns `409 Conflict`.
- **Pre-restore safety** -- existing SQLite and config files are copied with `.before-restore` suffix before overwriting.
- **Destructive restore protection** -- restore requires explicit `confirm: true` in the request body.
- **What gets backed up** -- parquet data files, SQLite database (with WAL checkpoint for consistency), and `arc.toml` config.
- **All storage backends** -- works with local filesystem, S3, and Azure Blob Storage.

## Error Responses

| Status | Description |
|--------|-------------|
| `401` | Authentication required |
| `403` | Admin role required |
| `404` | Backup not found |
| `409` | Another backup/restore operation is already running |
| `500` | Backup or restore execution error |
