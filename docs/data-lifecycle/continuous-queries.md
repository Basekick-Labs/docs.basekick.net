---
sidebar_position: 3
---

# Continuous Queries

Continuous queries enable automatic downsampling and aggregation of data into materialized views, reducing storage requirements while maintaining queryable historical data.

:::info Manual Execution Only
Automatic execution is an [Arc Enterprise](/arc-enterprise/operations/automated-scheduling) feature. In Arc OSS, continuous queries must be manually triggered via the API.
:::

## Overview

Continuous queries in Arc help you:
- **Downsample Data**: Aggregate high-frequency data into lower-frequency summaries
- **Reduce Storage**: Store aggregated data instead of raw metrics
- **Maintain History**: Keep long-term trends without full granularity
- **Improve Query Performance**: Query pre-aggregated data for faster results
- **Create Materialized Views**: Automatically maintain aggregated datasets

## How It Works

Continuous queries use DuckDB SQL to aggregate data from source measurements into destination measurements:

1. **Define Query**: Specify aggregation logic using SQL
2. **Set Schedule**: Configure time intervals for grouping (e.g., hourly, daily)
3. **Execute Manually**: Trigger execution via API with start/end times
4. **Store Results**: Write aggregated data to a new measurement
5. **Apply Retention**: Optionally set custom retention for aggregated data

### Architecture

```
Source Measurement (cpu)
    ↓
Continuous Query (AVG, MAX, MIN, etc.)
    ↓
Destination Measurement (cpu_hourly)
    ↓
Optional: Retention Policy
```

### Execution model and semantics

Continuous queries are **recomputed once per interval**, not maintained as an
incremental/streaming aggregate. There is no running state carried between runs.

On each scheduled run, Arc:

1. Computes the time window `[last_processed_time, now)` — the slice since the
   previous successful run (on the very first run it defaults to the last hour).
2. Substitutes that range into your query's `{start_time}` / `{end_time}`
   placeholders and runs the aggregation **fresh over the full set of source rows
   in that window** (read from Parquet).
