---
title: "File Compaction"
description: "How Arc merges small Parquet files into larger ones on an hourly and daily schedule, why the small-file problem slows queries, and which compaction keys to tune."
---

Arc's automatic compaction system merges small Parquet files into larger, optimized files for dramatically faster queries.

## Overview

Compaction is Arc's file optimization system that **merges small files into larger ones**, substantially improving query performance.

**Key Features:**
- **Automatic** - Runs on schedule (default: hourly at :05)
- **Safe** - Locked partitions prevent concurrent compaction
- **Efficient** - Uses DuckDB for fast, parallel merging
- **Non-blocking** - Queries work during compaction
- **Enabled by default** - Essential for production

<Callout type="info">
Compaction is **enabled by default** and runs automatically every hour.
</Callout>

## Why Compaction Matters

### The Small File Problem

Arc's high-throughput ingestion creates many small files:

```bash
At high ingest rates with a 5-second flush interval:
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

```text
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
- **Far fewer file opens** - Single file scan vs hundreds
- **99% fewer API calls** - Massive cost reduction (2,704 → 3 LIST operations)
- **80.4% compression** - ZSTD compaction vs Snappy writes
- **Effective pruning** - DuckDB can skip entire files

## How It Works

### Compaction Flow

```text
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

```text
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

# Hourly tier
hourly_enabled = true
hourly_schedule = "5 * * * *"   # Cron schedule: every hour at :05
hourly_min_age_hours = 1        # Wait 1 hour before compacting (let the hour complete)
hourly_min_files = 10           # Only compact if >=10 files exist

# Daily tier
daily_enabled = true
daily_schedule = "0 3 * * *"    # Cron schedule: 3 AM daily
daily_min_age_hours = 24        # Wait 24 hours
daily_min_files = 12            # Only compact if >=12 files exist

max_concurrent = 2              # Run 2 compactions in parallel
```

### Configuration Options

#### Schedule

```toml
[compaction]
hourly_schedule = "5 * * * *"     # Every hour at :05 (default)
daily_schedule = "0 3 * * *"      # 3 AM daily (default)
# hourly_schedule = "0 */2 * * *"   # Every 2 hours at :00
```

**Cron format:** `minute hour day month weekday`

#### Minimum Age

```toml
[compaction]
hourly_min_age_hours = 1    # Don't compact the current hour (default)
daily_min_age_hours = 24    # Daily tier waits a full day (default)
# hourly_min_age_hours = 2    # Wait 2 hours (more conservative)
# hourly_min_age_hours = 0    # Compact immediately (aggressive)
```

<Callout type="warn">
Setting `hourly_min_age_hours = 0` can compact the current hour while data is still being written, potentially creating many compacted files.
</Callout>

#### Minimum Files

```toml
[compaction]
hourly_min_files = 10    # Only compact if >=10 files (default)
daily_min_files = 12     # Daily tier threshold (default)
# hourly_min_files = 50    # Only compact with many files
# hourly_min_files = 5     # Compact more aggressively
```

#### Concurrent Jobs

```toml
[compaction]
max_concurrent = 2    # Run 2 compactions in parallel (default)
# max_concurrent = 4    # More parallelism (uses more CPU/memory)
# max_concurrent = 1    # Sequential (lower resource usage)
```

#### Memory Limit and Threads (per subprocess)

<Callout type="info" title="Available in v26.09.1+">
`memory_limit` and `threads` are configurable starting in Arc **v26.09.1**. On earlier versions each compaction subprocess inherits the full `database.memory_limit` and uses all CPU cores.
</Callout>

Each compaction job runs in an isolated subprocess with its own DuckDB instance. These keys bound that instance's resources:

```toml
[compaction]
memory_limit = ""    # Per-subprocess DuckDB memory limit; "" (default) = auto
threads = 0          # Per-subprocess DuckDB threads; 0 (default) = auto
# memory_limit = "2GB"   # Explicit cap
# threads = 4            # Explicit thread count
```

Env vars: `ARC_COMPACTION_MEMORY_LIMIT`, `ARC_COMPACTION_THREADS`.

**Auto behavior:**

- `memory_limit` derives as `database.memory_limit / max_concurrent`, so all concurrent compaction jobs together stay within roughly one `database.memory_limit`. With `database.memory_limit = "8GB"` and the default concurrency of 2, each subprocess gets `4GB`.
- `threads` defaults to half the CPU cores (minimum 1), so the default two concurrent jobs together use about one machine's worth of cores, leaving headroom for ingest and queries.

Accepted `memory_limit` forms are absolute sizes with a unit: `"8GB"`, `"512MB"`, `"0.5GB"`. Percent and unit-less forms are rejected at startup (DuckDB's `SET memory_limit` does not support them), as are other invalid values. The effective values appear in the startup log (`subprocess_memory_limit`, `subprocess_threads`).

When a job exceeds its memory limit, DuckDB spills to a `duckdb-spill/` directory inside the job's temp directory (under `compaction.temp_directory`) — size that volume for your largest partitions. Spill files are removed by normal job cleanup and by the crash sweeps on startup.

Lower these when compaction competes with ingest for RAM during backfill catch-up (many partitions become candidates at once); raise them to make individual large compactions faster on dedicated compactor nodes.

#### Files Per Batch

<Callout type="info" title="Available in v26.09.1+">
`max_files_per_batch` is configurable starting in Arc **v26.09.1**. On earlier versions the batch size is fixed at 30 files and this setting has no effect.
</Callout>

A partition with more files than this is split into several batches, each compacted as an independent job producing its own output file.

```toml
[compaction]
max_files_per_batch = 30   # Files per compaction job (default)
# max_files_per_batch = 5    # Smaller outputs, more jobs per partition
# max_files_per_batch = 60   # Fewer, larger outputs
```

Valid range is **2–500**. Values outside it fall back to the default with a startup warning; `1` is rejected because compaction's adaptive retry cannot process a single-file batch.

This bounds the **file count** per job, not the output size in bytes — compacted file size tracks input file size, which follows your ingest buffer settings. The main reason to lower it is transferring compacted files over a constrained or intermittent link (edge deployments), where smaller, independently-transferable files resume better after an interruption. The trade-off is more compaction jobs per partition, and in cluster mode proportionally more Raft manifest entries.

The upper bound exists because DuckDB can abort when a single `read_parquet()` call spans too many files.

#### Compression

Compaction always writes its output with ZSTD, which is why compacted files are
substantially smaller than the freshly-ingested files they replace. This is not
configurable per tier.

The compression used for **incoming** writes is separate, and is set by
`ingest.compression` (default `snappy`) — see the
[configuration overview](/arc/configuration/overview/).

### Disable Compaction

```toml
[compaction]
enabled = false
```

**When to disable:**
- Testing ingestion performance
- Very low write volume (&lt;10 files/hour)
- Debugging compaction issues

<Callout type="warn">
Disabling compaction will cause queries to slow down significantly as files accumulate.
</Callout>

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
-- 0.05 seconds (scan 1 file)
```

