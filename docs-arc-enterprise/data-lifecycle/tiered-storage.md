---
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tiered Storage

Reduce storage costs by 60-80% with automatic hot/cold data tiering. Recent data stays on fast local storage while older data moves to cost-efficient archive storage.

## Overview

Arc Enterprise implements a 2-tier storage model:

```
┌─────────────────────────────────────────────────────────────┐
│                    Arc Tiered Storage                        │
│                                                              │
│  HOT TIER (Local / Primary Storage Backend)                 │
│  ├── Recent data (configurable, default: 30 days)           │
│  ├── Optimized for low-latency queries                      │
│  └── Cost: $$$                                               │
│                                                              │
│           │ Automatic migration (age-based)                  │
│           ▼                                                  │
│                                                              │
│  COLD TIER (S3 Glacier / Azure Archive)                     │
│  ├── Historical data (30+ days)                             │
│  ├── Optimized for cost efficiency                          │
│  └── Cost: $                                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**

- **Age-based migration** — Data older than a configurable threshold automatically moves to the cold tier
- **Per-database policies** — Override global defaults for specific databases
- **Hot-only databases** — Exclude specific databases from tiering entirely
- **Scheduled migrations** — Cron-based scheduler runs migrations automatically
- **Manual migrations** — Trigger migrations on-demand via API
- **Zero recompression** — Files move as-is with no re-encoding overhead
- **Transparent queries** — Queries automatically span both tiers

## Configuration

### Global Settings

```toml
[tiered_storage]
enabled = true
migration_schedule = "0 2 * * *"     # Cron: run at 2am daily
migration_max_concurrent = 4          # Parallel file transfers
migration_batch_size = 100            # Files per migration batch
default_hot_max_age_days = 30         # Data older than this moves to cold
```

### Cold Tier Backend

<Tabs>
  <TabItem value="s3" label="AWS S3 / MinIO" default>

```toml
[tiered_storage.cold]
enabled = true
backend = "s3"
s3_bucket = "arc-archive"
s3_region = "us-east-1"
# s3_access_key = ""          # Use env: ARC_TIERED_STORAGE_COLD_S3_ACCESS_KEY
# s3_secret_key = ""          # Use env: ARC_TIERED_STORAGE_COLD_S3_SECRET_KEY
s3_use_ssl = true
s3_path_style = false
s3_storage_class = "GLACIER"  # GLACIER, DEEP_ARCHIVE, GLACIER_IR, STANDARD_IA
retrieval_mode = "standard"   # standard, expedited, bulk
```

**Storage classes:**

| Class | Use Case | Retrieval Time |
|-------|----------|----------------|
| `STANDARD_IA` | Infrequent access, immediate retrieval | Milliseconds |
| `GLACIER_IR` | Archive with instant retrieval | Milliseconds |
| `GLACIER` | Long-term archive (default) | Minutes to hours |
| `DEEP_ARCHIVE` | Lowest cost, rare access | Up to 12 hours |

  </TabItem>
  <TabItem value="azure" label="Azure Blob Storage">

```toml
[tiered_storage.cold]
enabled = true
backend = "azure"
azure_container = "arc-archive"
azure_account_name = "your_account"
# azure_account_key = ""      # Use env: ARC_TIERED_STORAGE_COLD_AZURE_ACCOUNT_KEY
# Or use managed identity:
# azure_use_managed_identity = true
```

  </TabItem>
</Tabs>

### Environment Variables

```bash
# Global tiering settings
ARC_TIERED_STORAGE_ENABLED=true
ARC_TIERED_STORAGE_MIGRATION_SCHEDULE="0 2 * * *"
ARC_TIERED_STORAGE_MIGRATION_MAX_CONCURRENT=4
ARC_TIERED_STORAGE_MIGRATION_BATCH_SIZE=100
ARC_TIERED_STORAGE_DEFAULT_HOT_MAX_AGE_DAYS=30