3. Writes the results to the destination measurement, stamped with the window
   start time and tagged so duplicate windows can be deduped (see
   [Idempotency and `tag_columns`](#idempotency-and-tag_columns)).
4. Advances `last_processed_time` to the window's end.

Because the watermark advances to the end of each processed window, **windows are
tumbling and non-overlapping** — the next run starts where the previous one
ended; earlier windows are not revisited.

:::caution Important semantics
- **Late / out-of-order data is not reprocessed.** A window is computed once and
  the watermark then moves past it. Rows that arrive *after* their window has
  already been processed (late events, corrections, backfills) are **not folded
  back** into that window's aggregate. There is no lookback/grace window today.
- **Window boundaries are processing-time based** (`now` at run time), not
  event-time. A window's correctness assumes its data has been ingested by the
  time the interval fires.
- **Output is idempotent at compaction, not atomically exactly-once.** A retry,
  an overlapping manual re-run, or a crash between the write and the watermark
  update re-emits a window's rows, so duplicates can appear transiently. They are
  collapsed to one row per `(dimensions, time)` the next time the destination
  partition compacts — provided you declared the grouping dimensions in
  [`tag_columns`](#idempotency-and-tag_columns) (a query with no grouping is
  deduped automatically). Until compaction runs, a query over the destination may
  see the duplicate rows.

This model fits **periodic roll-ups and downsampling of in-order, timely data**
(for example building 1m/5m bars from a clean feed). If your workload involves
late corrections, out-of-order events, or strict synchronous exactly-once
aggregation, design around these semantics (e.g. reprocess on a delay, or do the
final roll-up as a query-time aggregation).
:::

## API Endpoints

### Create Continuous Query

Define a new continuous query:

```bash
POST /api/v1/continuous_queries
```

**Request Body**:
```json
{
  "name": "cpu_hourly_avg",
  "database": "telegraf",
  "source_measurement": "cpu",
  "destination_measurement": "cpu_hourly",
  "query": "SELECT time_bucket('1 hour', time) AS time, host, AVG(usage_idle) AS avg_usage_idle, AVG(usage_user) AS avg_usage_user, COUNT(*) AS sample_count FROM telegraf.cpu GROUP BY time_bucket('1 hour', time), host",
  "interval": "1h",
  "tag_columns": ["host"],
  "retention_policy": "90d",
  "is_active": true
}
```

**Parameters**:
- `name` (string, required): Unique query identifier
- `database` (string, required): Target database name
- `source_measurement` (string, required): Source measurement to aggregate
- `destination_measurement` (string, required): Where to store results
- `query` (string, required): DuckDB SQL aggregation query
- `interval` (string, required): Time bucket interval (`1m`, `5m`, `1h`, `1d`, etc.)
- `tag_columns` (array of strings, optional): The **grouping dimension** columns in the query's output (e.g. `["host"]` for `GROUP BY host`). See [Idempotency and `tag_columns`](#idempotency-and-tag_columns) below — set this for any `GROUP BY` query so re-runs don't produce duplicate rows.
- `retention_policy` (string, optional): Retention for aggregated data (e.g., `90d`, `365d`)
- `is_active` (boolean, required): Enable/disable the query

#### Idempotency and `tag_columns`

Continuous-query output is made idempotent by Arc's compaction step: duplicate emissions of the same window (from a retry, an overlapping manual run, or a crash between the write and the watermark advance) are collapsed to one row per `(grouping dimensions, time)` when the destination partition compacts.

For this to work, Arc must know which output columns are the grouping dimensions:

- **A query with `GROUP BY <dimension>`** (e.g. `GROUP BY host`) must list those dimensions in `tag_columns` (e.g. `"tag_columns": ["host"]`). Arc writes them as Parquet tag metadata and dedups on `(tags, time)`.
- **A query with no grouping** (one row per window, e.g. `SELECT AVG(x) …`) needs no `tag_columns` — Arc detects it produces one row per timestamp and dedups on time automatically.
- **If you group but forget to declare `tag_columns`**, Arc detects the multiple-rows-per-timestamp output and does **not** dedup it (to avoid deleting distinct series). The query still runs and its rows are correct, but duplicate windows will accumulate; a warning is logged asking you to add `tag_columns`.

`tag_columns` may not include `time` (time is always part of the dedup key). Names must be plain identifiers (letters, digits, `_`, `-`). Output-row timestamps are stamped with the window's start time; a query that does not select a `time` column now gets the correct window timestamp instead of the ingestion wall-clock.

:::note Upgrading existing CQs
This is not a breaking change. Existing continuous queries keep running with no action — the CQ database is migrated automatically and `tag_columns` is optional. Add `tag_columns` to a grouped CQ when you want its duplicate windows to collapse; until you do, it behaves exactly as before (append-only). Note that a CQ which does **not** select a `time` column now stamps output with the window start rather than the ingestion wall-clock, so its destination has a one-time timestamp discontinuity at the upgrade.
:::

### List Continuous Queries

Retrieve all continuous queries:

```bash
GET /api/v1/continuous_queries
```

**Response**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "cpu_hourly_avg",
    "database": "telegraf",
    "source_measurement": "cpu",
    "destination_measurement": "cpu_hourly",
    "interval": "1h",
    "tag_columns": ["host"],
    "retention_policy": "90d",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "last_executed_at": "2024-01-20T02:00:00Z"
  }
]
```

### Get Single Query

Retrieve a specific continuous query:

```bash
GET /api/v1/continuous_queries/{query_id}
```

### Update Continuous Query

Update an existing continuous query:

```bash
PUT /api/v1/continuous_queries/{query_id}
```

**Request Body**: Same as create query

### Delete Continuous Query

Remove a continuous query:

```bash
DELETE /api/v1/continuous_queries/{query_id}
```

:::caution
Deleting a continuous query does not delete the destination measurement or its data. The aggregated data remains queryable.
:::

### Execute Continuous Query

Manually trigger a continuous query:

```bash
POST /api/v1/continuous_queries/{query_id}/execute
```

**Request Body**:
```json
{
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-01-31T23:59:59Z",
  "dry_run": false
}
```

**Parameters**:
- `start_time` (string, required): Start timestamp (ISO 8601 format)
- `end_time` (string, required): End timestamp (ISO 8601 format)
- `dry_run` (boolean, optional): Test without writing data (default: `false`)

**Response**:
```json
{
  "query_id": "550e8400-e29b-41d4-a716-446655440000",
  "rows_processed": 1000000,
  "rows_written": 720,
  "execution_time_ms": 2500,
  "time_range": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "dry_run": false
}
```

### View Execution History

View past executions of a continuous query:

```bash
GET /api/v1/continuous_queries/{query_id}/executions?limit=50
```

**Response**:
```json
[
  {
    "execution_id": "abc123",
    "executed_at": "2024-01-20T02:00:00Z",
    "start_time": "2024-01-19T00:00:00Z",
    "end_time": "2024-01-20T00:00:00Z",
    "rows_processed": 86400,
    "rows_written": 24,
    "execution_time_ms": 1200,
    "status": "success"
  }
]
```

## Query Syntax

Continuous queries use DuckDB SQL with temporal optimizations.

### Recommended Approach

Use `epoch_us()` for timestamp conversion and `date_trunc()` for time bucketing:

```sql
SELECT
    date_trunc('hour', epoch_us(time)) AS time,
    host,
    AVG(usage_idle) AS avg_usage_idle,
    MAX(usage_user) AS max_usage_user,
    MIN(usage_system) AS min_usage_system,
    COUNT(*) AS sample_count
