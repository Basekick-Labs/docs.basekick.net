---
sidebar_position: 3
---

# Query Caching

Arc implements multiple caching layers to optimize query performance, particularly for dashboard and monitoring use cases where the same queries are executed repeatedly.

## Cache Layers

Arc uses three complementary caches that work together:

| Cache | TTL | Purpose | Savings |
|-------|-----|---------|---------|
| SQL Transform Cache | 60s | Caches SQL-to-storage-path conversions | 49-104x speedup |
| Partition Path Cache | 60s | Caches `OptimizeTablePath()` results | 50-100ms/query |
| Glob Cache | 30s | Caches filesystem glob results | 5-10ms/query |

## SQL Transform Cache

When you execute a query like:

```sql
SELECT * FROM mydb.cpu WHERE time > now() - INTERVAL '1 hour'
```

Arc converts the table reference `mydb.cpu` to a DuckDB `read_parquet()` call:

```sql
SELECT * FROM read_parquet('./data/mydb/cpu/**/*.parquet') WHERE time > now() - INTERVAL '1 hour'
```

This string transformation uses regex matching and happens on every query. The SQL Transform Cache stores the result so repeated queries skip this processing.

### Performance Impact

| Scenario | Time | Speedup |
|----------|------|---------|
| Without cache (first query) | 13-37μs | - |
| With cache (repeated query) | ~300ns | 49-104x |

### When It Helps

The SQL Transform Cache is most beneficial for:

- **Dashboard refresh**: Same queries every 30s-5min
- **Monitoring alerts**: Repeated threshold checks
- **API integrations**: Clients polling the same metrics
- **Multi-user dashboards**: Shared queries across users

### Cache Behavior

- **Key**: SHA256 hash of the raw SQL string
- **TTL**: 60 seconds (matches partition cache)
- **Max entries**: 10,000 queries
- **Eviction**: Expired entries removed first, then oldest

## Partition Path Cache

After SQL transformation, Arc optimizes the storage path by applying time-based partition pruning. This cache stores the optimized paths.

### Example

Query with time filter:
```sql
SELECT * FROM mydb.cpu WHERE time > 1704067200000000
```

Without cache: Scans partition metadata to find relevant directories.
With cache: Returns pre-computed path like `./data/mydb/cpu/2024/01/**/*.parquet`.

### Performance Impact

Saves 50-100ms per query on large datasets with many partitions.

## Glob Cache

After determining the partition path, Arc uses filesystem globs to find matching Parquet files. The Glob Cache stores these file listings.

### Performance Impact

Saves 5-10ms per query by avoiding repeated filesystem operations.

## Cache Statistics

Monitor cache performance via the pruner stats:

```go
stats := pruner.GetAllCacheStats()
```

Returns:
```json
{
  "partition_cache": {
    "size": 150,
    "hits": 12847,
    "misses": 423,
    "hit_rate_percent": 96.8
  },
  "glob_cache": {
    "size": 89,
    "hits": 8234,
    "misses": 312,
    "hit_rate_percent": 96.3
  }
}
```

## Best Practices

### 1. Use Consistent Query Strings

Cache keys are based on exact SQL text. These are different cache entries:

```sql
SELECT * FROM mydb.cpu WHERE time > 1704067200000000
SELECT *  FROM mydb.cpu WHERE time > 1704067200000000  -- extra space
select * from mydb.cpu where time > 1704067200000000   -- lowercase
```

Normalize your queries for better cache hit rates.

### 2. Use Parameterized Time Ranges

For dashboard queries, use relative time:

```sql
-- Good: Same query text on every refresh
SELECT * FROM mydb.cpu WHERE time > now() - INTERVAL '1 hour'

-- Less efficient: Different timestamp each time
SELECT * FROM mydb.cpu WHERE time > 1704067200000000
```

### 3. Monitor Hit Rates

Healthy dashboards should see 60-80%+ cache hit rates. Low hit rates may indicate:

- Too many unique queries
- Query text variations
- TTL too short for your refresh interval

## Configuration

Cache parameters are currently fixed but tuned for typical workloads:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| SQL Transform TTL | 60s | Covers 1-2 dashboard refresh cycles |
| SQL Transform Max Size | 10,000 | Handles large multi-tenant deployments |
| Partition Cache TTL | 60s | Balance freshness vs. performance |
| Glob Cache TTL | 30s | Files change less frequently |

## Cache Invalidation

Caches automatically expire based on TTL. Manual invalidation happens when:

- New data is ingested (invalidates partition/glob caches for affected measurements)
- Compaction runs (file paths change)

The SQL Transform Cache is not invalidated by data changes since the transformation logic doesn't depend on data content.

## Technical Details

### Thread Safety

All caches use `sync.RWMutex` for concurrent access:
- Multiple readers allowed
- Exclusive write lock for updates
- Lock-free atomic counters for hit/miss tracking

### Memory Usage

Approximate memory per cache:

| Cache | Entry Size | Max Entries | Max Memory |
|-------|------------|-------------|------------|
| SQL Transform | ~500 bytes | 10,000 | ~5MB |
| Partition Path | ~200 bytes | 1,000 | ~200KB |
| Glob | ~1KB | 1,000 | ~1MB |

Total cache overhead: ~6MB typical, ~10MB maximum.

## Next Steps

- **[Compaction](/arc/advanced/compaction)** - Optimize query performance through file merging
- **[WAL](/arc/advanced/wal)** - Write-ahead log for durability
- **[Performance Benchmarks](/arc/performance/benchmarks)** - Benchmark methodology and results
