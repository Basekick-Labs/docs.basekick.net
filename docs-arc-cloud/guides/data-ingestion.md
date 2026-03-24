---
sidebar_position: 4
---

# Data Ingestion Patterns

Optimize how you send data to Arc Cloud -- batch sizes, parallelism, error handling, and throughput by tier.

## Ingestion Endpoint

All data ingestion goes through a single endpoint:

```
POST /api/v1/ingest
```

### Request Format

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/ingest \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "database": "my_database",
    "records": [
      {"timestamp": "2026-03-23T12:00:00Z", "sensor": "temp_01", "value": 22.5},
      {"timestamp": "2026-03-23T12:00:01Z", "sensor": "temp_01", "value": 22.6}
    ]
  }'
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `database` | string | Yes | Target database name. Created automatically if it does not exist. |
| `records` | array | Yes | Array of JSON objects to ingest. |

Each record is a flat JSON object. Arc Cloud creates the table (measurement) and columns automatically based on the fields present in the first batch.

## Schema Auto-Detection

Arc Cloud automatically detects and creates schemas from your data:

- **First insert**: Arc creates the database, table, and columns based on the fields in your records
- **New fields**: If a subsequent batch contains fields that do not exist yet, Arc adds them as new columns
- **Type inference**: Column types are inferred from values (string, integer, float, boolean, timestamp)

```bash
# First insert creates the table with columns: timestamp, sensor, value
curl -X POST .../api/v1/ingest -d '{
  "database": "iot",
  "records": [{"timestamp": "2026-03-23T12:00:00Z", "sensor": "temp_01", "value": 22.5}]
}'

# Later insert adds a new "location" column automatically
curl -X POST .../api/v1/ingest -d '{
  "database": "iot",
  "records": [{"timestamp": "2026-03-23T13:00:00Z", "sensor": "temp_01", "value": 23.1, "location": "building-a"}]
}'
```

## Single Record vs Batch Ingestion

### Single Record

Sending one record per request works but is inefficient due to HTTP overhead:

```bash
# Works but slow -- one HTTP round-trip per record
curl -X POST .../api/v1/ingest -d '{
  "database": "events",
  "records": [
    {"timestamp": "2026-03-23T12:00:00Z", "event": "click", "user_id": "u_123"}
  ]
}'
```

### Batch Ingestion (Recommended)

Batch multiple records in a single request. This significantly reduces HTTP overhead and improves throughput.

```bash
# Much faster -- one HTTP round-trip for many records
curl -X POST .../api/v1/ingest -d '{
  "database": "events",
  "records": [
    {"timestamp": "2026-03-23T12:00:00Z", "event": "click", "user_id": "u_123"},
    {"timestamp": "2026-03-23T12:00:01Z", "event": "page_view", "user_id": "u_456"},
    {"timestamp": "2026-03-23T12:00:01Z", "event": "click", "user_id": "u_789"},
    ...
  ]
}'
```

:::tip Recommended Batch Size
Send up to **10,000 records per request** for optimal throughput. Larger batches increase memory usage on both client and server without significant speed gains.
:::

### Throughput Comparison

| Strategy | Records/sec (typical) | HTTP Requests |
|----------|----------------------|---------------|
| Single record | ~100-500 | 1 per record |
| Batch of 100 | ~5,000-20,000 | 1 per 100 records |
| Batch of 1,000 | ~30,000-100,000 | 1 per 1,000 records |
| Batch of 10,000 | ~50,000-200,000 | 1 per 10,000 records |

Actual throughput depends on your plan tier, record size, network latency, and number of parallel workers.

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
If you consistently need throughput beyond your tier's limit, consider upgrading your plan from the Arc Cloud dashboard.
:::

## Best Practices

### 1. Batch Records

Buffer records on the client side and flush in batches:

```python
import requests
import time
from threading import Lock

class ArcIngester:
    def __init__(self, arc_url, arc_token, database, batch_size=1000, flush_interval=5):
        self.arc_url = arc_url
        self.database = database
        self.headers = {
            "Authorization": f"Bearer {arc_token}",
            "Content-Type": "application/json",
        }
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.buffer = []
        self.lock = Lock()
        self.last_flush = time.time()

    def add(self, record: dict):
        with self.lock:
            self.buffer.append(record)
            if len(self.buffer) >= self.batch_size:
                self._flush()
            elif time.time() - self.last_flush > self.flush_interval:
                self._flush()

    def _flush(self):
        if not self.buffer:
            return
        batch = self.buffer[:]
        self.buffer.clear()
        self.last_flush = time.time()

        requests.post(
            f"{self.arc_url}/api/v1/ingest",
            headers=self.headers,
            json={"database": self.database, "records": batch},
        )

    def close(self):
        with self.lock:
            self._flush()
```

