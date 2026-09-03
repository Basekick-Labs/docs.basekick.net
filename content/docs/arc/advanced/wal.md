---
title: "Write-Ahead Log (WAL)"
description: "How Arc's optional ingestion WAL persists writes before acknowledging them, the sync modes and segment limits available, and how recovery replays segments on restart."
---

<!-- TODO(diagram): the WAL write path as a real diagram — request -> WAL append -> fsync mode -> ack -> buffer -> Parquet flush — showing exactly where the acknowledgement happens under each sync mode. That boundary is what bounds data loss, and it is the page's core idea. -->

Arc's Write-Ahead Log (WAL) provides **zero data loss guarantees** on system crashes.

<Callout type="info" title="Important Clarification">
There are **two different WAL features** in Arc:

1. **SQLite WAL mode** (always enabled) - Internal mode for Arc's metadata database (`arc.db`). This enables concurrent access to connection settings, export jobs, and compaction locks. You'll see the log message `"SQLite WAL mode enabled for concurrent access"` on startup - this is expected and not related to data ingestion.

2. **Arc's WAL feature** (disabled by default) - Optional durability feature for **data ingestion** that provides zero data loss guarantees. This page documents the Arc WAL feature, controlled by the `WAL_ENABLED` environment variable.

**TL;DR**: The startup log `"SQLite WAL mode enabled"` is normal and does NOT mean Arc's data ingestion WAL is enabled.
</Callout>

## Overview

WAL is an optional durability feature that persists all incoming data to disk **before** acknowledging writes. When enabled, Arc guarantees that data can be recovered even if the instance crashes.

<Callout type="info">
WAL is **disabled by default** to maximize throughput. Enable it when zero data loss is required.
</Callout>

### When to enable WAL

Enable WAL if you need:
- **Zero data loss** on system crashes
- **Guaranteed durability** for regulatory compliance (finance, healthcare)
- **Recovery from unexpected failures** (power loss, OOM kills)

Keep WAL disabled if you:
- **Prioritize maximum throughput**
- **Can tolerate 0-5 seconds data loss** on rare crashes
- **Have client-side retry logic** or message queue upstream

### Performance vs durability tradeoff

| Configuration | Throughput | Data Loss Risk |
|--------------|-----------|----------------|
| **No WAL (default)** | Highest | 0-5 seconds |
| **WAL enabled** | Somewhat lower | &lt;1 second (async) / near-zero (fdatasync, fsync) |

**Tradeoff**: a modest throughput reduction for near-zero data loss.

The cost is in enabling the WAL at all, not in the sync mode. Syncs are batched
on a 100 ms ticker rather than performed per write, so all three modes land
within measurement noise of each other on throughput — earlier figures showing
`fdatasync` as *slower* than `fsync` reflected exactly that noise. Choose the
sync mode for the durability semantics you need, not for speed.

## Architecture

### Data flow with WAL

