---
sidebar_position: 3
---

# Data Ingestion

How to write time-series data to Arc using the Python SDK.

## Overview

The SDK provides multiple ways to ingest data, each optimized for different use cases:

| Method | Best For | Performance | Format |
|--------|----------|-------------|--------|
| `write_columnar()` | High-throughput ingestion | 9M+ records/sec | MessagePack columnar |
| `write_dataframe()` | pandas/polars workflows | 5M+ records/sec | MessagePack columnar |
| `buffered()` | Streaming data | Auto-batched | MessagePack columnar |
| `write_line_protocol()` | InfluxDB compatibility | 1M+ records/sec | Line protocol text |

All write methods are available on `client.write`.

## Columnar Format (Recommended)

The fastest way to write data. Data is organized by columns (like a DataFrame) rather than rows, which enables efficient compression and fast serialization.

### Basic Usage

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    client.write.write_columnar(
        measurement="cpu",
        columns={
            "time": [1704067200000000, 1704067260000000, 1704067320000000],
            "host": ["server01", "server01", "server01"],
            "region": ["us-east", "us-east", "us-east"],
            "usage_idle": [95.2, 94.8, 93.1],
            "usage_system": [2.1, 2.5, 3.2],
            "usage_user": [2.7, 2.7, 3.7],
        },
    )
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `measurement` | `str` | Yes | Name of the measurement (like a table) |
| `columns` | `dict` | Yes | Column name → list of values |
| `database` | `str` | No | Target database (default: client's database) |

### Column Types

The SDK automatically handles type conversion:

| Python Type | Arc Type | Example |
|-------------|----------|---------|
| `int` | Integer | `[1, 2, 3]` |
| `float` | Float | `[1.5, 2.7, 3.9]` |
| `str` | String (tag or field) | `["a", "b", "c"]` |
| `bool` | Boolean | `[True, False, True]` |
| `datetime` | Timestamp (microseconds) | `[datetime.now()]` |

### Timestamps

The `time` column should contain **microsecond timestamps** (Unix epoch):

```python
import time
from datetime import datetime

# From current time
timestamp_us = int(time.time() * 1_000_000)

# From datetime
timestamp_us = int(datetime.now().timestamp() * 1_000_000)

# Multiple timestamps
timestamps = [
    1704067200000000,  # 2024-01-01 00:00:00 UTC
    1704067260000000,  # 2024-01-01 00:01:00 UTC
    1704067320000000,  # 2024-01-01 00:02:00 UTC
]
```

### Tags vs Fields

In time-series databases:
- **Tags** are indexed string columns used for filtering (e.g., `host`, `region`, `sensor_id`)
- **Fields** are the actual metric values (e.g., `temperature`, `cpu_usage`, `count`)

For `write_columnar()`, all columns are sent directly to Arc. Tag/field distinction is handled by the Arc server based on its schema detection.

For `write_dataframe()`, you can explicitly specify which columns are tags using the `tag_columns` parameter.

## DataFrame Ingestion

Write directly from pandas or polars DataFrames. The SDK converts DataFrames to columnar format automatically.

### pandas Example

```python
import pandas as pd
from arc_client import ArcClient

# Create a DataFrame
df = pd.DataFrame({
    "time": pd.date_range("2024-01-01", periods=100, freq="1min"),
    "host": ["server-01"] * 50 + ["server-02"] * 50,
    "region": ["us-east"] * 100,
    "cpu_usage": [50 + i * 0.1 for i in range(100)],
    "memory_mb": [1024 + i for i in range(100)],
})

with ArcClient(host="localhost", token="your-token") as client:
    client.write.write_dataframe(
        df,
        measurement="server_metrics",
        time_column="time",           # Column containing timestamps
        tag_columns=["host", "region"],  # Columns to treat as tags
    )
    print(f"Wrote {len(df)} rows")
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `df` | DataFrame | Yes | pandas or polars DataFrame |
| `measurement` | `str` | Yes | Target measurement name |
| `time_column` | `str` | Yes | Name of the timestamp column |
| `tag_columns` | `list[str]` | No | Columns to treat as indexed tags |
| `database` | `str` | No | Target database |

### Polars Example

```python
import polars as pl
from arc_client import ArcClient

df = pl.DataFrame({
    "time": pl.datetime_range(
        datetime(2024, 1, 1),
        datetime(2024, 1, 1, 1),
        interval="1m",
        eager=True
    ),
    "sensor_id": ["sensor-001"] * 61,
    "temperature": [20.0 + i * 0.1 for i in range(61)],
})

with ArcClient(host="localhost", token="your-token") as client:
    client.write.write_dataframe(
        df,
        measurement="temperatures",
        time_column="time",
        tag_columns=["sensor_id"],
    )
```

## Buffered Writes

For streaming or high-throughput scenarios, use buffered writes. The buffer automatically batches records and flushes them efficiently.

### Basic Usage

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    with client.write.buffered(batch_size=5000, flush_interval=2.0) as buffer:
        for i in range(50000):
            buffer.write(
                measurement="events",
                tags={"source": "sensor-001", "type": "temperature"},
                fields={"value": 22.5 + i * 0.01},
                timestamp=1704067200000000 + (i * 1000),
            )
        # Auto-flushes on exit
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `batch_size` | `int` | 5000 | Flush after N records |
| `flush_interval` | `float` | 5.0 | Flush after N seconds (even if batch not full) |

### How It Works

1. Records are queued in memory
2. When `batch_size` is reached OR `flush_interval` expires, the buffer flushes
3. On context manager exit, any remaining records are flushed
4. Uses columnar format internally for best performance

### When to Use Buffered Writes

✅ **Use buffered writes when:**
- Processing streaming data (sensors, logs, events)
- Ingesting data in a loop
- You don't know the batch size ahead of time

❌ **Don't use buffered writes when:**
- You already have data in columnar format or DataFrame
- You're writing a single batch (use `write_columnar()` directly)

### Async Buffered Writes

```python
import asyncio
from arc_client import AsyncArcClient

async def ingest_stream():
    async with AsyncArcClient(host="localhost", token="your-token") as client:
        async with client.write.buffered(batch_size=5000) as buffer:
            async for event in event_stream():
                await buffer.write(
                    measurement="events",
                    tags={"source": event.source},
                    fields={"value": event.value},
                    timestamp=event.timestamp,
                )

asyncio.run(ingest_stream())
```

## Line Protocol

For compatibility with InfluxDB tooling (Telegraf, etc.), use line protocol format.

### Basic Usage

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    # Single line
    client.write.write_line_protocol(
        "cpu,host=server01,region=us-east usage_idle=95.2 1704067200000000000"
    )

    # Multiple lines
    lines = [
        "cpu,host=server01 usage_idle=95.2,usage_system=2.1",
        "cpu,host=server02 usage_idle=87.5,usage_system=4.3",
        "mem,host=server01 used_percent=45.2",
    ]
    client.write.write_line_protocol(lines)
```

### Line Protocol Format

```
<measurement>,<tag_key>=<tag_value>,... <field_key>=<field_value>,... [timestamp]
```

Example breakdown:
```
cpu,host=server01,region=us-east usage_idle=95.2,usage_system=2.1 1704067200000000000
│   │                            │                                │
│   │                            │                                └── timestamp (nanoseconds)
│   │                            └── fields (space-separated from tags)
│   └── tags (comma-separated)
└── measurement name
```

### When to Use Line Protocol

✅ **Use line protocol when:**
- Integrating with Telegraf or other InfluxDB tools
- Migrating from InfluxDB
- You already have data in line protocol format

❌ **Don't use line protocol when:**
- Building new applications (use columnar format)
- Performance is critical (columnar is 8x faster)

## Async Ingestion

All write methods have async equivalents:

```python
import asyncio
from arc_client import AsyncArcClient

async def main():
    async with AsyncArcClient(host="localhost", token="your-token") as client:
        # Columnar write
        await client.write.write_columnar(
            measurement="cpu",
            columns={
                "time": [1704067200000000],
                "host": ["server01"],
                "usage": [45.2],
            },
        )

        # DataFrame write
        await client.write.write_dataframe(
            df, measurement="metrics", time_column="time"
        )

        # Line protocol
        await client.write.write_line_protocol("cpu,host=server01 usage=45.2")

asyncio.run(main())
```

## Error Handling

```python
from arc_client import ArcClient
from arc_client.exceptions import (
    ArcIngestionError,
    ArcValidationError,
    ArcConnectionError,
)

with ArcClient(host="localhost", token="your-token") as client:
    try:
        client.write.write_columnar(
            measurement="cpu",
            columns={"time": [1], "value": [1.0]},
        )
    except ArcValidationError as e:
        print(f"Invalid data: {e}")
    except ArcIngestionError as e:
        print(f"Write failed: {e}")
    except ArcConnectionError as e:
        print(f"Connection error: {e}")
```

## Best Practices

### 1. Batch Your Data

Send multiple rows per request rather than one at a time:

```python
# ✅ Good: Batch write
client.write.write_columnar(
    measurement="cpu",
    columns={
        "time": [t1, t2, t3, ...],  # 1000+ values
        "host": [h1, h2, h3, ...],
        "value": [v1, v2, v3, ...],
    },
)

# ❌ Bad: Individual writes
for record in records:
    client.write.write_columnar(
        measurement="cpu",
        columns={
            "time": [record.time],
            "host": [record.host],
            "value": [record.value],
        },
    )
```

### 2. Use Appropriate Batch Sizes

- **Small batches** (100-1000): Lower latency, more HTTP overhead
- **Medium batches** (1000-10000): Good balance for most use cases
- **Large batches** (10000+): Best throughput, higher memory usage

### 3. Handle Backpressure

For high-throughput scenarios, implement backpressure handling:

```python
import time

def write_with_backoff(client, data, max_retries=3):
    for attempt in range(max_retries):
        try:
            client.write.write_columnar(**data)
            return
        except ArcIngestionError as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

## Next Steps

- **[Querying](/docs/sdks/python/querying)** - Query data and work with DataFrames
- **[Data Management](/docs/sdks/python/data-management)** - Retention, CQs, and deletion
- **[API Reference](/docs/api-reference/overview)** - Raw REST API documentation
