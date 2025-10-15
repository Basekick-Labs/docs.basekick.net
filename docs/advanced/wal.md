---
sidebar_position: 1
---

# Write-Ahead Log (WAL)

Arc's Write-Ahead Log (WAL) provides **zero data loss guarantees** on system crashes.

:::note Important Clarification
There are **two different WAL features** in Arc:

1. **SQLite WAL mode** (always enabled) - Internal mode for Arc's metadata database (`arc.db`). This enables concurrent access to connection settings, export jobs, and compaction locks. You'll see the log message `"SQLite WAL mode enabled for concurrent access"` on startup - this is expected and not related to data ingestion.

2. **Arc's WAL feature** (disabled by default) - Optional durability feature for **data ingestion** that provides zero data loss guarantees. This page documents the Arc WAL feature, controlled by the `WAL_ENABLED` environment variable.

**TL;DR**: The startup log `"SQLite WAL mode enabled"` is normal and does NOT mean Arc's data ingestion WAL is enabled.
:::

## Overview

WAL is an optional durability feature that persists all incoming data to disk **before** acknowledging writes. When enabled, Arc guarantees that data can be recovered even if the instance crashes.

:::info
WAL is **disabled by default** to maximize throughput (2.42M records/sec). Enable it when zero data loss is required.
:::

### When to Enable WAL

Enable WAL if you need:
- **Zero data loss** on system crashes
- **Guaranteed durability** for regulatory compliance (finance, healthcare)
- **Recovery from unexpected failures** (power loss, OOM kills)

Keep WAL disabled if you:
- **Prioritize maximum throughput** (2.42M records/sec)
- **Can tolerate 0-5 seconds data loss** on rare crashes
- **Have client-side retry logic** or message queue upstream

### Performance vs Durability Tradeoff

| Configuration | Throughput | Data Loss Risk |
|--------------|-----------|----------------|
| **No WAL (default)** | 2.42M rec/s | 0-5 seconds |
| **WAL + async** | 1.67M rec/s (-17%) | &lt;1 second |
| **WAL + fdatasync** | 1.63M rec/s (-19%) | Near-zero |
| **WAL + fsync** | 1.67M rec/s (-17%) | Zero |

**Tradeoff**: 19% throughput reduction for near-zero data loss (fdatasync mode)

## Architecture

### Data Flow with WAL

```
┌──────────────────────────────────────────────────────────┐
│  HTTP Request (MessagePack or Line Protocol)             │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  1. WAL.append(records)                                  │
│     - Serialize to MessagePack binary                    │
│     - Calculate CRC32 checksum                           │
│     - Write to disk                                      │
│     - fdatasync() ← Force physical disk sync             │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼ Data is DURABLE (on disk)
┌──────────────────────────────────────────────────────────┐
│  2. HTTP 202 Accepted ← Response to client               │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  3. Buffer.write(records)                                │
│     - Add to in-memory buffer                            │
│     - Flush when 50K records or 5 seconds               │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  4. Parquet Writer                                       │
│     - Convert to Arrow columnar format                   │
│     - Write Parquet file                                 │
│     - Upload to S3/MinIO                                 │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  5. WAL.mark_completed() ← Can now delete WAL entry      │
└──────────────────────────────────────────────────────────┘
```

:::tip Key Insight
Once WAL confirms the write (step 1), the data is **guaranteed durable** even if Arc crashes before step 4 completes.
:::

### Per-Worker WAL Files

Arc uses multiple worker processes. Each worker has its own WAL file to avoid lock contention:

```
./data/wal/
├── worker-1-20251008_140530.wal
├── worker-2-20251008_140530.wal
├── worker-3-20251008_140530.wal
└── worker-4-20251008_140530.wal
```

**Benefits:**
- Zero lock contention (parallel writes)
- Simple implementation
- Natural partitioning
- Parallel recovery on startup

## Configuration

### Enable WAL

Edit `arc.conf`:

```toml
[wal]
enabled = true
sync_mode = "fdatasync"    # Recommended for production
dir = "./data/wal"
max_size_mb = 100          # Rotate at 100MB
max_age_seconds = 3600     # Rotate after 1 hour
```