### Storage Savings

```bash
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
hourly_schedule = "5 * * * *"
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
hourly_min_files = 100   # Wait for more files
max_concurrent = 4       # More parallelism
```

**Low volume** (&lt;100K records/sec):
```toml
[compaction]
hourly_min_files = 5              # Compact with fewer files
hourly_schedule = "0 */6 * * *"   # Every 6 hours
```

### 4. Tune Files Per Batch

```toml
[compaction]
max_files_per_batch = 30     # Files per compaction job (default)
# max_files_per_batch = 60     # Fewer, larger outputs
# max_files_per_batch = 5      # Smaller outputs, more jobs per partition
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
- Compaction time: substantially reduced
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

### Partition Skipped: No `time` Column

**Symptoms:** A warning in the logs:

```bash
Skipping compaction: no 'time' column in any input file (data was not written by Arc ingest); leaving source files in place
```

**Cause:** Compaction requires a `time` column — it normalizes the column's type and sorts output by it. Arc's ingest path always writes one, so this only happens for Parquet files placed into the storage directory by external tools (custom loaders, bulk copies from other systems).

**What happens:** The partition is left untouched and the job counts as completed, not failed. The warning repeats each cycle as long as the partition stays above the compaction file-count threshold.

**Solutions:**

1. **Rewrite the data through Arc ingest** so it carries a proper `time` column, or
2. **Rewrite the files in place** with the timestamp column renamed/cast to `time` (type `TIMESTAMP WITH TIME ZONE`), or
3. **Leave it as-is** — the data stays queryable; it just won't be compacted.

Partitions where only *some* files lack `time` are not skipped: they compact normally, and rows from files without the column get `NULL` time values.

### Compaction Taking Too Long

**Symptoms:** Compaction jobs running for &gt;30 minutes

**Solutions:**

1. **Reduce files per batch:**
   ```toml
   [compaction]
   max_files_per_batch = 10  # Smaller compaction jobs
   ```

2. **Increase parallelism:**
   ```toml
   [compaction]
   max_concurrent = 4
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
   max_concurrent = 1
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
- Faster queries
- 80% storage savings
- 99% fewer API calls
- Automatic and safe

**Default configuration works for most cases:**
```toml
[compaction]
enabled = true
hourly_schedule = "5 * * * *"
hourly_min_age_hours = 1
hourly_min_files = 10
```

**Monitor regularly:**
- Check `/api/v1/compaction/status`
- Alert on failed jobs
- Watch for partitions with &gt;1000 files

## Next Steps

- **[Monitor Compaction](/arc/operations/telemetry/)** - Set up health checks
- **[Configure WAL](/arc/advanced/wal/)** - Add durability guarantees
- **[Configuration Reference](/arc/configuration/overview/)** - Tune settings for your workload