FROM telegraf.cpu
GROUP BY date_trunc('hour', epoch_us(time)), host
```

### Common Aggregations

These are common examples. Arc runs the **full DuckDB SQL dialect** — any DuckDB aggregate works (e.g. `MEDIAN`, `MODE`, `QUANTILE_CONT`, `APPROX_QUANTILE`, `ARG_MAX`, `HISTOGRAM`, `CORR`, `REGR_*`). See the [Querying guide](/arc/guides/querying#useful-duckdb-functions) for more.

- `AVG()` - Average values
- `SUM()` - Sum of values
- `MIN()` - Minimum value
- `MAX()` - Maximum value
- `COUNT()` - Row count
- `STDDEV()` - Standard deviation
- `PERCENTILE_CONT()` - Percentile calculations

### Time Bucketing

**Using `date_trunc()`**:
```sql
-- Hourly buckets
date_trunc('hour', epoch_us(time))

-- Daily buckets
date_trunc('day', epoch_us(time))

-- 5-minute buckets (requires rounding)
date_trunc('hour', epoch_us(time)) + INTERVAL '5 minutes' * floor(extract(minute from epoch_us(time)) / 5)
```

### Including Sample Counts

Always include `COUNT(*)` to track how many raw samples each aggregate represents:

```sql
SELECT
    date_trunc('hour', epoch_us(time)) AS time,
    host,
    AVG(usage_idle) AS avg_usage_idle,
    COUNT(*) AS sample_count  -- Important for data quality
FROM telegraf.cpu
GROUP BY date_trunc('hour', epoch_us(time)), host
```

## Usage Examples

### Example 1: Hourly CPU Metrics

Aggregate per-second CPU metrics into hourly averages:

```python
import requests

# Create continuous query
response = requests.post(
    "http://localhost:8000/api/v1/continuous_queries",
    headers={"Authorization": "Bearer $ARC_TOKEN"},
    json={
        "name": "cpu_hourly",
        "database": "telegraf",
        "source_measurement": "cpu",
        "destination_measurement": "cpu_hourly",
        "query": """
            SELECT
                date_trunc('hour', epoch_us(time)) AS time,
                host,
                AVG(usage_idle) AS avg_usage_idle,
                AVG(usage_user) AS avg_usage_user,
                AVG(usage_system) AS avg_usage_system,
                MAX(usage_user) AS max_usage_user,
                COUNT(*) AS sample_count
            FROM telegraf.cpu
            GROUP BY date_trunc('hour', epoch_us(time)), host
        """,
        "interval": "1h",
        "tag_columns": ["host"],  # grouping dimension → idempotent output
        "retention_policy": "365d",
        "is_active": True
    }
)

query_id = response.json()["id"]

# Execute for the last 30 days
from datetime import datetime, timedelta

end_time = datetime.utcnow()
start_time = end_time - timedelta(days=30)

result = requests.post(
    f"http://localhost:8000/api/v1/continuous_queries/{query_id}/execute",
    headers={"Authorization": "Bearer $ARC_TOKEN"},
    json={
        "start_time": start_time.isoformat() + "Z",
        "end_time": end_time.isoformat() + "Z"
    }
)

