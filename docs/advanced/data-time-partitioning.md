---
sidebar_position: 1
---

# Data-Time Partitioning

Arc organizes Parquet files by the data's timestamp rather than ingestion time, enabling proper backfill of historical data and optimal query performance.

## Overview

Data-time partitioning ensures that your data lands in the correct time-based partitions based on when the events actually occurred, not when they were ingested into Arc.

**Key Features:**
- **Historical backfill** - Past data lands in correct partitions (e.g., December 2024 data goes to `2024/12/` folders)
- **Sorted files** - Data is sorted by timestamp within each Parquet file
- **Automatic splitting** - Batches spanning multiple hours are split into separate files
- **Partition pruning** - Enables accurate time-range query optimization

:::info
Data-time partitioning is **enabled by default** and requires no configuration.
:::

## Why It Matters

### The Problem with Ingestion-Time Partitioning

Traditional ingestion-time partitioning creates problems when backfilling historical data:

```
Scenario: Ingesting December 2024 sensor data on January 4, 2025

❌ Ingestion-time partitioning:
data/mydb/cpu/2025/01/04/...  (wrong - today's partition)

✅ Data-time partitioning:
data/mydb/cpu/2024/12/01/14/...  (correct - data's timestamp)
data/mydb/cpu/2024/12/01/15/...
```

**Impact:**
- **Broken queries** - Time-range queries can't find historical data
- **No partition pruning** - DuckDB must scan all files, not just relevant partitions
- **Mixed data** - Historical and current data mixed in same partition
- **Poor compaction** - Files with mixed timestamps don't compact efficiently

### After Data-Time Partitioning

With data-time partitioning, your data is always organized correctly:

```
# Query for December 2024 data only scans December partitions
SELECT * FROM mydb.cpu
WHERE time >= '2024-12-01' AND time < '2025-01-01'

→ DuckDB scans only: data/mydb/cpu/2024/12/**/*.parquet
→ Skips all 2025 partitions entirely
```

**Benefits:**
- **10-100x faster queries** - Partition pruning eliminates irrelevant files
- **Accurate historical analysis** - Data lives where it belongs
- **Efficient compaction** - Files with similar timestamps compact together
- **Predictable storage** - Easy to manage retention by date folders

## How It Works

### Single-Hour Batches

When all records in a batch fall within the same hour:

```
Incoming batch (all records from 2024-12-15 14:xx):
┌─────────────────────────┬────────┬───────┐
│ time                    │ host   │ value │
├─────────────────────────┼────────┼───────┤
│ 2024-12-15T14:05:00.000 │ srv01  │ 45.2  │
│ 2024-12-15T14:32:00.000 │ srv01  │ 47.8  │
│ 2024-12-15T14:58:00.000 │ srv01  │ 44.1  │
└─────────────────────────┴────────┴───────┘

Result: Single sorted file
→ data/mydb/cpu/2024/12/15/14/abc123.parquet
  (records sorted by timestamp)
```

### Multi-Hour Batches

When a batch spans multiple hours, Arc automatically splits it:

```
Incoming batch (records spanning 14:00-16:00):
┌─────────────────────────┬────────┬───────┐
│ time                    │ host   │ value │
├─────────────────────────┼────────┼───────┤
│ 2024-12-15T14:30:00.000 │ srv01  │ 45.2  │
│ 2024-12-15T15:15:00.000 │ srv01  │ 47.8  │
│ 2024-12-15T15:45:00.000 │ srv01  │ 46.3  │
│ 2024-12-15T16:10:00.000 │ srv01  │ 44.1  │
└─────────────────────────┴────────┴───────┘

Result: Three separate sorted files
→ data/mydb/cpu/2024/12/15/14/abc123.parquet (1 record)
→ data/mydb/cpu/2024/12/15/15/def456.parquet (2 records)
→ data/mydb/cpu/2024/12/15/16/ghi789.parquet (1 record)
```

### Partition Structure

Data is organized hierarchically by time:

```
data/                           # Storage root
├── default/                    # Database
│   └── cpu/                    # Measurement
│       ├── 2024/               # Year
│       │   └── 12/             # Month
│       │       ├── 01/         # Day
│       │       │   ├── 14/     # Hour (2 PM)
│       │       │   │   └── abc123.parquet
│       │       │   └── 15/     # Hour (3 PM)
│       │       │       └── def456.parquet
│       │       └── 15/         # Day 15
│       │           └── ...
│       └── 2025/               # Year
│           └── 01/             # Month
│               └── ...
```

## Sorting Within Files

Each Parquet file contains data sorted by timestamp in ascending order:

```sql
-- Data is pre-sorted, enabling efficient scans
-- DuckDB can use sorted file metadata for:
-- - Early termination on LIMIT queries
-- - Efficient MIN/MAX aggregations
-- - Optimized range scans

SELECT * FROM mydb.cpu
WHERE time >= '2024-12-15T14:00:00'
  AND time < '2024-12-15T14:30:00'
ORDER BY time
LIMIT 100
```

