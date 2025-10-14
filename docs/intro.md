---
sidebar_position: 1
slug: /
---

# Welcome to Arc

Arc is a high-performance time-series data warehouse built on DuckDB, Parquet, and flexible storage backends. It achieves **2.01M records/sec ingestion** and is the **fastest time-series database**.

## Key Features

- **High-Performance Ingestion**: 2.01M records/sec with MessagePack binary protocol
- **Fast Analytical Queries**: Powered by DuckDB with full SQL support
- **Flexible Storage**: Local filesystem, MinIO, AWS S3, or Google Cloud Storage
- **Multi-Database Architecture**: Organize data by environment, tenant, or application
- **Automatic Compaction**: Merges small files for 10-50x faster queries
- **Optional WAL**: Zero data loss with Write-Ahead Log (disabled by default for max throughput)
- **Apache Superset Integration**: Native dialect for BI dashboards

## Why Arc?

Arc is designed for applications that need:

- **High write throughput**: IoT sensors, metrics collection, observability platforms
- **Cost-effective storage**: Commodity object storage instead of expensive databases
- **Analytical queries**: Complex aggregations, window functions, joins
- **Flexible deployment**: Docker, native, or cloud deployments

## Quick Example

```python
import msgpack
import requests

# Write data
data = {
    "batch": [{
        "m": "cpu",                           # measurement
        "t": 1697472000000,                   # timestamp (ms)
        "h": "server01",                      # host
        "fields": {"usage": 45.2}
    }]
}

requests.post(
    "http://localhost:8000/write/v2/msgpack",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    data=msgpack.packb(data)
)

# Query data
response = requests.post(
    "http://localhost:8000/query",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    json={"sql": "SELECT * FROM cpu LIMIT 10"}
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

**ClickBench Results** (AWS c6a.4xlarge):
- **Cold run**: 34.43s across 43 queries
- **Dataset**: 99.9M rows, 14.78GB
- **Method**: HTTP REST API (includes all overhead)

Arc is **3.3x faster than VictoriaLogs**, **6.5x faster than QuestDB**, and **29.7x faster than TimescaleDB** in analytical workloads.

## Next Steps

- [Getting Started](/arc/getting-started) - Learn how to install and use Arc
- [Installation Guide](/arc/installation/docker) - Docker and native installation
- [GitHub Repository](https://github.com/basekick-labs/arc) - Star us on GitHub

## Alpha Release Notice

:::caution
Arc is currently in **alpha** and evolving rapidly. It is **not recommended for production workloads** at this time. Use in development and testing environments only.
:::

## Support

- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
- Enterprise: enterprise@basekick.net
