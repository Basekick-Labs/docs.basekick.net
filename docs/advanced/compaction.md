---
sidebar_position: 2
---

# File Compaction

Arc's automatic compaction system merges small Parquet files into larger, optimized files for dramatically faster queries.

## Overview

Compaction is Arc's file optimization system that **merges small files into larger ones**, improving query performance by 10-50x.

**Key Features:**
- **Automatic** - Runs on schedule (default: hourly at :05)
- **Safe** - Locked partitions prevent concurrent compaction
- **Efficient** - Uses DuckDB for fast, parallel merging
- **Non-blocking** - Queries work during compaction
- **Enabled by default** - Essential for production

:::info
Compaction is **enabled by default** and runs automatically every hour.
:::

## Why Compaction Matters

### The Small File Problem

Arc's high-performance ingestion (9.47M records/sec) creates many small files:

```
At 9.47M records/sec with 5-second flush:
→ 10M records every 5 seconds
→ 12 files per minute per measurement
→ 720 files per hour per measurement
→ 17,280 files per day per measurement
```

**Impact on Queries:**
- **Slow queries** - DuckDB must open/scan hundreds of files
- **High costs** - More S3/MinIO API calls
- **Poor compression** - Small files compress less efficiently
- **Reduced pruning** - Less effective partition elimination

### After Compaction

**Real Production Test Results:**

```
Before: 2,704 small files (Snappy) = 3.7 GB
After:  3 compacted files (ZSTD)   = 724 MB

Compression: 80.4% space savings
File reduction: 901x fewer files (2,704 → 3)
Compaction time: 5 seconds
```

**Per-Measurement Breakdown:**
- **mem**: 888 files → 1 file, 1,213 MB → 239 MB (80.3% compression)
- **disk**: 906 files → 1 file, 1,237 MB → 242 MB (80.4% compression)
- **cpu**: 910 files → 1 file, 1,246 MB → 243 MB (80.5% compression)

**Query Performance:**
- **10-50x faster** - Single file scan vs hundreds
- **99% fewer API calls** - Massive cost reduction (2,704 → 3 LIST operations)
- **80.4% compression** - ZSTD compaction vs Snappy writes
- **Effective pruning** - DuckDB can skip entire files

## How It Works

### Compaction Flow

```
1. Scheduler wakes up (cron: "5 * * * *")
   ↓
2. Scan storage for eligible partitions
   ↓
3. For each partition:
   - Check age (&gt;1 hour old?)
   - Check file count (≥10 files?)
   - Check if already compacted?
   ↓
4. Acquire partition lock (SQLite)
   ↓
5. Download small files to temp directory
   ↓
6. Compact using DuckDB (parallel, sorted)
   ↓
7. Upload compacted file to storage
   ↓
8. Delete old small files
   ↓
9. Release lock & cleanup temp files
   ↓
10. Repeat for next partition
```

### Partition Structure

Data is organized by hour:

```
arc/                              # Bucket
├── default/                      # Database
│   └── cpu/                      # Measurement
│       └── 2025/10/08/           # Date
│           ├── 14/               # Hour (2 PM) - Eligible for compaction
│           │   ├── file1.parquet (50 MB)
│           │   ├── file2.parquet (48 MB)
│           │   └── ...
│           ├── 15/               # Hour (3 PM) - Eligible for compaction
│           └── 16/               # Hour (4 PM) - CURRENT, skip!
```

Compaction merges all files in a partition (e.g., `2025/10/08/14/`) into one optimized file.

## Configuration

### Default Configuration

Compaction is **enabled by default** in `arc.toml`:

```toml
[compaction]
enabled = true
min_age_hours = 1              # Wait 1 hour before compacting (let hour complete)
min_files = 10                 # Only compact if ≥10 files exist
target_file_size_mb = 512      # Target size for compacted files
schedule = "5 * * * *"         # Cron schedule: every hour at :05
max_concurrent_jobs = 2        # Run 2 compactions in parallel
compression = "zstd"           # Better compression than snappy
compression_level = 3          # Balance compression vs speed
```

### Configuration Options

#### Schedule

```toml
[compaction]
schedule = "5 * * * *"    # Every hour at :05 (default)
# schedule = "0 */2 * * *"  # Every 2 hours at :00
# schedule = "0 2 * * *"    # Daily at 2 AM
```

**Cron format:** `minute hour day month weekday`

#### Minimum Age

```toml
[compaction]
min_age_hours = 1    # Don't compact current hour (default)
# min_age_hours = 2    # Wait 2 hours (more conservative)
# min_age_hours = 0    # Compact immediately (aggressive)
```