print(f"Processed {result.json()['rows_processed']} rows")
print(f"Generated {result.json()['rows_written']} aggregated rows")
```

### Example 2: Daily Request Summary

Aggregate API request logs into daily summaries:

```python
# Create daily request summary
response = requests.post(
    "http://localhost:8000/api/v1/continuous_queries",
    headers={"Authorization": "Bearer $ARC_TOKEN"},
    json={
        "name": "requests_daily",
        "database": "logs",
        "source_measurement": "api_requests",
        "destination_measurement": "api_requests_daily",
        "query": """
            SELECT
                date_trunc('day', epoch_us(time)) AS time,
                endpoint,
                status_code,
                COUNT(*) AS total_requests,
                AVG(response_time_ms) AS avg_response_time,
                MAX(response_time_ms) AS max_response_time,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_response_time
            FROM api_requests
            GROUP BY date_trunc('day', epoch_us(time)), endpoint, status_code
        """,
        "interval": "1d",
        "tag_columns": ["endpoint", "status_code"],  # grouping dimensions → idempotent output
        "retention_policy": "730d",  # 2 years
        "is_active": True
    }
)
```

### Example 3: 5-Minute Sensor Readings

Downsample IoT sensor data to 5-minute intervals:

```python
# Create 5-minute sensor aggregation
response = requests.post(
    "http://localhost:8000/api/v1/continuous_queries",
    headers={"Authorization": "Bearer $ARC_TOKEN"},
    json={
        "name": "sensors_5min",
        "database": "iot",
        "source_measurement": "temperature",
        "destination_measurement": "temperature_5min",
        "query": """
            SELECT
                date_trunc('hour', epoch_us(time)) +
                INTERVAL '5 minutes' * floor(extract(minute from epoch_us(time)) / 5) AS time,
                sensor_id,
                location,
                AVG(temperature) AS avg_temperature,
                MIN(temperature) AS min_temperature,
                MAX(temperature) AS max_temperature,
                COUNT(*) AS sample_count
            FROM temperature
            GROUP BY
                date_trunc('hour', epoch_us(time)) +
                INTERVAL '5 minutes' * floor(extract(minute from epoch_us(time)) / 5),
                sensor_id,
                location
        """,
        "interval": "5m",
        "tag_columns": ["sensor_id", "location"],  # grouping dimensions → idempotent output
        "retention_policy": "90d",
        "is_active": True
    }
)
```

### Example 4: Dry Run Testing

Test a continuous query before execution:

```python
# Create the query
response = requests.post(
    "http://localhost:8000/api/v1/continuous_queries",
    headers={"Authorization": "Bearer $ARC_TOKEN"},
    json={...}
)

query_id = response.json()["id"]

# Test with dry run
dry_run = requests.post(
    f"http://localhost:8000/api/v1/continuous_queries/{query_id}/execute",
    headers={"Authorization": "Bearer $ARC_TOKEN"},
    json={
        "start_time": "2024-01-01T00:00:00Z",
        "end_time": "2024-01-02T00:00:00Z",
        "dry_run": True
    }
)

print(f"Would process {dry_run.json()['rows_processed']} rows")
print(f"Would generate {dry_run.json()['rows_written']} aggregated rows")

# If satisfied, execute for real
if dry_run.json()['rows_written'] > 0:
    result = requests.post(
        f"http://localhost:8000/api/v1/continuous_queries/{query_id}/execute",
        headers={"Authorization": "Bearer $ARC_TOKEN"},
        json={
            "start_time": "2024-01-01T00:00:00Z",
            "end_time": "2024-01-02T00:00:00Z",
            "dry_run": False
        }
    )
```

## Storage Benefits

Continuous queries significantly reduce storage requirements:

### Before Downsampling

**Raw CPU metrics** (1-second intervals):
- 1 year = 31,536,000 rows per host
- 10 hosts = 315,360,000 rows
- Storage: ~20GB

### After Downsampling to Hourly

**Hourly aggregates**:
- 1 year = 8,760 rows per host
- 10 hosts = 87,600 rows
- Storage: ~50MB

**Reduction**: ~400x smaller while maintaining hourly trend visibility.

### Multi-Tier Strategy

Combine different granularities for optimal storage:

```python
# Tier 1: Keep raw data for 7 days
# Tier 2: Hourly aggregates for 90 days
requests.post("/api/v1/continuous_queries", json={
    "name": "cpu_hourly",
    "interval": "1h",
    "retention_policy": "90d"
})