### 2. Use Multiple Workers for Parallelism

For high-throughput scenarios, use multiple threads or processes to send batches in parallel:

```python
import concurrent.futures
from datetime import datetime

ARC_URL = "https://<instance-id>.arc.<region>.basekick.net"
ARC_TOKEN = "<your-token>"
HEADERS = {"Authorization": f"Bearer {ARC_TOKEN}", "Content-Type": "application/json"}

def send_batch(batch):
    """Send a single batch to Arc Cloud."""
    resp = requests.post(
        f"{ARC_URL}/api/v1/ingest",
        headers=HEADERS,
        json={"database": "events", "records": batch},
    )
    return resp.status_code

# Split records into batches of 5,000
all_records = [...]  # Your records
batches = [all_records[i:i+5000] for i in range(0, len(all_records), 5000)]

# Send batches in parallel with 4 workers
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(send_batch, batches))

success = sum(1 for r in results if r == 200)
print(f"Sent {len(batches)} batches, {success} successful")
```

### 3. Keep Record Size Reasonable

- Avoid embedding large blobs (images, binary data) in records
- Use JSON strings for nested data rather than deeply nested objects
- Keep individual records under 1 MB
- If you have large payloads, store the payload elsewhere and reference it by ID

### 4. Include Timestamps

Always include a `timestamp` field in ISO 8601 format. Arc Cloud uses this for time-based partitioning, retention, and queries:

```json
{"timestamp": "2026-03-23T14:32:01.892Z", "event": "click", "user_id": "u_123"}
```

If you omit the timestamp, Arc Cloud assigns one at ingestion time, but explicit timestamps are preferred for accuracy.

### 5. Consistent Field Names

Use consistent field names across records. Inconsistent naming creates separate columns:

```json
// Good -- consistent naming
{"timestamp": "...", "user_id": "u_123", "event_name": "click"}
{"timestamp": "...", "user_id": "u_456", "event_name": "page_view"}

// Bad -- creates two columns: "event_name" and "eventName"
{"timestamp": "...", "user_id": "u_123", "event_name": "click"}
{"timestamp": "...", "user_id": "u_456", "eventName": "page_view"}
```

## Error Handling

### Rate Limiting (429)

If you exceed your tier's ingestion rate, the API returns a `429 Too Many Requests` response. Implement retry with exponential backoff:

```python
import time
import requests

def ingest_with_retry(url, headers, payload, max_retries=5):
    """Ingest with exponential backoff on rate limits."""
    for attempt in range(max_retries):
        resp = requests.post(url, headers=headers, json=payload)

        if resp.status_code == 200:
            return resp

        if resp.status_code == 429:
            wait = min(2 ** attempt, 30)  # 1s, 2s, 4s, 8s, 16s (max 30s)
            print(f"Rate limited. Retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue

        # Other errors -- raise immediately
        resp.raise_for_status()

    raise Exception(f"Failed after {max_retries} retries")
```

### Common Error Codes

| Status Code | Meaning | Action |
|-------------|---------|--------|
| `200` | Success | Records ingested |
| `400` | Bad request | Check payload format, field types |
| `401` | Unauthorized | Verify your API token |
| `429` | Rate limited | Back off and retry |
| `500` | Server error | Retry after a short delay |

### Handling Partial Failures

If a batch contains a mix of valid and invalid records, Arc Cloud ingests the valid records and returns details about any failures in the response body. Check the response for partial errors:

```python
resp = requests.post(f"{ARC_URL}/api/v1/ingest", headers=HEADERS, json=payload)
data = resp.json()

if resp.status_code == 200:
    print(f"Ingested {data.get('records_written', 0)} records")
```

## Storage Overage

Each Arc Cloud plan includes a fixed amount of storage. If your data exceeds the included storage:

- Your instance continues to operate normally
- You are billed **$0.10 per GB per month** for storage beyond your plan's limit
- Overage charges appear on your next invoice
- You can reduce storage by applying [retention policies](/arc/data-lifecycle/retention-policies) or deleting old data

Check your current storage usage from the Arc Cloud dashboard or via the API.

## Next Steps

- [Product Analytics](/arc-cloud/guides/product-analytics) -- Schema design and queries for analytics
- [Observability & Logging](/arc-cloud/guides/observability) -- Log ingestion patterns
- [SQL Querying Guide](/arc/guides/querying) -- Query the data you ingested
- [Retention Policies](/arc/data-lifecycle/retention-policies) -- Manage data lifecycle and storage
