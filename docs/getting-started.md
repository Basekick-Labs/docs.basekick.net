---
sidebar_position: 2
---

# Getting Started

This guide will get you up and running with Arc in 5 minutes.

## Prerequisites

- Docker or Kubernetes cluster
- 4GB RAM minimum, 8GB+ recommended

## Quick Start

### Docker Deployment (Recommended)

The simplest way to get started with Arc is using Docker:

```bash
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:25.11.1
```

Arc API will be available at `http://localhost:8000`

**Verify it's running:**

```bash
curl http://localhost:8000/health
```

**Data persistence:**
- `/app/data/arc/` - Parquet files containing your data
- `/app/data/arc.db` - SQLite metadata and authentication tokens

### Kubernetes Deployment (Helm)

For production deployments on Kubernetes:

```bash
helm install arc https://github.com/Basekick-Labs/arc/releases/download/v25.11.1/arc-25.11.1.tgz
kubectl port-forward svc/arc 8000:8000
```

**Customize your deployment:**

```bash
helm install arc https://github.com/Basekick-Labs/arc/releases/download/v25.11.1/arc-25.11.1.tgz \
  --set persistence.size=20Gi \
  --set resources.limits.memory=4Gi
```

**Key configuration options:**
- `persistence.enabled` - Enable persistent storage (default: true)
- `persistence.size` - Storage volume size (default: 10Gi)
- `arc.storageBackend` - Backend: local, s3, minio (default: local)
- `resources.limits.memory` - Memory limit (default: unrestricted)

See `helm/arc/values.yaml` in the [Arc repository](https://github.com/basekick-labs/arc) for all options.

## Get Your Admin Token

When Arc starts for the first time, it automatically creates an admin token and displays it in the logs.

**IMPORTANT: Copy this token immediately - you won't see it again!**

```bash
# Docker - check the logs for your admin token
docker logs arc-api 2>&1 | grep "Admin token"

# Kubernetes - check pod logs
kubectl logs -l app=arc | grep "Admin token"
```

You should see output like:
```
Admin token: arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save this token! You'll need it for all API requests.

```bash
# Export for convenience
export ARC_TOKEN="your-token-here"
```

## Write Your First Data

### Using MessagePack Columnar (Recommended)

MessagePack columnar format provides the best performance for high-throughput ingestion.

```python
import msgpack
import requests
from datetime import datetime
import os

token = os.getenv("ARC_TOKEN")

# Columnar format - arrange data by columns (fastest)
data = {
    "m": "cpu",                                      # measurement name
    "columns": {
        "time": [int(datetime.now().timestamp() * 1000)],   # timestamps
        "host": ["server01"],                                # host tag
        "region": ["us-east"],                               # region tag
        "dc": ["aws"],                                       # dc tag
        "usage_idle": [95.0],                                # metric value
        "usage_user": [3.2],                                 # metric value
        "usage_system": [1.8]                                # metric value
    }
}

# Send data
response = requests.post(
    "http://localhost:8000/api/v1/write/msgpack",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/msgpack"
    },
    data=msgpack.packb(data)
)

if response.status_code == 204:
    print("Successfully wrote data!")
else:
    print(f"Error {response.status_code}: {response.text}")
```

**Batch multiple rows for even better performance:**

```python
# Send multiple rows in one request
data = {
    "m": "cpu",
    "columns": {
        "time": [
            int(datetime.now().timestamp() * 1000),
            int(datetime.now().timestamp() * 1000),
            int(datetime.now().timestamp() * 1000)
        ],
        "host": ["server01", "server02", "server03"],
        "usage_idle": [95.0, 87.5, 92.3],
        "usage_user": [3.2, 8.1, 5.4],
        "usage_system": [1.8, 4.4, 2.3]
    }
}

response = requests.post(
    "http://localhost:8000/api/v1/write/msgpack",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/msgpack"
    },
    data=msgpack.packb(data)
)
```

### Using InfluxDB Line Protocol

```bash
# Single measurement
curl -X POST "http://localhost:8000/api/v1/write" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary "cpu,host=server01,region=us-east usage_idle=95.0,usage_user=3.2 $(date +%s)000000000"

# Multiple measurements
curl -X POST "http://localhost:8000/api/v1/write" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary "cpu,host=server01 usage=64.2
mem,host=server01 used=8.2,total=16.0
disk,host=server01 used=120.5,total=500.0"
```

## Query Your Data

### Simple Query

```python
import requests
import os