Or via environment variables:

```bash
WAL_ENABLED=true
WAL_DIR=./data/wal
WAL_SYNC_MODE=fdatasync
WAL_MAX_SIZE_MB=100
WAL_MAX_AGE_SECONDS=3600
```

### Sync Modes

Arc supports three sync modes with different durability/performance tradeoffs:

#### fdatasync (Recommended)

```toml
[wal]
sync_mode = "fdatasync"
```

**How it works:**
- Syncs data to disk (file contents)
- Skips metadata sync (file size, modified time)
- 50% faster than `fsync`, nearly same durability

**Guarantees:**
- Data is on physical disk
- Can recover all data on crash
- File metadata may be stale (not critical)

**Use case**: Production deployments (recommended)

#### fsync (Maximum Safety)

```toml
[wal]
sync_mode = "fsync"
```

**How it works:**
- Syncs both data AND metadata to disk
- Slowest, but absolute guarantee

**Use when:**
- Regulatory compliance requires it
- Zero tolerance for any data loss
- Performance is secondary

#### async (Performance-First)

```toml
[wal]
sync_mode = "async"
```

**How it works:**
- Writes to OS buffer cache
- No explicit sync (OS flushes periodically)
- Very fast, but small risk window

**Use when:**
- Need 90% of original throughput
- Can tolerate ~1 second data loss
- Have upstream retry mechanisms

### Rotation Settings

Control when WAL files rotate:

```toml
[wal]
max_size_mb = 100           # Rotate when file reaches 100MB
max_age_seconds = 3600      # Rotate after 1 hour (even if file is small)
```

**Why rotation matters:**
- Prevents unbounded growth
- Faster recovery (smaller files)
- Automatic cleanup of old WALs

## Operations

### Recovery on Startup

Arc automatically recovers from WAL files on startup:

```
2025-10-08 14:30:00 [INFO] WAL recovery started: 4 files
2025-10-08 14:30:01 [INFO] Recovering WAL: worker-1-20251008_143000.wal
2025-10-08 14:30:01 [INFO] WAL read complete: 1000 entries, 5242880 bytes, 0 corrupted
2025-10-08 14:30:02 [INFO] Recovering WAL: worker-2-20251008_143000.wal
...
2025-10-08 14:30:05 [INFO] WAL recovery complete: 4000 batches, 200000 entries, 0 corrupted
2025-10-08 14:30:05 [INFO] WAL archived: worker-1-20251008_143000.wal.recovered
```

**Process:**
1. Find all `*.wal` files in `WAL_DIR`
2. Read and validate each entry (checksum verification)
3. Replay records into buffer system
4. Archive recovered WAL as `*.wal.recovered`
5. Continue normal operations

**Recovery time:**
- ~5 seconds per 100MB WAL file
- Parallel recovery across workers
- Corrupted entries are skipped (logged)

## Monitoring

### WAL Status

```bash
curl http://localhost:8000/api/wal/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "enabled": true,
  "configuration": {
    "sync_mode": "fdatasync",
    "worker_id": 1,
    "current_file": "./data/wal/worker-1-20251008_143000.wal"
  },
  "stats": {
    "current_size_mb": 45.2,
    "current_age_seconds": 1850,
    "total_entries": 5000,
    "total_bytes": 47382528,
    "total_syncs": 5000,
    "total_rotations": 2
  }
}
```

### WAL Files

```bash
curl http://localhost:8000/api/wal/files \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "active": [
    {
      "name": "worker-1-20251008_143000.wal",
      "size_mb": 45.2,
      "modified": 1696775400
    }
  ],
  "recovered": [
    {
      "name": "worker-1-20251008_120000.wal.recovered",
      "size_mb": 98.5,
      "modified": 1696768800
    }
  ],
  "total_size_mb": 143.7
}
```

### Health Check

```bash
curl http://localhost:8000/api/wal/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Cleanup Old WAL Files

```bash
# Cleanup files older than 24 hours (default)
curl -X POST http://localhost:8000/api/wal/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN"

# Custom age (in hours)
curl -X POST "http://localhost:8000/api/wal/cleanup?max_age_hours=48" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### WAL Recovery Taking Too Long