# Cold tier (S3)
ARC_TIERED_STORAGE_COLD_ENABLED=true
ARC_TIERED_STORAGE_COLD_BACKEND=s3
ARC_TIERED_STORAGE_COLD_S3_BUCKET=arc-archive
ARC_TIERED_STORAGE_COLD_S3_REGION=us-east-1
ARC_TIERED_STORAGE_COLD_S3_ACCESS_KEY=your_key
ARC_TIERED_STORAGE_COLD_S3_SECRET_KEY=your_secret
ARC_TIERED_STORAGE_COLD_S3_USE_SSL=true
ARC_TIERED_STORAGE_COLD_S3_STORAGE_CLASS=GLACIER
ARC_TIERED_STORAGE_COLD_RETRIEVAL_MODE=standard

# Cold tier (Azure)
ARC_TIERED_STORAGE_COLD_BACKEND=azure
ARC_TIERED_STORAGE_COLD_AZURE_CONTAINER=arc-archive
ARC_TIERED_STORAGE_COLD_AZURE_ACCOUNT_NAME=your_account
ARC_TIERED_STORAGE_COLD_AZURE_ACCOUNT_KEY=your_key
```

:::tip Use Environment Variables for Secrets
Store access keys and secret keys in environment variables rather than in `arc.toml`. This keeps secrets out of version control.
:::

## Per-Database Policies

Override the global `default_hot_max_age_days` for specific databases, or exclude databases from tiering entirely.

### Create Policy

```bash
curl -X POST http://localhost:8000/api/v1/tiering/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "database": "telemetry",
    "hot_max_age_days": 7
  }'
```

### Create Hot-Only Policy

Exclude a database from tiering:

```bash
curl -X POST http://localhost:8000/api/v1/tiering/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "database": "realtime",
    "hot_only": true
  }'
```

### List Policies

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/tiering/policies
```

### Get Policy

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/tiering/policies/telemetry
```

### Update Policy

```bash
curl -X PUT http://localhost:8000/api/v1/tiering/policies/telemetry \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hot_max_age_days": 14}'
```

### Delete Policy

```bash
curl -X DELETE http://localhost:8000/api/v1/tiering/policies/telemetry \
  -H "Authorization: Bearer $TOKEN"
```

## API Reference

All tiering endpoints require admin authentication.

### Get Tiering Status

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/tiering/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "cold_backend": "s3",
    "default_hot_max_age_days": 30,
    "migration_schedule": "0 2 * * *",
    "last_migration": "2026-02-13T02:00:00Z"
  }
}
```

### List Files by Tier

```bash
# All files
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/tiering/files

# Filter by tier
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/tiering/files?tier=cold"

# Filter by database
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/tiering/files?database=telemetry&limit=50"
```

### Trigger Manual Migration

```bash
curl -X POST http://localhost:8000/api/v1/tiering/migrate \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Migration started",
    "files_eligible": 42
  }
}
```

### Get Migration Statistics

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/tiering/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total_files_migrated": 1250,
    "total_bytes_migrated": 53687091200,
    "hot_files": 340,
    "cold_files": 1250,
    "last_migration_duration_ms": 45000,
    "last_migration_files": 42
  }
}
```

## Best Practices

1. **Start with 30-day hot retention** — This is a good default for most workloads. Monitor query patterns and adjust based on how often historical data is accessed.

2. **Use GLACIER for long-term archive** — It offers the best cost-to-retrieval tradeoff. Use `STANDARD_IA` if you need frequent access to cold data.

3. **Schedule migrations during off-peak hours** — The default `0 2 * * *` (2am daily) works well for most deployments.

4. **Use per-database policies for different retention needs** — Real-time dashboards may need 7-day hot data, while compliance databases may need 90 days.

5. **Mark real-time databases as hot-only** — Databases used exclusively for real-time dashboards should skip tiering to avoid any retrieval latency.

6. **Use IAM roles or managed identity** — For cloud deployments, use IAM roles (AWS) or managed identity (Azure) instead of access keys.

## Next Steps

- [Audit Logging](/arc-enterprise/audit-logging) — Track tiering operations for compliance
- [Automated Scheduling](/arc-enterprise/automated-scheduling) — Combine tiering with scheduled retention policies
