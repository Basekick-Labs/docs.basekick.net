---
sidebar_position: 1
slug: /
---

# Welcome to Arc

**High-performance time-series database built on DuckDB**

Arc is a high-performance time-series database designed for industrial IoT, smart cities, observability, and financial data. Built on DuckDB and Parquet with flexible storage backends. **18.6M records/sec** ingestion throughput.

## Key Features

- **Extreme Performance**: 18.6M records/sec ingestion (MessagePack columnar)
- **Fast Analytical Queries**: Powered by DuckDB with full SQL support (2.64M rows/sec)
- **Flexible Storage**: Local filesystem, MinIO, AWS S3, Azure Blob Storage
- **Multi-Database Architecture**: Organize data by environment, tenant, or application
- **Automatic Compaction**: Tiered (hourly/daily) file merging for 10-50x faster queries
- **Optional WAL**: Zero data loss with Write-Ahead Log
- **Data Lifecycle**: Retention policies, continuous queries, GDPR-compliant delete
- **Production Ready**: Prometheus metrics, structured logging, graceful shutdown
- **MQTT Integration**: Direct MQTT broker subscription for IoT data streams
- **Python SDK**: Native Python client with DataFrame support (Pandas, Polars, PyArrow)
- **Bulk Import**: CSV and Parquet import with auto-partitioning
- **Native TLS/HTTPS**: Built-in TLS support, no reverse proxy needed

## Why Arc?

**The Problem**: Industrial IoT generates massive data at scale:

- **Racing & Motorsport**: 100M+ sensor readings per race
- **Smart Cities**: Billions of infrastructure events daily
- **Mining & Manufacturing**: Equipment telemetry at unprecedented scale
- **Energy & Utilities**: Grid monitoring, smart meters, renewable output
- **Observability**: Metrics, logs, traces from distributed systems

Traditional time-series databases can't keep up. They're slow, expensive, and lock your data in proprietary formats.

**Arc solves this: 18.6M records/sec ingestion, sub-second queries on billions of rows, portable Parquet files you own.**

```sql
-- Analyze equipment anomalies across facilities
SELECT
  device_id,
  facility_name,
  AVG(temperature) OVER (
    PARTITION BY device_id
    ORDER BY timestamp
    ROWS BETWEEN 10 PRECEDING AND CURRENT ROW
  ) as temp_moving_avg,
  MAX(pressure) as peak_pressure,
  STDDEV(vibration) as vibration_variance
FROM data.iot_sensors
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND facility_id IN ('mining_site_42', 'plant_7')
GROUP BY device_id, facility_name, timestamp
HAVING MAX(pressure) > 850 OR STDDEV(vibration) > 2.5;
```

**Standard DuckDB SQL. Window functions, CTEs, joins. No proprietary query language.**

## Quick Example

```python
import msgpack
import requests
from datetime import datetime

# COLUMNAR FORMAT (RECOMMENDED)
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

# Send columnar data (18.6M records/sec throughput)
response = requests.post(
    "http://localhost:8000/api/v1/write/msgpack",
    headers={
        "Authorization": "Bearer $ARC_TOKEN",
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
    headers={"Authorization": "Bearer $ARC_TOKEN"},
    json={"sql": "SELECT * FROM default.cpu LIMIT 10", "format": "json"}
)
```

## Architecture

```
Client → Arc API → Buffer → Parquet → Storage (S3/MinIO/Azure/Local)
                     ↓
                  DuckDB Query Engine
```

Arc separates compute and storage, allowing you to scale them independently. Data is stored as Parquet files on object storage, queried directly by DuckDB's efficient columnar engine.

## Performance

- **Ingestion**: 18.6M records/sec (columnar MessagePack format)
- **Query throughput**: 2.64M rows/sec
- **Write latency**: Under 10ms p99
- **Query latency**: Sub-second for time-windowed aggregations
- **Compression**: 10x-100x vs JSON (Parquet columnar format)

### ClickBench Results (AWS c6a.4xlarge)

- **Cold run**: 120.25s across 43 queries
- **Warm run**: 35.70s across 43 queries
- **Dataset**: 100M rows, 14GB Parquet

Arc is **1.80x faster than QuestDB** and **9.39x faster than TimescaleDB** in analytical workloads.

## Arc Enterprise

Need clustering, RBAC, tiered storage, audit logging, or automated scheduling? [Arc Enterprise](/arc-enterprise) extends Arc with production-grade features for scale, security, and compliance. Same binary, same performance — add a license key and enable the features you need.

## Next Steps

- [Getting Started](/arc/getting-started) - Install and run Arc in 5 minutes
- [Installation Guide](/arc/installation/docker) - Docker, native packages, and source
- [Arc Enterprise](/arc-enterprise) - Enterprise features for production at scale
- [GitHub Repository](https://github.com/basekick-labs/arc) - Star us on GitHub

## Support

- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
- Enterprise: enterprise@basekick.net