**Symptoms:**
```
2025-10-08 14:30:00 [INFO] WAL recovery started: 50 files
... (minutes pass) ...
```

**Solutions:**

1. **Adjust rotation settings:**
   ```toml
   [wal]
   max_size_mb = 50          # Smaller files, faster recovery
   max_age_seconds = 1800    # Rotate more frequently
   ```

2. **Use faster disks for WAL:**
   ```toml
   [wal]
   dir = "/mnt/nvme/arc-wal"   # NVMe SSD
   ```

3. **Increase worker count:**
   ```toml
   [server]
   workers = 16  # More workers = parallel recovery
   ```

### WAL Disk Space Growing

**Symptoms:**
```bash
$ du -sh ./data/wal
5.2G    ./data/wal
```

**Solutions:**

1. **Manual cleanup:**
   ```bash
   rm -f ./data/wal/*.wal.recovered
   ```

2. **Reduce retention:**
   ```toml
   [wal]
   max_size_mb = 50          # Rotate sooner
   max_age_seconds = 1800    # 30 minutes
   ```

3. **Add cron job for cleanup:**
   ```bash
   # Cleanup recovered WALs older than 24 hours
   0 2 * * * find /path/to/data/wal -name "*.wal.recovered" -mtime +1 -delete
   ```

### WAL Write Failures

**Symptoms:**
```
2025-10-08 14:30:00 [ERROR] WAL append failed: [Errno 28] No space left on device
```

**Solutions:**

1. **Check disk space:**
   ```bash
   df -h /path/to/WAL_DIR
   ```

2. **Check permissions:**
   ```bash
   ls -ld ./data/wal
   chmod 755 ./data/wal
   ```

3. **Move WAL to larger disk:**
   ```toml
   [wal]
   dir = "/mnt/large-disk/arc-wal"
   ```

### Performance Degradation with WAL

**Symptoms:**
- Throughput dropped from 2.42M to 600K rec/s
- High CPU usage from fsync calls

**Solutions:**

1. **Verify sync mode:**
   ```toml
   [wal]
   sync_mode = "fdatasync"  # Should be fdatasync, not fsync
   ```

2. **Check disk I/O wait:**
   ```bash
   iostat -x 1
   # Look for %iowait > 50%
   ```

3. **Move WAL to faster disk:**
   ```toml
   [wal]
   dir = "/mnt/nvme/arc-wal"
   ```

4. **Consider disabling WAL if durability isn't critical:**
   ```toml
   [wal]
   enabled = false
   ```

## Best Practices

### Production Deployment

**Recommended configuration:**

```toml
[wal]
enabled = true
sync_mode = "fdatasync"
dir = "/mnt/fast-ssd/arc-wal"
max_size_mb = 100
max_age_seconds = 3600
```

**Monitoring setup:**
1. Monitor WAL disk usage
2. Alert on write failures
3. Track recovery time during restarts
4. Log rotation metrics

**Backup strategy:**
- WAL files are ephemeral (deleted after recovery)
- Don't backup WAL files directly
- Backup final Parquet files in S3/MinIO instead

### Development/Testing

**Recommended configuration:**

```toml
[wal]
enabled = false  # WAL disabled for maximum speed
```

**Or if testing WAL:**

```toml
[wal]
enabled = true
sync_mode = "async"
max_size_mb = 10  # Small files for testing
```

## Summary

**Enable WAL if:**
- Zero data loss is required
- Regulated industry (finance, healthcare)
- Can accept 19% throughput reduction

**Disable WAL if:**
- Maximum throughput is priority
- Can tolerate 0-5s data loss risk
- Have upstream retry/queue mechanisms

**Recommended settings:**
```toml
[wal]
enabled = true
sync_mode = "fdatasync"     # Best balance
dir = "/mnt/nvme/arc-wal"   # Fast disk
```

## Next Steps

- **[Configure Compaction](/arc/advanced/compaction)** - Optimize query performance
- **[Monitor Arc](/arc/operations/monitoring)** - Set up health checks
- **[Performance Tuning](/arc/configuration/performance)** - Maximize throughput
