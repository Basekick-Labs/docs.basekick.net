---
sidebar_position: 1
slug: /
---

# Welcome to Arc

**One database for metrics, logs, traces, and events**

Arc is a unified observability database built on DuckDB, Parquet, and flexible storage backends. Query all your observability data with SQL. No more copying timestamps between dashboards. **6.57M records/sec** unified throughput.

## Key Features

- **Unified Observability**: One SQL query across metrics, logs, traces, and events
- **High-Performance Ingestion**: 6.57M records/sec unified (all data types simultaneously)
- **Fast Analytical Queries**: Powered by DuckDB with full SQL support
- **No Data Silos**: Join metrics with logs, correlate traces with events
- **Flexible Storage**: Local filesystem, MinIO, AWS S3, or Google Cloud Storage
- **Multi-Database Architecture**: Organize data by environment, tenant, or application
- **Automatic Compaction**: Merges small files for 10-50x faster queries
- **Optional WAL**: Zero data loss with Write-Ahead Log (disabled by default for max throughput)
- **Apache Superset Integration**: Native dialect for BI dashboards

## Why Arc?

**The Problem**: You're running Prometheus for metrics. Loki for logs. Tempo for traces. Three systems. Three query languages. When production breaks at 3am, you're copying timestamps between dashboards.

**Arc solves this: one SQL query across all your observability data.**

```sql
-- What happened after that deployment?
WITH deploy AS (
  SELECT time FROM prod.events
  WHERE event_type = 'deployment_started'
  LIMIT 1
)
SELECT
  m.timestamp,
  m.service,
  m.cpu_usage,
  l.error_count,
  t.p99_latency
FROM prod.metrics m
JOIN prod.logs l USING (timestamp, service)
JOIN prod.traces t USING (timestamp, service)
CROSS JOIN deploy d
WHERE m.timestamp BETWEEN d.time AND d.time + INTERVAL '30 minutes'
ORDER BY m.timestamp DESC;
```

Arc is designed for applications that need:

- **Unified observability**: One query language across all telemetry types
- **High write throughput**: 6.57M records/sec unified (metrics + logs + traces + events)
- **Cost-effective storage**: Commodity object storage instead of expensive databases
- **Analytical queries**: Complex aggregations, window functions, joins
- **Flexible deployment**: Docker, Kubernetes, native, or cloud deployments

## Quick Example

```python
import msgpack
import requests
from datetime import datetime

# COLUMNAR FORMAT (RECOMMENDED - 3.2x faster than row format)
# All data organized as columns (arrays), not rows
data = {
    "m": "cpu",                    # measurement name
    "columns": {                   # columnar data structure
        "time": [
            int(datetime.now().timestamp() * 1000),
            int(datetime.now().timestamp() * 1000) + 1000,
            int(datetime.now().timestamp() * 1000) + 2000
        ],
        "host": ["server01", "server02", "server03"],
        "region": ["us-east", "us-west", "eu-central"],
        "datacenter": ["aws", "gcp", "azure"],
        "usage_idle": [95.0, 85.0, 92.0],
        "usage_user": [3.2, 10.5, 5.8],
        "usage_system": [1.8, 4.5, 2.2]
    }
}

# Send columnar data (2.91M RPS metrics throughput)
response = requests.post(
    "http://localhost:8000/api/v1/write/msgpack",
    headers={
        "Authorization": "Bearer YOUR_TOKEN",
        "Content-Type": "application/msgpack",
        "x-arc-database": "default"  # Optional: specify database
    },
    data=msgpack.packb(data)
)

# Check response (returns 204 No Content on success)
if response.status_code == 204:
    print(f"Successfully wrote {len(data['columns']['time'])} records!")
else:
    print(f"Error {response.status_code}: {response.text}")

# Query data
response = requests.post(
    "http://localhost:8000/api/v1/query",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    json={"sql": "SELECT * FROM cpu LIMIT 10", "format": "json"}
)
```

## Architecture

```
Client → Arc API → Buffer → Parquet → Storage (MinIO/S3/Local)
                     ↓
                  DuckDB Query Engine
```

Arc separates compute and storage, allowing you to scale them independently. Data is stored as Parquet files on object storage, queried directly by DuckDB's efficient columnar engine.

## Performance

### Write Performance

**Unified Ingestion** - All data types simultaneously on a single node:
- **Total Throughput**: 6.57M records/sec
- **Metrics**: 1.98M/sec (68% of individual peak)
- **Logs**: 1.55M/sec (160% of individual peak)
- **Traces**: 1.50M/sec (191% of individual peak)
- **Events**: 1.54M/sec (157% of individual peak)
- **Hardware**: Apple M3 Max (14 cores, 36GB RAM)
- **Duration**: 61 seconds
- **Total Records**: 402 million records
- **Success Rate**: 100% (zero errors)

**Individual Performance** (when tested separately):
- **Metrics**: 2.91M/sec (p50: 1.76ms, p99: 29ms)
- **Logs**: 968K/sec (p50: 7.68ms, p99: 58ms)
- **Traces**: 784K/sec (p50: 2.61ms, p99: 64ms)
- **Events**: 981K/sec (p50: 3.34ms, p99: 55ms)

### Query Performance

**ClickBench Results** (AWS c6a.4xlarge):
- **Cold run**: 120.25s across 43 queries (with proper cache flushing)
- **Warm run**: 35.70s across 43 queries
- **Dataset**: 100M rows, 14GB Parquet
- **Method**: HTTP REST API (includes all overhead)

Arc is **1.80x faster than QuestDB** and **9.39x faster than TimescaleDB** in analytical workloads.

## Next Steps

- [Getting Started](/arc/getting-started) - Learn how to install and use Arc
- [Installation Guide](/arc/installation/docker) - Docker and native installation
- [GitHub Repository](https://github.com/basekick-labs/arc) - Star us on GitHub

## Support

- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
- Enterprise: enterprise@basekick.net
