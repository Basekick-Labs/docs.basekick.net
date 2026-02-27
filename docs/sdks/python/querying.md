---
sidebar_position: 4
---

# Querying

How to query time-series data from Arc using the Python SDK.

## Overview

The SDK provides multiple query methods, each returning data in a different format:

| Method | Returns | Best For | Performance |
|--------|---------|----------|-------------|
| `query()` | `QueryResult` object | Simple queries, inspection | Good |
| `query_pandas()` | pandas DataFrame | Data science, notebooks | Good |
| `query_polars()` | polars DataFrame | Large datasets, performance | Better |
| `query_arrow()` | PyArrow Table | Zero-copy, interop | Best |

All query methods are available on `client.query`.

## SQL Syntax

Arc uses SQL with the table syntax `database.measurement`:

```sql
SELECT * FROM default.cpu WHERE host = 'server01'
```

Arc is powered by DuckDB, so you have access to DuckDB's full SQL capabilities including:
- Window functions
- CTEs (Common Table Expressions)
- `time_bucket()` for time-series aggregation
- JSON functions
- And more

## Basic Query (JSON)

The simplest way to query data. Returns a `QueryResult` object with columns and data.

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    result = client.query.query(
        "SELECT * FROM default.cpu WHERE time > now() - INTERVAL '1 hour' LIMIT 100"
    )

    print(f"Columns: {result.columns}")
    print(f"Row count: {result.row_count}")

    for row in result.data:
        print(row)
```

### QueryResult Object

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `list[str]` | Column names |
| `data` | `list[list]` | Rows as nested lists |
| `row_count` | `int` | Number of rows returned |

### When to Use

✅ **Use `query()` when:**
- You need to inspect results quickly
- Working with small result sets
- Don't need DataFrame functionality

❌ **Don't use when:**
- Processing large datasets (use Arrow)
- Need DataFrame operations (use pandas/polars)

## pandas DataFrame

Returns query results as a pandas DataFrame. Requires `pip install arc-tsdb-client[pandas]`.

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    df = client.query.query_pandas(
        "SELECT * FROM default.cpu WHERE host = 'server01' LIMIT 1000"
    )

    print(df.head())
    print(df.dtypes)

    # Use pandas operations
    avg_by_host = df.groupby("host")["usage_idle"].mean()
    print(avg_by_host)
```

### How It Works

1. Query is sent to Arc
2. Results are returned as Arrow IPC stream
3. Arrow data is converted to pandas DataFrame (zero-copy where possible)

### When to Use

✅ **Use `query_pandas()` when:**
- Working in Jupyter notebooks
- Need pandas-specific operations
- Integrating with pandas-based tools (matplotlib, seaborn, scikit-learn)

❌ **Don't use when:**
- Processing very large datasets (polars is faster)
- Memory is constrained (polars uses less memory)

## Polars DataFrame

Returns query results as a polars DataFrame. Requires `pip install arc-tsdb-client[polars]`.

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    df = client.query.query_polars(
        "SELECT * FROM default.cpu LIMIT 100000"
    )

    print(df.head())

    # Use polars operations (lazy evaluation, parallel execution)
    result = (
        df.lazy()
        .filter(pl.col("usage_idle") > 90)
        .group_by("host")
        .agg(pl.col("usage_idle").mean().alias("avg_idle"))
        .collect()
    )
    print(result)
```

### Why Polars?

Polars is a DataFrame library written in Rust that offers:
- **Faster operations**: Especially for large datasets
- **Lower memory usage**: Efficient memory layout
- **Lazy evaluation**: Optimize query plans before execution
- **Parallel execution**: Uses all CPU cores automatically

### When to Use

✅ **Use `query_polars()` when:**
- Processing large datasets (100K+ rows)
- Performance is critical
- You prefer polars' API
- Running in production pipelines

❌ **Don't use when:**
- Need pandas compatibility for downstream tools
- Working in environments that only support pandas

## PyArrow Table (Zero-Copy)

Returns query results as a PyArrow Table. This is the most efficient option for large datasets.

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    table = client.query.query_arrow(
        "SELECT * FROM default.cpu LIMIT 1000000"
    )

    print(f"Rows: {table.num_rows}")
    print(f"Columns: {table.num_columns}")
    print(f"Schema: {table.schema}")

    # Convert to pandas (zero-copy where possible)
    df = table.to_pandas()

    # Convert to polars
    import polars as pl
    df = pl.from_arrow(table)

    # Save to Parquet
    import pyarrow.parquet as pq
    pq.write_table(table, "output.parquet")
```

### Why Arrow?

Apache Arrow is a columnar memory format that enables:
- **Zero-copy reads**: Data stays in the same memory layout
- **Interoperability**: Share data between pandas, polars, DuckDB, Spark
- **Efficient serialization**: Arrow IPC format is compact and fast

### When to Use

✅ **Use `query_arrow()` when:**
- Processing very large datasets
- Need to pass data to multiple tools
- Saving results to Parquet files
- Maximum performance is required

## Query Estimation

Preview the cost of a query before executing it:

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    estimate = client.query.estimate(
        "SELECT * FROM default.cpu WHERE time > now() - INTERVAL '30 days'"
    )

    print(f"Estimated rows: {estimate.estimated_rows}")
    print(f"Warning level: {estimate.warning_level}")  # none, low, medium, high

    if estimate.warning_level == "high":
        print("Consider adding filters or LIMIT clause")
