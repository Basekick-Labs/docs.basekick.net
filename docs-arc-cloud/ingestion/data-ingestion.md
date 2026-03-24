---
sidebar_position: 1
---

# Data Ingestion Patterns

Optimize how you send data to Arc Cloud -- ingestion methods, batch sizes, parallelism, error handling, and throughput by tier.

## Ingestion Methods

Arc Cloud supports multiple ingestion protocols. Choose the one that best fits your use case:

| Method | Endpoint | Best For |
|--------|----------|----------|
| **MessagePack** | `POST /api/v1/write/msgpack` | Highest throughput (18M+ rec/s), production pipelines |
| **Line Protocol** | `POST /api/v1/write/line-protocol` | Telegraf, InfluxDB clients, human-readable |
| **InfluxDB-compatible** | `POST /write?db=...&p=TOKEN` | Drop-in replacement for InfluxDB clients |
| **Python SDK** | `arc-tsdb-client` | DataFrames, columnar writes, buffered ingestion |
| **CSV Import** | `POST /api/v1/import/csv` | Bulk historical data |
| **Parquet Import** | `POST /api/v1/import/parquet` | Large columnar datasets |
| **Line Protocol Import** | `POST /api/v1/import/lp` | Bulk line protocol files |

## Data Model

Arc uses a time-series data model with **measurements**, **tags**, and **fields**:

- **Measurement**: The table name (e.g., `events`, `logs`, `metrics`)
- **Tags**: Indexed string columns for filtering (e.g., `source=web`, `host=server-01`)
- **Fields**: Value columns (strings, integers, floats, booleans)
- **Timestamp**: Nanosecond-precision time column

Tables are addressed as `database.measurement` (e.g., `default.events`, `analytics.page_views`).

## MessagePack (Fastest)

MessagePack is Arc's primary ingestion protocol, achieving 18M+ records per second. It uses a compact binary format.

### Python Example

```python
import msgpack
import requests

ARC_URL = "https://<instance-id>.arc.<region>.basekick.net"
ARC_TOKEN = "<your-token>"

# MessagePack payload: array of [measurement, tags, fields, timestamp_ns]
records = [
    ["events", {"source": "web"}, {"event_name": "page_view", "user_id": "u_8f3k2", "page": "/pricing"}, 1711200721000000000],
    ["events", {"source": "web"}, {"event_name": "signup", "user_id": "u_8f3k2", "page": "/signup"}, 1711200725000000000],
    ["events", {"source": "mobile"}, {"event_name": "page_view", "user_id": "u_9x7m1", "page": "/home"}, 1711200792000000000],
]

resp = requests.post(
    f"{ARC_URL}/api/v1/write/msgpack",
    headers={
        "Authorization": f"Bearer {ARC_TOKEN}",
        "Content-Type": "application/msgpack",
    },
    data=msgpack.packb(records),
)
print(resp.status_code)  # 200
```

## Line Protocol

Line protocol is a text-based format compatible with Telegraf and InfluxDB client libraries. Each line represents one data point:

```
measurement,tag1=val1,tag2=val2 field1=value1,field2="string_value" timestamp_ns
```

### curl Example

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=analytics" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'events,source=web event_name="page_view",user_id="u_8f3k2",page="/pricing" 1711200721000000000
events,source=web event_name="signup",user_id="u_8f3k2",page="/signup" 1711200725000000000
events,source=mobile event_name="page_view",user_id="u_9x7m1",page="/home" 1711200792000000000'
```

### InfluxDB-Compatible Endpoint

Use the InfluxDB v1 write endpoint for drop-in compatibility with existing InfluxDB clients:

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/write?db=analytics&p=<your-token>" \
  -H "Content-Type: text/plain" \
  -d 'events,source=web event_name="page_view",user_id="u_8f3k2",page="/pricing" 1711200721000000000'
```

This endpoint accepts the token via the `p` query parameter, making it compatible with InfluxDB client libraries that do not support Bearer token auth.

## Python SDK (arc-tsdb-client)

The `arc-tsdb-client` SDK provides high-level Python bindings with columnar writes, DataFrame support, and automatic buffering.

### Install

```bash
pip install arc-tsdb-client
```

### Columnar Writes