```text
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

<Callout type="idea" title="Key Insight">
Once WAL confirms the write (step 1), the data is **guaranteed durable** even if Arc crashes before step 4 completes.
</Callout>

### WAL files

Arc uses a single WAL writer with goroutines for concurrent access:

```text
./data/wal/
├── arc-20251008_140530.wal
└── arc-20251008_150530.wal
```

**Benefits:**
- Simple implementation
- Automatic rotation
- Parallel recovery on startup

## Configuration

### Enable WAL

Edit `arc.toml`:

```toml
[wal]
enabled = true
sync_mode = "fdatasync"    # Recommended for production
directory = "./data/wal"
max_size_mb = 500          # Rotate at 500MB
max_age_seconds = 3600     # Rotate after 1 hour
```

Or via environment variables:

```ini
ARC_WAL_ENABLED=true
ARC_WAL_DIRECTORY=./data/wal
ARC_WAL_SYNC_MODE=fdatasync
ARC_WAL_MAX_SIZE_MB=500
ARC_WAL_MAX_AGE_SECONDS=3600
```

### Sync modes

Arc supports three sync modes with different durability/performance tradeoffs:

#### fdatasync (recommended)

```toml
[wal]
sync_mode = "fdatasync"
```

**How it works:**
- Syncs data to disk (file contents)
- Skips the metadata-only journal flush (timestamps)
- Marginally cheaper than `fsync` at equal durability for Arc's access pattern

**Guarantees:**
- Data is on physical disk
- Can recover all data on crash

**Platform support:** `fdatasync(2)` is used on **Linux**. macOS and Windows do
not expose it, so Arc falls back to a full `fsync` there and logs this once at
startup:

```bash
fdatasync is unavailable on this platform; using full fsync instead
```

The WAL startup log also reports `fdatasync_supported`, so the effective
behavior is visible without guessing.

**Do not expect a throughput change from this setting.** Arc does not sync per
write — a background writer batches appends and syncs on a 100 ms ticker (or
after `sync_bytes`), so there are at most ~10 syncs per second regardless of
ingest rate. The sync mode determines *durability semantics*, not throughput.
On Linux the saving over `fsync` is the inode's timestamp metadata; because the
WAL file grows on every append, the changed file size must still be persisted,
so the practical difference is small — larger on rotational or network-backed
storage than on NVMe.

<Callout type="info" title="macOS durability">
On macOS, `Sync()` maps to `fsync(2)`, which does not force the drive's own
write cache to flush (that requires `F_FULLFSYNC`). Durability guarantees are
softer on macOS regardless of the selected sync mode — relevant for local
development, not for Linux production deployments.
</Callout>

**Use case**: Production deployments (recommended)

#### fsync (maximum safety)

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

#### async (performance-first)

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

### Rotation settings

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

### Recovery on startup

Arc automatically recovers from WAL files on startup:

```text
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

### WAL status

```bash
curl http://localhost:8000/api/wal/status \
  -H "Authorization: Bearer $ARC_TOKEN"
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

### WAL files

```bash
curl http://localhost:8000/api/wal/files \
  -H "Authorization: Bearer $ARC_TOKEN"
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

### Health check

```bash
curl http://localhost:8000/api/wal/health \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### Cleanup old WAL files

```bash
# Cleanup files older than 24 hours (default)
curl -X POST http://localhost:8000/api/wal/cleanup \
  -H "Authorization: Bearer $ARC_TOKEN"

# Custom age (in hours)
curl -X POST "http://localhost:8000/api/wal/cleanup?max_age_hours=48" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Troubleshooting

### WAL recovery taking too long

**Symptoms:**
```text
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
   directory = "/mnt/nvme/arc-wal"   # NVMe SSD
   ```

3. **Use faster storage:**
   - NVMe SSD for WAL directory
   - Separate disk from data storage

### WAL disk space growing

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

### WAL write failures

**Symptoms:**
```text
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
   directory = "/mnt/large-disk/arc-wal"
   ```

### Performance degradation with WAL

**Symptoms:**
- Throughput dropped sharply after enabling WAL
- High CPU usage from fsync calls

**Solutions:**

1. **Do not expect the sync mode to be the cause.** Syncs are batched on a
   100 ms ticker rather than performed per write, so `fsync`, `fdatasync` and
   `async` land within noise of one another. Switching modes to chase
   throughput will not help — look at disk I/O and WAL placement below.

2. **Check disk I/O wait:**
   ```bash
   iostat -x 1
   # Look for %iowait > 50%
   ```

3. **Move WAL to faster disk:**
   ```toml
   [wal]
   directory = "/mnt/nvme/arc-wal"
   ```

4. **Consider disabling WAL if durability isn't critical:**
   ```toml
   [wal]
   enabled = false
   ```

## Best practices

### Production deployment

**Recommended configuration:**

```toml
[wal]
enabled = true
sync_mode = "fdatasync"
directory = "/mnt/fast-ssd/arc-wal"
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

### Development/testing

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
directory = "/mnt/nvme/arc-wal"   # Fast disk
```

## Next steps

- **[Configure Compaction](/arc/advanced/compaction/)** - Optimize query performance
- **[Monitor Arc](/arc/operations/telemetry/)** - Set up health checks
- **[Configuration Reference](/arc/configuration/overview/)** - Maximize throughput