token = os.getenv("ARC_TOKEN")

response = requests.post(
    "http://localhost:8000/api/v1/query",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    json={
        "sql": "SELECT * FROM prod.cpu ORDER BY time DESC LIMIT 10",
        "format": "json"
    }
)

data = response.json()
print(f"Rows: {len(data['data'])}")
for row in data['data']:
    print(row)
```

### Using curl

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM prod.cpu LIMIT 10",
    "format": "json"
  }'
```

### Advanced Queries

```python
# Time-series aggregation
response = requests.post(
    "http://localhost:8000/api/v1/query",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "sql": """
            SELECT
                time_bucket(INTERVAL '5 minutes', time) as bucket,
                host,
                AVG(usage_idle) as avg_idle,
                MAX(usage_user) as max_user
            FROM prod.cpu
            WHERE time > now() - INTERVAL '1 hour'
            GROUP BY bucket, host
            ORDER BY bucket DESC
        """,
        "format": "json"
    }
)

# Join multiple measurements
response = requests.post(
    "http://localhost:8000/api/v1/query",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "sql": """
            SELECT
                c.timestamp,
                c.host,
                c.usage_idle as cpu_idle,
                m.used_percent as mem_used
            FROM prod.cpu c
            JOIN prod.mem m ON c.timestamp = m.timestamp AND c.host = m.host
            WHERE c.timestamp > now() - INTERVAL '10 minutes'
            ORDER BY c.timestamp DESC
        """,
        "format": "json"
    }
)
```

### Apache Arrow Format (For Large Result Sets)

For queries returning 10K+ rows, use the Apache Arrow endpoint for **7.36x faster performance** and **43% smaller payloads**.

```python
import requests
import pyarrow as pa
import pandas as pd
import os

token = os.getenv("ARC_TOKEN")

# Query with Arrow format
response = requests.post(
    "http://localhost:8000/api/v1/query/arrow",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    json={
        "sql": "SELECT * FROM prod.cpu WHERE time > now() - INTERVAL '1 hour' LIMIT 10000"
    }
)

# Parse Arrow IPC stream
reader = pa.ipc.open_stream(response.content)
arrow_table = reader.read_all()

# Convert to Pandas (zero-copy)
df = arrow_table.to_pandas()

print(f"Rows: {len(df)}")
print(df.head())
```

**Performance benefits:**
- Zero-copy conversion to Pandas/Polars
- Columnar format stays efficient end-to-end
- Ideal for analytics notebooks and data pipelines

See [Arc README examples](https://github.com/basekick-labs/arc#apache-arrow-columnar-queries) for Polars usage.

## Check Health

```bash
curl http://localhost:8000/health

# Response
{
  "status": "healthy",
  "version": "0.1.0",
  "storage": "minio",
  "uptime": "1h 23m 45s"
}
```

## List Measurements

```bash
# List all tables in the default database
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SHOW TABLES", "format": "json"}'

# List tables in the prod database
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SHOW TABLES FROM prod", "format": "json"}'
```

## Next Steps

Now that you have Arc running, you can:

- **[Use the Python SDK](/arc/sdks/python/)** - Official client with DataFrame support and buffered writes
- **[Integrate with Telegraf](/arc/integrations/telegraf)** - Collect system metrics automatically
- **[Connect Apache Superset](/arc/integrations/superset)** - Build interactive dashboards
- **[Enable WAL](/arc/advanced/wal)** - Guarantee zero data loss
- **[Optimize compaction](/arc/advanced/compaction)** - Fine-tune query performance

## Troubleshooting

### Arc Won't Start

```bash
# Docker - check logs
docker logs arc-api

# Kubernetes - check pod logs
kubectl logs -l app=arc
```

### Authentication Errors

Make sure you:
1. Retrieved your admin token from the logs on first startup
2. Exported it: `export ARC_TOKEN="your-token"`
3. Include it in headers: `Authorization: Bearer $ARC_TOKEN`

### Can't Find Admin Token

If you missed copying the admin token from the logs, you'll need to create a new one:

```bash
# Docker
docker exec -it arc-api python3 -c "
from api.auth import AuthManager
auth = AuthManager(db_path='/data/arc.db')
token = auth.create_token('my-admin', description='Admin token')
print(f'Admin Token: {token}')
"
```

### No Data Returned

Data might not be flushed yet. Wait 5-10 seconds or manually flush:

```bash
curl -X POST http://localhost:8000/api/v1/write/flush \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Need Help?

- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [Full Documentation](/arc)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