:::caution
Setting `min_age_hours = 0` can compact the current hour while data is still being written, potentially creating many compacted files.
:::

#### Minimum Files

```toml
[compaction]
min_files = 10       # Only compact if ≥10 files (default)
# min_files = 50       # Only compact with many files
# min_files = 5        # Compact more aggressively
```

#### Target File Size

```toml
[compaction]
target_file_size_mb = 512    # Target 512MB files (default)
# target_file_size_mb = 1024   # Larger files (fewer files, longer compaction)
# target_file_size_mb = 256    # Smaller files (more files, faster compaction)
```

#### Concurrent Jobs

```toml
[compaction]
max_concurrent_jobs = 2    # Run 2 compactions in parallel (default)
# max_concurrent_jobs = 4    # More parallelism (use more CPU/memory)
# max_concurrent_jobs = 1    # Sequential (lower resource usage)
```

#### Compression

```toml
[compaction]
compression = "zstd"        # Best compression (default)
compression_level = 3       # Balance speed vs compression (default)

# Options:
# compression = "snappy"    # Fastest, lower compression
# compression = "gzip"      # Good compression, slower
# compression = "zstd"      # Best compression, good speed
```

### Disable Compaction

```toml
[compaction]
enabled = false
```

**When to disable:**
- Testing ingestion performance
- Very low write volume (&lt;10 files/hour)
- Debugging compaction issues

:::warning
Disabling compaction will cause queries to slow down significantly as files accumulate.
:::

## Monitoring

### Check Compaction Status

```bash
curl http://localhost:8000/api/compaction/status \
  -H "Authorization: Bearer $ARC_TOKEN"
```

**Response:**

```json
{
  "enabled": true,
  "running": false,
  "last_run": "2025-10-08T14:05:00Z",
  "next_run": "2025-10-08T15:05:00Z",
  "stats": {
    "total_jobs": 42,
    "successful_jobs": 40,
    "failed_jobs": 2,
    "total_files_compacted": 12580,
    "total_bytes_saved": 8589934592
  }
}
```

### Get Detailed Statistics

```bash
curl http://localhost:8000/api/compaction/stats \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### List Eligible Partitions

```bash
curl http://localhost:8000/api/compaction/candidates \
  -H "Authorization: Bearer $ARC_TOKEN"
```

**Response:**

```json
{
  "candidates": [
    {
      "partition": "default/cpu/2025/10/08/14",
      "file_count": 150,
      "total_size_mb": 7500,
      "age_hours": 2.5,
      "eligible": true
    },
    {
      "partition": "default/mem/2025/10/08/14",
      "file_count": 120,
      "total_size_mb": 6000,
      "age_hours": 2.5,
      "eligible": true
    }
  ],
  "total_candidates": 2
}
```

### Manually Trigger Compaction

```bash
curl -X POST http://localhost:8000/api/compaction/trigger \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### View Active Jobs

```bash
curl http://localhost:8000/api/compaction/jobs \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### View Job History

```bash
curl http://localhost:8000/api/compaction/history \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Performance Impact

### Compaction Performance

**Test Environment:** Apple M3 Max (14 cores, 36GB RAM)

| Files | Size | Compaction Time | Final Size | Compression |
|-------|------|----------------|------------|-------------|
| 888 | 1.2 GB | 2.1s | 239 MB | 80.3% |
| 906 | 1.2 GB | 2.2s | 242 MB | 80.4% |
| 910 | 1.2 GB | 2.3s | 243 MB | 80.5% |

**Total:** 2,704 files (3.7 GB) → 3 files (724 MB) in **6.6 seconds**

### Query Performance

**Before Compaction:**
```sql
SELECT * FROM default.cpu WHERE time > NOW() - INTERVAL 1 HOUR;
-- 5.2 seconds (scan 720 files)
```

**After Compaction:**
```sql
SELECT * FROM default.cpu WHERE time > NOW() - INTERVAL 1 HOUR;
-- 0.05 seconds (scan 1 file) - 104x faster!
```

### Storage Savings

```
Original files (Snappy):  3.7 GB
Compacted files (ZSTD):   724 MB
Space saved:              80.4%
```

## Best Practices

### 1. Let Compaction Run Automatically

The default schedule (hourly) works well for most use cases:

```toml
[compaction]
enabled = true
schedule = "5 * * * *"
```

### 2. Monitor Compaction Jobs

Set up alerts for:
- Failed compaction jobs
- Partitions with &gt;1000 files
- Compaction taking &gt;10 minutes