```python
from arc_tsdb_client import ArcClient

client = ArcClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-token>",
    database="analytics",
)

# Write columnar data (efficient for large batches)
client.write_columnar(
    measurement="events",
    tags={"source": ["web", "web", "mobile"]},
    fields={
        "event_name": ["page_view", "signup", "page_view"],
        "user_id": ["u_8f3k2", "u_8f3k2", "u_9x7m1"],
        "page": ["/pricing", "/signup", "/home"],
    },
    timestamps=[1711200721000000000, 1711200725000000000, 1711200792000000000],
)
```

### DataFrame Writes

```python
import pandas as pd
from arc_tsdb_client import ArcClient

client = ArcClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-token>",
    database="analytics",
)

df = pd.DataFrame({
    "event_name": ["page_view", "signup", "purchase"],
    "user_id": ["u_8f3k2", "u_8f3k2", "u_8f3k2"],
    "page": ["/pricing", "/signup", "/checkout"],
    "amount": [None, None, 49.99],
}, index=pd.to_datetime(["2026-03-23T14:32:01Z", "2026-03-23T14:32:05Z", "2026-03-23T14:33:12Z"]))

client.write_dataframe(
    measurement="events",
    df=df,
    tag_columns=[],  # columns to use as tags
)
```

### Buffered Writes

For streaming workloads, use the buffered writer to batch records automatically:

```python
from arc_tsdb_client import ArcClient

client = ArcClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-token>",
    database="analytics",
)

with client.buffered_writer(batch_size=5000, flush_interval=5.0) as writer:
    for event in event_stream():
        writer.write(
            measurement="events",
            tags={"source": event["source"]},
            fields={"event_name": event["name"], "user_id": event["user_id"]},
        )
# Buffer is flushed automatically on exit
```

## InfluxDB Client Libraries

Since Arc Cloud is wire-compatible with InfluxDB, you can use existing InfluxDB client libraries unchanged.

### Python (influxdb-client)

```python
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

client = InfluxDBClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-token>",
    org="-",  # not used by Arc, but required by the client
)
write_api = client.write_api(write_options=SYNCHRONOUS)

point = (
    Point("events")
    .tag("source", "web")
    .field("event_name", "page_view")
    .field("user_id", "u_8f3k2")
    .field("page", "/pricing")
)
write_api.write(bucket="analytics", record=point)
```

### Go (influxdb-client-go)

```go
package main

import (
    "context"
    "time"
    influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    client := influxdb2.NewClient(
        "https://<instance-id>.arc.<region>.basekick.net",
        "<your-token>",
    )
    writeAPI := client.WriteAPIBlocking("-", "analytics")

    p := influxdb2.NewPoint("events",
        map[string]string{"source": "web"},
        map[string]interface{}{
            "event_name": "page_view",
            "user_id":    "u_8f3k2",
            "page":       "/pricing",
        },
        time.Now(),
    )
    writeAPI.WritePoint(context.Background(), p)
    client.Close()
}
```

### Node.js (@influxdata/influxdb-client)

```javascript
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

const client = new InfluxDB({
  url: "https://<instance-id>.arc.<region>.basekick.net",
  token: "<your-token>",
});

const writeApi = client.getWriteApi("-", "analytics");

const point = new Point("events")
  .tag("source", "web")
  .stringField("event_name", "page_view")
  .stringField("user_id", "u_8f3k2")
  .stringField("page", "/pricing");

writeApi.writePoint(point);
writeApi.close();
```

## Bulk Import

For loading historical data or large datasets, use the bulk import endpoints. These accept file uploads and are optimized for high-volume one-time loads.

### CSV Import

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/csv?db=analytics&measurement=events" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/csv" \
  --data-binary @events.csv
```

The CSV must include a header row. A column named `time` or `timestamp` is used as the time column.

### Parquet Import

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/parquet?db=analytics&measurement=events" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @events.parquet
```

### Line Protocol Import