# Tier 3: Daily aggregates for 2 years
requests.post("/api/v1/continuous_queries", json={
    "name": "cpu_daily",
    "source_measurement": "cpu_hourly",  # Aggregate the hourly data
    "destination_measurement": "cpu_daily",
    "interval": "1d",
    "retention_policy": "730d"
})

# Use retention policy to delete raw data after 7 days
requests.post("/api/v1/retention", json={
    "database": "telegraf",
    "measurement": "cpu",
    "retention_days": 7
})
```

## Best Practices

### 1. Start Conservative

Begin with longer intervals and adjust based on actual needs:

```python
# Start with hourly
{"interval": "1h"}

# If too coarse, reduce to 15 minutes
{"interval": "15m"}
```

### 2. Preserve Source Data Initially

Keep raw data while testing aggregations:

```python
# Create continuous query
create_query(...)

# Test aggregations thoroughly
execute_dry_run(...)
execute_for_real(...)

# Only after validation, apply retention to raw data
requests.post("/api/v1/retention", json={
    "measurement": "cpu",
    "retention_days": 30  # Keep raw for 30 days
})
```

### 3. Use Dry Run Extensively

Always test queries with dry run before full execution:

```python
# Test on small time range first
dry_run(start="2024-01-01", end="2024-01-02")

# Gradually expand
dry_run(start="2024-01-01", end="2024-01-07")

# Finally, full execution
execute(start="2024-01-01", end="2024-12-31")
```

### 4. Include Sample Counts

Track the number of raw samples in each aggregate:

```sql
SELECT
    date_trunc('hour', epoch_us(time)) AS time,
    COUNT(*) AS sample_count,  -- Essential for data quality
    AVG(value) AS avg_value
FROM measurement
GROUP BY date_trunc('hour', epoch_us(time))
```

This helps identify:
- Missing data (low sample counts)
- Data quality issues
- Unexpected patterns

### 5. Monitor Execution Performance

Track continuous query execution times:

```python
result = execute_query(...)

print(f"Execution time: {result['execution_time_ms']}ms")
print(f"Throughput: {result['rows_processed'] / (result['execution_time_ms'] / 1000):.0f} rows/sec")

# Alert if execution takes too long
if result['execution_time_ms'] > 60000:  # 1 minute
    print("Warning: Slow execution!")
```

### 6. Use Appropriate Intervals

Match intervals to data characteristics:

**High-Frequency Data** (IoT sensors at 1-second intervals):
- 5-minute aggregates for recent analysis
- Hourly aggregates for medium-term
- Daily aggregates for long-term trends

**Medium-Frequency Data** (Application metrics at 1-minute intervals):
- Hourly aggregates for recent analysis
- Daily aggregates for long-term

**Low-Frequency Data** (Business metrics at hourly intervals):
- Daily aggregates
- Monthly aggregates for multi-year analysis

## Troubleshooting

### No Rows Written

**Problem**: Execution returns `rows_written: 0`.

**Solutions**:
- Verify source measurement contains data in the specified time range
- Check that the query syntax is correct
- Ensure `GROUP BY` clause matches aggregation columns
- Use dry run to inspect query results

### Query Syntax Errors

**Problem**: Execution fails with SQL error.

**Solutions**:
- Test the query directly using the `/query` endpoint
- Verify column names exist in source measurement
- Check for DuckDB-specific syntax requirements
- Use `epoch_us()` for timestamp conversion

### Slow Execution

**Problem**: Continuous query takes longer than expected.

**Solutions**:
- Reduce the time range per execution
- Ensure source measurement is properly compacted
- Consider creating indexes on frequently grouped columns
- Monitor DuckDB query performance

### Duplicate Data

**Problem**: Re-running the query creates duplicate aggregates.

**Solutions**:
- Delete destination measurement data before re-execution:
  ```python
  requests.post("/api/v1/delete", json={
      "database": "telegraf",
      "measurement": "cpu_hourly",
      "where": f"time >= '{start_time}' AND time <= '{end_time}'"
  })
  ```
- Or use `UPSERT` semantics if supported (future feature)

## Related Topics

- [Retention Policies](/arc/data-lifecycle/retention-policies) - Automatically delete old raw data after downsampling
- [Delete Operations](/arc/data-lifecycle/delete-operations) - Manually remove data ranges
- [Compaction](/arc/advanced/compaction) - Optimize file structure for better query performance