### 3. Adjust Based on Write Volume

**High volume** (&gt;10M records/sec):
```toml
[compaction]
min_files = 100          # Wait for more files
max_concurrent_jobs = 4  # More parallelism
```

**Low volume** (&lt;100K records/sec):
```toml
[compaction]
min_files = 5            # Compact with fewer files
schedule = "0 */6 * * *" # Every 6 hours
```

### 4. Use Appropriate Target File Size

```toml
[compaction]
target_file_size_mb = 512    # Good default
# target_file_size_mb = 1024   # For very large datasets
# target_file_size_mb = 256    # For faster compaction
```

### 5. Reduce File Generation at Source

**Best practice:** Increase buffer sizes to generate fewer files:

```toml
[ingest]
max_buffer_size = 200000        # Up from 50,000 (4x fewer files)
max_buffer_age_ms = 10000       # Up from 5000 (2x fewer files)
```

**Impact:**
- Files generated: 2,000/hour → 250/hour (8x reduction)
- Compaction time: 150s → 20s (7x faster)
- Memory usage: +300MB per worker

This is the **most effective optimization** - fewer files means faster compaction AND faster queries.

## Troubleshooting

### Compaction Not Running

**Check status:**
```bash
curl http://localhost:8000/api/compaction/status
```

**Verify configuration:**
```bash
# Check if enabled
grep "enabled" arc.toml

# Check schedule
grep "schedule" arc.toml
```

**Check logs:**
```bash
# Docker
docker logs arc | grep compaction

# Native
sudo journalctl -u arc | grep compaction
```

### Compaction Taking Too Long

**Symptoms:** Compaction jobs running for &gt;30 minutes

**Solutions:**

1. **Reduce target file size:**
   ```toml
   [compaction]
   target_file_size_mb = 256  # Smaller chunks
   ```

2. **Increase parallelism:**
   ```toml
   [compaction]
   max_concurrent_jobs = 4
   ```

3. **Reduce files at source:**
   ```toml
   [ingest]
   max_buffer_size = 200000
   ```

### Out of Disk Space During Compaction

**Symptoms:** Compaction fails with disk space errors

**Solutions:**

1. **Use temp directory on larger disk:**
   ```bash
   export TMPDIR=/mnt/large-disk/tmp
   ```

2. **Reduce concurrent jobs:**
   ```toml
   [compaction]
   max_concurrent_jobs = 1
   ```

3. **Clean up old compacted files manually:**
   ```bash
   # Remove small files that were already compacted
   find ./data -name "*.parquet" -size -10M -delete
   ```

### Compaction Locks Not Releasing

**Symptoms:** Partitions stuck in "locked" state

**Check locks:**
```bash
# View active locks
sqlite3 ./data/arc.db "SELECT * FROM compaction_locks;"
```

**Clear stale locks:**
```bash
# Locks expire automatically after 2 hours
# Or manually clear:
sqlite3 ./data/arc.db "DELETE FROM compaction_locks WHERE expires_at < datetime('now');"
```

## API Reference

### GET /api/v1/compaction/status

Get current compaction status.

**Response:**
```json
{
  "enabled": true,
  "running": false,
  "last_run": "2025-10-08T14:05:00Z",
  "next_run": "2025-10-08T15:05:00Z"
}
```

### GET /api/v1/compaction/stats

Get detailed compaction statistics.

### GET /api/v1/compaction/candidates

List partitions eligible for compaction.

### POST /api/v1/compaction/trigger

Manually trigger compaction.

**Response:**
```json
{
  "message": "Compaction triggered",
  "job_id": "comp_1696775400"
}
```

### GET /api/v1/compaction/jobs

View active compaction jobs.

### GET /api/v1/compaction/history

View compaction job history.

## Summary

Compaction is essential for production deployments:

**Benefits:**
- 10-50x faster queries
- 80% storage savings
- 99% fewer API calls
- Automatic and safe

**Default configuration works for most cases:**
```toml
[compaction]
enabled = true
schedule = "5 * * * *"
min_age_hours = 1
min_files = 10
```

**Monitor regularly:**
- Check `/api/v1/compaction/status`
- Alert on failed jobs
- Watch for partitions with &gt;1000 files

## Next Steps

- **[Monitor Compaction](/arc/operations/telemetry)** - Set up health checks
- **[Configure WAL](/arc/advanced/wal)** - Add durability guarantees
- **[Configuration Reference](/arc/configuration/overview)** - Tune settings for your workload