```

### Estimate Result

| Property | Type | Description |
|----------|------|-------------|
| `estimated_rows` | `int` | Approximate row count |
| `warning_level` | `str` | `none`, `low`, `medium`, `high` |

## List Measurements

Discover what measurements exist in a database:

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    measurements = client.query.list_measurements(database="default")

    for m in measurements:
        print(f"{m.measurement}:")
        print(f"  Files: {m.file_count}")
        print(f"  Size: {m.total_size_mb:.1f} MB")
```

## Common Query Patterns

### Time-Series Aggregation

Use `time_bucket()` to aggregate data into time intervals:

```python
df = client.query.query_pandas("""
    SELECT
        time_bucket(INTERVAL '5 minutes', time) as bucket,
        host,
        AVG(usage_idle) as avg_idle,
        MAX(usage_system) as max_system,
        COUNT(*) as samples
    FROM default.cpu
    WHERE time > now() - INTERVAL '1 hour'
    GROUP BY bucket, host
    ORDER BY bucket DESC
""")
```

### Latest Value Per Host

```python
df = client.query.query_pandas("""
    SELECT DISTINCT ON (host)
        time, host, usage_idle, usage_system
    FROM default.cpu
    ORDER BY host, time DESC
""")
```

### Percentiles

```python
df = client.query.query_pandas("""
    SELECT
        host,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY usage_idle) as p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY usage_idle) as p95,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY usage_idle) as p99
    FROM default.cpu
    WHERE time > now() - INTERVAL '24 hours'
    GROUP BY host
""")
```

### Join Measurements

```python
df = client.query.query_pandas("""
    SELECT
        c.time,
        c.host,
        c.usage_idle as cpu_idle,
        m.used_percent as mem_used
    FROM default.cpu c
    JOIN default.mem m
        ON c.time = m.time AND c.host = m.host
    WHERE c.time > now() - INTERVAL '10 minutes'
    ORDER BY c.time DESC
""")
```

## Async Queries

All query methods have async equivalents:

```python
import asyncio
from arc_client import AsyncArcClient

async def main():
    async with AsyncArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
        # JSON result
        result = await client.query.query("SELECT * FROM default.cpu LIMIT 10")

        # pandas DataFrame
        df = await client.query.query_pandas("SELECT * FROM default.cpu LIMIT 1000")

        # Polars DataFrame
        pl_df = await client.query.query_polars("SELECT * FROM default.cpu LIMIT 1000")

        # Arrow Table
        table = await client.query.query_arrow("SELECT * FROM default.cpu LIMIT 10000")

asyncio.run(main())
```

### Concurrent Queries

Run multiple queries in parallel:

```python
import asyncio
from arc_client import AsyncArcClient

async def main():
    async with AsyncArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
        # Run queries concurrently
        cpu_task = client.query.query_pandas("SELECT * FROM default.cpu LIMIT 1000")
        mem_task = client.query.query_pandas("SELECT * FROM default.mem LIMIT 1000")
        disk_task = client.query.query_pandas("SELECT * FROM default.disk LIMIT 1000")

        cpu_df, mem_df, disk_df = await asyncio.gather(cpu_task, mem_task, disk_task)

        print(f"CPU: {len(cpu_df)} rows")
        print(f"Memory: {len(mem_df)} rows")
        print(f"Disk: {len(disk_df)} rows")

asyncio.run(main())
```

## Error Handling

```python
from arc_client import ArcClient
from arc_client.exceptions import (
    ArcQueryError,
    ArcConnectionError,
    ArcAuthenticationError,
)

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    try:
        df = client.query.query_pandas("SELECT * FROM nonexistent.table")
    except ArcQueryError as e:
        print(f"Query failed: {e}")  # Invalid SQL or table not found
    except ArcAuthenticationError as e:
        print(f"Auth failed: {e}")  # Invalid token
    except ArcConnectionError as e:
        print(f"Connection error: {e}")  # Server unreachable
```

## Performance Tips

### 1. Filter Early

Push filters to Arc rather than filtering in Python:

```python
# ✅ Good: Filter in SQL
df = client.query.query_pandas("""
    SELECT * FROM default.cpu
    WHERE time > now() - INTERVAL '1 hour'
    AND host = 'server01'
""")

# ❌ Bad: Fetch all, filter in Python
df = client.query.query_pandas("SELECT * FROM default.cpu")
df = df[df["host"] == "server01"]
```

### 2. Select Only Needed Columns

```python
# ✅ Good: Select specific columns
df = client.query.query_pandas("""
    SELECT time, host, usage_idle FROM default.cpu
""")

# ❌ Bad: Select all columns
df = client.query.query_pandas("SELECT * FROM default.cpu")
```

### 3. Use LIMIT for Exploration

```python
# ✅ Good: Limit during exploration
df = client.query.query_pandas("SELECT * FROM default.cpu LIMIT 100")
```

### 4. Use Arrow for Large Results

```python
# For 100K+ rows, Arrow is significantly faster
table = client.query.query_arrow("SELECT * FROM default.cpu")
df = table.to_pandas()  # Zero-copy conversion
```

## Next Steps

- **[Data Management](/arc/sdks/python/data-management)** - Retention, CQs, and deletion
- **[Data Ingestion](/arc/sdks/python/ingestion)** - Write data to Arc
- **[API Reference](/arc/api-reference/overview)** - Raw REST API documentation