For bulk-loading line protocol files (e.g., InfluxDB exports):

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/lp?db=analytics" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  --data-binary @export.lp
```

## InfluxDB Migration Path

If you are migrating from InfluxDB, Arc Cloud accepts the same write protocol and client libraries. To migrate:

1. **Export** your InfluxDB data using `influx_inspect export` or `influxd backup`
2. **Bulk import** the exported line protocol files via `/api/v1/import/lp`
3. **Point your clients** to your Arc Cloud instance URL -- no code changes needed for InfluxDB v2 clients
4. **Update queries** from InfluxQL/Flux to SQL (Arc uses DuckDB SQL)

## Throughput by Tier

Each Arc Cloud tier has a maximum ingestion rate:

| Tier | Max Ingest Rate | Recommended For |
|------|----------------|-----------------|
| **Free** | 30,000 rec/s | Development, prototyping |
| **Starter** | 85,000 rec/s | Small production workloads |
| **Growth** | 170,000 rec/s | Growing applications |
| **Professional** | 250,000 rec/s | Medium-scale production |
| **Business** | 500,000 rec/s | High-throughput workloads |
| **Premium** | 1,000,000 rec/s | Large-scale analytics |
| **Ultimate** | 2,000,000 rec/s | Enterprise workloads |

:::info
MessagePack ingestion achieves the highest throughput. Line protocol is slightly slower due to text parsing. If you consistently need throughput beyond your tier's limit, consider upgrading your plan from the Arc Cloud dashboard.
:::

## Best Practices

### 1. Use MessagePack for High Throughput

MessagePack is the fastest ingestion path. Use it for production data pipelines where throughput matters.

### 2. Batch Records

Buffer records on the client side and flush in batches. Aim for 1,000--10,000 records per request:

```python
from arc_tsdb_client import ArcClient

client = ArcClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-token>",
    database="events",
)

with client.buffered_writer(batch_size=5000, flush_interval=5.0) as writer:
    for record in records:
        writer.write(
            measurement="events",
            tags={"source": record["source"]},
            fields={"event_name": record["name"], "user_id": record["user_id"]},
        )
```

### 3. Use Multiple Workers for Parallelism

For high-throughput scenarios, send batches in parallel:

```python
import concurrent.futures
import msgpack
import requests

ARC_URL = "https://<instance-id>.arc.<region>.basekick.net"
ARC_TOKEN = "<your-token>"

def send_batch(batch):
    resp = requests.post(
        f"{ARC_URL}/api/v1/write/msgpack",
        headers={
            "Authorization": f"Bearer {ARC_TOKEN}",
            "Content-Type": "application/msgpack",
        },
        data=msgpack.packb(batch),
    )
    return resp.status_code

# Split records into batches of 5,000
batches = [all_records[i:i+5000] for i in range(0, len(all_records), 5000)]

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(send_batch, batches))

success = sum(1 for r in results if r == 200)
print(f"Sent {len(batches)} batches, {success} successful")
```

### 4. Use Tags for Indexed Lookups

Tags are indexed and should be used for columns you filter on frequently (e.g., `source`, `host`, `service`). Fields are for values you aggregate or display (e.g., `user_id`, `event_name`, `amount`).

### 5. Include Timestamps

Always include explicit timestamps. If you omit the timestamp, Arc Cloud assigns one at ingestion time, but explicit timestamps are preferred for accuracy.

## Error Handling

### Rate Limiting (429)

If you exceed your tier's ingestion rate, the API returns `429 Too Many Requests`. Implement retry with exponential backoff:

```python
import time
import requests

def ingest_with_retry(url, headers, data, max_retries=5):
    for attempt in range(max_retries):
        resp = requests.post(url, headers=headers, data=data)

        if resp.status_code == 200:
            return resp

        if resp.status_code == 429:
            wait = min(2 ** attempt, 30)
            print(f"Rate limited. Retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue

        resp.raise_for_status()

    raise Exception(f"Failed after {max_retries} retries")
```

### Common Error Codes

| Status Code | Meaning | Action |
|-------------|---------|--------|
| `200` | Success | Records ingested |
| `400` | Bad request | Check payload format, line protocol syntax |
| `401` | Unauthorized | Verify your API token |
| `429` | Rate limited | Back off and retry |
| `500` | Server error | Retry after a short delay |

## Storage Overage

Each Arc Cloud plan includes a fixed amount of storage. If your data exceeds the included storage:

- Your instance continues to operate normally
- You are billed **$0.10 per GB per month** for storage beyond your plan's limit
- Overage charges appear on your next invoice
- You can reduce storage by applying [retention policies](/arc/data-lifecycle/retention-policies) or deleting old data

## Next Steps

- [Product Analytics](/arc-cloud/guides/product-analytics) -- Schema design and queries for analytics
- [Observability & Logging](/arc-cloud/guides/observability) -- Log ingestion patterns
- [SQL Querying Guide](/arc/guides/querying) -- Query the data you ingested
- [Retention Policies](/arc/data-lifecycle/retention-policies) -- Manage data lifecycle and storage
