---
sidebar_position: 1
---

# SQL Querying Guide

Arc uses DuckDB as its SQL engine, giving you full analytical SQL capabilities on time-series data stored as Parquet files.

## SQL Syntax

Queries use the format `database.measurement` as the table name:

```sql
SELECT * FROM mydb.cpu LIMIT 10
```

If your database is named `default`, you can omit it:

```sql
SELECT * FROM default.cpu LIMIT 10
```

## Query Endpoints

| Endpoint | Response Format | Best For |
|----------|----------------|----------|
| `POST /api/v1/query` | JSON | Small results, debugging, dashboards |
| `POST /api/v1/query/arrow` | Apache Arrow IPC | Large results (2.64M rows/sec) |
| `GET /api/v1/query/:measurement` | JSON | Quick measurement queries |

### JSON Query

```bash
curl -X POST "http://localhost:8000/api/v1/query" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM default.cpu WHERE time > NOW() - INTERVAL '\''1 hour'\'' LIMIT 100"}'
```

### Arrow Query

For large result sets, Arrow IPC provides ~2x throughput vs JSON:

```bash
curl -X POST "http://localhost:8000/api/v1/query/arrow" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM default.cpu LIMIT 1000000"}' \
  -o results.arrow
```

## Time Filtering

Arc stores timestamps in the `time` column. Use standard SQL intervals for time-range queries:

```sql
-- Last hour
SELECT * FROM default.cpu
WHERE time > NOW() - INTERVAL '1 hour';

-- Last 7 days
SELECT * FROM default.cpu
WHERE time > NOW() - INTERVAL '7 days';

-- Specific date range
SELECT * FROM default.cpu
WHERE time BETWEEN '2026-01-01' AND '2026-01-31';
```

:::tip Partition Pruning
Time-range filters using the `time` column automatically trigger partition pruning, skipping Parquet files outside the range. Always include a time filter for best performance.
:::

## Time-Series Aggregation

### time_bucket

Group data into fixed-size time intervals:

```sql
-- Hourly averages for the last 7 days
SELECT
  time_bucket('1 hour', time) AS bucket,
  AVG(cpu_usage) AS avg_cpu,
  MAX(cpu_usage) AS max_cpu,
  COUNT(*) AS samples
FROM default.cpu
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY bucket
ORDER BY bucket;
```

### date_trunc

Truncate timestamps to calendar boundaries:

```sql
-- Daily summary for the last 30 days
SELECT
  date_trunc('day', time) AS day,
  host,
  AVG(cpu_usage) AS avg_cpu,
  AVG(mem_usage) AS avg_mem
FROM default.cpu
WHERE time > NOW() - INTERVAL '30 days'
GROUP BY day, host
ORDER BY day DESC, host;
```

## Window Functions

Compute rolling metrics and detect anomalies:

```sql
-- 10-minute moving average with anomaly detection
SELECT
  time,
  host,
  cpu_usage,
  AVG(cpu_usage) OVER (
    PARTITION BY host
    ORDER BY time
    ROWS BETWEEN 10 PRECEDING AND CURRENT ROW
  ) AS moving_avg,
  cpu_usage - AVG(cpu_usage) OVER (
    PARTITION BY host
    ORDER BY time
    ROWS BETWEEN 60 PRECEDING AND CURRENT ROW
  ) AS deviation
FROM default.cpu
WHERE time > NOW() - INTERVAL '1 hour';
```

## Common Table Expressions (CTEs)

Break complex queries into readable steps:

```sql
-- Find hosts with anomalous CPU spikes
WITH hourly_stats AS (
  SELECT
    host,
    time_bucket('1 hour', time) AS bucket,
    AVG(cpu_usage) AS avg_cpu,
    STDDEV(cpu_usage) AS std_cpu
  FROM default.cpu
  WHERE time > NOW() - INTERVAL '24 hours'
  GROUP BY host, bucket
),
anomalies AS (
  SELECT *
  FROM hourly_stats
  WHERE avg_cpu > 80 OR std_cpu > 20
)
SELECT host, bucket, avg_cpu, std_cpu
FROM anomalies
ORDER BY avg_cpu DESC;
```

## Cross-Database Queries

Join data across databases and measurements:

```sql
-- Join CPU metrics with deployment events
SELECT
  c.time,
  c.host,
  c.cpu_usage,
  d.version
FROM production.cpu c
JOIN production.deployments d
  ON c.host = d.host
  AND c.time BETWEEN d.time AND d.time + INTERVAL '1 hour'
WHERE c.time > NOW() - INTERVAL '24 hours';
```

## Useful DuckDB Functions

Arc supports all DuckDB functions. Here are the most useful for time-series data:

| Function | Description | Example |
|----------|-------------|---------|
| `NOW()` | Current timestamp | `WHERE time > NOW() - INTERVAL '1h'` |
| `time_bucket(interval, time)` | Fixed-size time buckets | `time_bucket('5 minutes', time)` |
| `date_trunc(part, time)` | Calendar truncation | `date_trunc('day', time)` |
| `epoch(time)` | Timestamp to epoch seconds | `epoch(time)` |
| `PERCENTILE_CONT(p)` | Percentile (continuous) | `PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency)` |
| `APPROX_QUANTILE(col, p)` | Approximate percentile (faster) | `APPROX_QUANTILE(latency, 0.99)` |
| `STDDEV(col)` | Standard deviation | `STDDEV(cpu_usage)` |
| `LAG(col) OVER (...)` | Previous row value | `LAG(value) OVER (ORDER BY time)` |
| `LEAD(col) OVER (...)` | Next row value | `LEAD(value) OVER (ORDER BY time)` |

## Performance Tips

1. **Always filter by time** -- Partition pruning skips entire Parquet files outside the range, often 10-100x faster.

2. **Use Arrow for large results** -- Arrow IPC provides ~2x throughput vs JSON for result sets over 100K rows.

3. **Limit result sets** -- Add `LIMIT` when exploring data. Scanning millions of rows without a limit is expensive.

4. **Use aggregations server-side** -- Compute `AVG`, `COUNT`, `SUM` in SQL rather than fetching raw rows and aggregating client-side.

5. **Prefer `APPROX_QUANTILE` over `PERCENTILE_CONT`** -- For large datasets, approximate percentiles are 10-100x faster.

6. **Use `time_bucket` over `date_trunc`** -- `time_bucket` supports arbitrary intervals (5 min, 15 min, 4 hours) while `date_trunc` is limited to calendar boundaries.

## Next Steps

- **[API Reference](/arc/api-reference/overview)** -- Full endpoint documentation
- **[Python SDK Querying](/arc/sdks/python/querying)** -- Query with pandas, polars, and PyArrow
- **[Retention Policies](/arc/data-lifecycle/retention-policies)** -- Automatic data expiration
- **[Continuous Queries](/arc/data-lifecycle/continuous-queries)** -- Real-time aggregations and downsampling