**Performance benefits:**
- **No runtime sorting** - Data already ordered
- **Efficient LIMIT** - Stop scanning after N rows
- **Fast aggregations** - MIN/MAX read file metadata
- **Optimal compression** - Similar timestamps compress better

## UTC Consistency

All partition paths use UTC time, regardless of server timezone:

```
Server in New York (UTC-5):
Local time: 2024-12-15 10:00 EST
UTC time:   2024-12-15 15:00 UTC

→ Data written to: data/mydb/cpu/2024/12/15/15/...
  (UTC hour, not local hour)
```

:::tip
Using UTC ensures consistent partitioning across servers in different timezones and prevents partition misalignment during timezone changes (DST).
:::

## Query Partition Pruning

Arc's query engine automatically prunes partitions based on time predicates:

```sql
-- This query only scans December 2024 partitions
SELECT host, AVG(value) as avg_value
FROM mydb.cpu
WHERE time >= '2024-12-01T00:00:00Z'
  AND time < '2025-01-01T00:00:00Z'
GROUP BY host
```

**What happens:**
1. Arc parses the time range from the WHERE clause
2. Converts range to partition paths: `2024/12/**/*.parquet`
3. DuckDB receives only relevant file list
4. Files outside the range are never opened

**Performance impact:**
- Querying 1 month in a year of data → ~92% fewer files scanned
- Querying 1 day in a month of data → ~97% fewer files scanned
- Querying 1 hour in a day of data → ~96% fewer files scanned

## Backfilling Historical Data

Data-time partitioning makes historical backfill straightforward:

```python
from arc_client import ArcClient

# Backfill sensor data from December 2024
# (even though we're ingesting in January 2025)
historical_data = {
    "time": [
        1701388800000000,  # 2024-12-01T00:00:00Z
        1701475200000000,  # 2024-12-02T00:00:00Z
        1701561600000000,  # 2024-12-03T00:00:00Z
    ],
    "sensor_id": ["temp-01", "temp-01", "temp-01"],
    "value": [22.5, 23.1, 21.8],
}

with ArcClient(host="localhost", token="your-token") as client:
    client.write.write_columnar(
        measurement="sensors",
        columns=historical_data,
    )

# Data lands in correct partitions:
# → data/default/sensors/2024/12/01/00/...
# → data/default/sensors/2024/12/02/00/...
# → data/default/sensors/2024/12/03/00/...
```

## Interaction with Compaction

Data-time partitioning works seamlessly with [file compaction](/arc/advanced/compaction):

1. **Ingestion** - Small files written to correct hourly partitions
2. **Compaction** - Files within each partition merged into larger files
3. **Result** - Each hour has one large, sorted, optimized file

```
Before compaction:
data/mydb/cpu/2024/12/15/14/
├── file1.parquet (5 MB, 100K records)
├── file2.parquet (4 MB, 80K records)
├── file3.parquet (6 MB, 120K records)
└── ... (100 more small files)

After compaction:
data/mydb/cpu/2024/12/15/14/
└── compacted_abc123.parquet (450 MB, 10M records, sorted)
```

## Best Practices

### Timestamp Requirements

Ensure your timestamps are accurate:

```python
# ✅ Good: Microsecond Unix timestamps (UTC)
"time": [1701388800000000, 1701388801000000]

# ✅ Good: Nanosecond Unix timestamps (UTC)
"time": [1701388800000000000, 1701388801000000000]

# ❌ Bad: String timestamps (require parsing)
"time": ["2024-12-01T00:00:00Z", "2024-12-01T00:00:01Z"]
```

### Bulk Imports

When importing large historical datasets:

1. **Sort by time first** - Pre-sorted data writes faster
2. **Batch by hour** - Reduces file splitting overhead
3. **Use columnar format** - MessagePack columnar is fastest
4. **Trigger compaction after** - Consolidate small files

```bash
# After bulk import, trigger compaction
curl -X POST http://localhost:8000/api/v1/compaction/hourly \
  -H "Authorization: Bearer $TOKEN"
```

### Monitoring Partition Distribution

Check that data is landing in expected partitions:

```sql
-- View partition distribution
SELECT
    EXTRACT(YEAR FROM time) as year,
    EXTRACT(MONTH FROM time) as month,
    COUNT(*) as records
FROM mydb.sensors
GROUP BY year, month
ORDER BY year, month
```

## Next Steps

- [File Compaction](/arc/advanced/compaction) - Optimize partitioned files
- [Retention Policies](/arc/data-lifecycle/retention-policies) - Manage data by partition age
- [Performance Benchmarks](/arc/performance/benchmarks) - Benchmark partition pruning benefits
