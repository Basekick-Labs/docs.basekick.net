---
sidebar_position: 1
---

# API Reference

Arc provides a comprehensive REST API for data ingestion, querying, and management.

## Base URL

```
http://localhost:8000
```

## Authentication

All endpoints (except public ones) require Bearer token authentication:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/v1/query
```

Or use the `x-api-key` header:

```bash
curl -H "x-api-key: YOUR_TOKEN" http://localhost:8000/api/v1/query
```

### Public Endpoints (No Auth Required)

- `GET /health` - Health check
- `GET /ready` - Readiness probe
- `GET /metrics` - Prometheus metrics
- `GET /api/v1/auth/verify` - Token verification

## Quick Examples

### Write Data (MessagePack)

```python
import msgpack
import requests

data = {
    "m": "cpu",
    "columns": {
        "time": [1697472000000],
        "host": ["server01"],
        "usage": [45.2]
    }
}

response = requests.post(
    "http://localhost:8000/api/v1/write/msgpack",
    headers={
        "Authorization": "Bearer YOUR_TOKEN",
        "Content-Type": "application/msgpack"
    },
    data=msgpack.packb(data)
)
```

### Query Data (JSON)

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM cpu LIMIT 10", "format": "json"}'
```

### Query Data (Apache Arrow)

For large result sets, use Arrow format for 2.88M rows/sec throughput:

```python
import requests
import pyarrow as pa

response = requests.post(
    "http://localhost:8000/api/v1/query/arrow",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    json={"sql": "SELECT * FROM cpu LIMIT 100000"}
)

reader = pa.ipc.open_stream(response.content)
arrow_table = reader.read_all()
```

### Health Check

```bash
curl http://localhost:8000/health
```

---

## Health & Monitoring

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "time": "2024-12-02T10:30:00Z",
  "uptime": "1h 23m 45s",
  "uptime_sec": 5025
}
```

### GET /ready

Kubernetes readiness probe.

**Response:**
```json
{
  "status": "ready",
  "time": "2024-12-02T10:30:00Z",
  "uptime_sec": 5025
}
```

### GET /metrics

Prometheus-format metrics.

**Response:** `text/plain` (Prometheus format)

Or request JSON:
```bash
curl -H "Accept: application/json" http://localhost:8000/metrics
```

### GET /api/v1/metrics

All metrics in JSON format.

### GET /api/v1/metrics/memory

Detailed memory statistics including Go runtime and DuckDB.

### GET /api/v1/metrics/query-pool

DuckDB connection pool statistics.

### GET /api/v1/metrics/endpoints

Per-endpoint request statistics.

### GET /api/v1/metrics/timeseries/:type

Timeseries metrics data.

**Parameters:**
- `:type` - `system`, `application`, or `api`
- `?duration_minutes=30` - Time range (default: 30, max: 1440)

### GET /api/v1/logs

Recent application logs.

**Query Parameters:**
- `?limit=100` - Number of logs (default: 100, max: 1000)
- `?level=error` - Filter by level (error, warn, info, debug)
- `?since_minutes=60` - Time range (default: 60, max: 1440)

---

## Data Ingestion

### POST /api/v1/write/msgpack

High-performance MessagePack binary writes (recommended).

**Headers:**
- `Authorization: Bearer TOKEN`
- `Content-Type: application/msgpack`
- `Content-Encoding: gzip` (optional)
- `x-arc-database: default` (optional)

**Body (MessagePack):**
```json
{
  "m": "measurement_name",
  "columns": {
    "time": [1697472000000, 1697472001000],
    "host": ["server01", "server02"],
    "value": [45.2, 67.8]
  }
}
```

**Response:** `204 No Content`

### GET /api/v1/write/msgpack/stats

MessagePack ingestion statistics.

### GET /api/v1/write/msgpack/spec

MessagePack format specification.

### POST /api/v1/write

InfluxDB 1.x Line Protocol compatible.

**Headers:**
- `Content-Type: text/plain`
- `x-arc-database: default` (optional)

**Body:**
```
cpu,host=server01 usage=45.2 1697472000000000000
mem,host=server01 used=8.2,total=16.0 1697472000000000000
```

### POST /api/v1/write/influxdb

InfluxDB 2.x compatible endpoint.

### POST /api/v1/write/line-protocol

Standard Line Protocol endpoint.

### POST /api/v1/write/line-protocol/flush

Force buffer flush to disk.

### GET /api/v1/write/line-protocol/stats

Line Protocol ingestion statistics.

### GET /api/v1/write/line-protocol/health

Line Protocol handler health.

---

## Querying

### POST /api/v1/query

Execute SQL queries with JSON response.

**Request:**
```json
{
  "sql": "SELECT * FROM default.cpu LIMIT 10",
  "format": "json"
}
```

**Response:**
```json
{
  "columns": ["time", "host", "usage"],
  "types": ["TIMESTAMP", "VARCHAR", "DOUBLE"],
  "data": [
    [1697472000000, "server01", 45.2],
    [1697472001000, "server02", 67.8]
  ],
  "row_count": 2,
  "execution_time_ms": 12
}
```

### POST /api/v1/query/arrow

Execute SQL queries with Apache Arrow IPC response.

**Request:**
```json
{
  "sql": "SELECT * FROM default.cpu LIMIT 10000"
}
```

**Response:** `application/vnd.apache.arrow.stream`

### POST /api/v1/query/estimate

Estimate query cost before execution.

**Request:**
```json
{
  "sql": "SELECT * FROM default.cpu WHERE time > now() - INTERVAL '1 hour'"
}
```

### GET /api/v1/measurements

List all measurements across databases.

### GET /api/v1/query/:measurement

Query a specific measurement directly.

---

## Authentication

### GET /api/v1/auth/verify

Verify token validity (public endpoint).

**Response:**
```json
{
  "valid": true,
  "token_id": "abc123",
  "name": "my-token",
  "is_admin": false
}
```

### GET /api/v1/auth/tokens

List all tokens (admin only).

### POST /api/v1/auth/tokens

Create a new token (admin only).

**Request:**
```json
{
  "name": "my-service",
  "description": "Token for my service",
  "is_admin": false
}
```

**Response:**
```json
{
  "id": "abc123",
  "name": "my-service",
  "token": "arc_xxxxxxxxxxxxxxxxxxxxxxxx",
  "is_admin": false,
  "created_at": "2024-12-02T10:30:00Z"
}
```

### GET /api/v1/auth/tokens/:id

Get token details (admin only).

### DELETE /api/v1/auth/tokens/:id

Delete/revoke a token (admin only).

### POST /api/v1/auth/tokens/:id/rotate

Rotate a token (admin only).

### POST /api/v1/auth/tokens/:id/revoke

Revoke a token (admin only).

### GET /api/v1/auth/cache/stats

Token cache statistics (admin only).

### POST /api/v1/auth/cache/invalidate

Invalidate token cache (admin only).

---

## Compaction

### GET /api/v1/compaction/status

Current compaction status.

**Response:**
```json
{
  "enabled": true,
  "running": false,
  "last_run": "2024-12-02T10:00:00Z",
  "next_run": "2024-12-02T11:00:00Z"
}
```

### GET /api/v1/compaction/stats

Compaction statistics.

### GET /api/v1/compaction/candidates

List files eligible for compaction.

### POST /api/v1/compaction/trigger

Manually trigger compaction.

**Request:**
```json
{
  "database": "default",
  "measurement": "cpu"
}
```

### GET /api/v1/compaction/jobs

List active compaction jobs.

### GET /api/v1/compaction/history

Compaction job history.

---

## Delete Operations

### POST /api/v1/delete

Delete data matching conditions.

**Request:**
```json
{
  "database": "default",
  "measurement": "cpu",
  "where": "host = 'server01' AND time < '2024-01-01'",
  "confirm": true
}
```

**Response:**
```json
{
  "deleted_rows": 1523,
  "deleted_files": 3
}
```

### GET /api/v1/delete/config

Get delete operation configuration.

---

## Database Management

Endpoints for managing databases programmatically.

### GET /api/v1/databases

List all databases with measurement counts.

**Response:**
```json
{
  "databases": [
    {"name": "default", "measurement_count": 5},
    {"name": "production", "measurement_count": 12}
  ],
  "count": 2
}
```

### POST /api/v1/databases

Create a new database.

**Request:**
```json
{
  "name": "my_database"
}
```

**Response (201 Created):**
```json
{
  "name": "my_database",
  "measurement_count": 0,
  "created_at": "2024-12-21T10:30:00Z"
}
```

**Validation rules:**
- Must start with a letter (a-z, A-Z)
- Can contain letters, numbers, underscores, and hyphens
- Maximum 64 characters
- Reserved names blocked: `system`, `internal`, `_internal`

**Error Response (400):**
```json
{
  "error": "Invalid database name: must start with a letter and contain only alphanumeric characters, underscores, or hyphens"
}
```

### GET /api/v1/databases/:name

Get information about a specific database.

**Response:**
```json
{
  "name": "production",
  "measurement_count": 12
}
```

**Error Response (404):**
```json
{
  "error": "Database 'nonexistent' not found"
}
```

### GET /api/v1/databases/:name/measurements

List all measurements in a database.

**Response:**
```json
{
  "database": "production",
  "measurements": [
    {"name": "cpu"},
    {"name": "memory"},
    {"name": "disk"}
  ],
  "count": 3
}
```

### DELETE /api/v1/databases/:name

Delete a database and all its data.

:::caution
This operation is destructive and cannot be undone. Requires:
- `delete.enabled = true` in configuration
- `?confirm=true` query parameter
:::

**Request:**
```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/databases/old_data?confirm=true"
```

**Response:**
```json
{
  "message": "Database 'old_data' deleted successfully",
  "files_deleted": 47
}
```

**Error Responses:**

*Delete disabled (403):*
```json
{
  "error": "Delete operations are disabled. Set delete.enabled=true in arc.toml to enable."
}
```

*Missing confirmation (400):*
```json
{
  "error": "Confirmation required. Add ?confirm=true to delete the database."
}
```

---

## Retention Policies

### POST /api/v1/retention

Create a retention policy.

**Request:**
```json
{
  "name": "30-day-retention",
  "database": "default",
  "measurement": "cpu",
  "duration": "30d",
  "schedule": "0 2 * * *"
}
```

### GET /api/v1/retention

List all retention policies.

### GET /api/v1/retention/:id

Get a specific policy.

### PUT /api/v1/retention/:id

Update a retention policy.

### DELETE /api/v1/retention/:id

Delete a retention policy.

### POST /api/v1/retention/:id/execute

Execute a policy manually.

### GET /api/v1/retention/:id/executions

Get policy execution history.

---

## Continuous Queries

### POST /api/v1/continuous_queries

Create a continuous query.

**Request:**
```json
{
  "name": "hourly-rollup",
  "source_database": "default",
  "source_measurement": "cpu",
  "destination_database": "default",
  "destination_measurement": "cpu_hourly",
  "query": "SELECT time_bucket('1 hour', time) as time, host, AVG(usage) as avg_usage FROM default.cpu GROUP BY 1, 2",
  "schedule": "0 * * * *"
}
```

### GET /api/v1/continuous_queries

List all continuous queries.

### GET /api/v1/continuous_queries/:id

Get a specific continuous query.

### PUT /api/v1/continuous_queries/:id

Update a continuous query.

### DELETE /api/v1/continuous_queries/:id

Delete a continuous query.

### POST /api/v1/continuous_queries/:id/execute

Execute a continuous query manually.

### GET /api/v1/continuous_queries/:id/executions

Get execution history.

---

## Response Formats

### Success Response

```json
{
  "status": "success",
  "data": [...],
  "count": 10
}
```

### Error Response

```json
{
  "error": "Error message"
}
```

### HTTP Status Codes

- `200` - Success
- `204` - No Content (successful write)
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (requires admin)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

Arc does not enforce rate limiting by default. For production deployments, consider:

- Reverse proxy rate limiting (Nginx, Traefik)
- API Gateway (AWS API Gateway, Kong)
- Application-level throttling

## CORS

CORS is enabled by default with permissive settings. Configure via reverse proxy for production.

## Best Practices

### 1. Use MessagePack for Writes

MessagePack is 5x faster than Line Protocol:

```python
# Fast: MessagePack columnar
data = {"m": "cpu", "columns": {...}}
requests.post(url, data=msgpack.packb(data))

# Slower: Line Protocol text
data = "cpu,host=server01 usage=45.2"
requests.post(url, data=data)
```

### 2. Batch Your Writes

Send multiple records per request:

```python
# Good: Batch write
data = {
    "m": "cpu",
    "columns": {
        "time": [t1, t2, t3, ...],
        "host": [h1, h2, h3, ...],
        "usage": [u1, u2, u3, ...]
    }
}
```

### 3. Use Arrow for Large Queries

For 10K+ rows, use the Arrow endpoint:

```python
response = requests.post(url + "/api/v1/query/arrow", ...)
table = pa.ipc.open_stream(response.content).read_all()
df = table.to_pandas()  # Zero-copy conversion
```

### 4. Enable Gzip Compression

```python
import gzip

compressed = gzip.compress(msgpack.packb(data))
requests.post(
    url,
    data=compressed,
    headers={"Content-Encoding": "gzip", ...}
)
```

## Client Libraries

### Python (Official SDK)

```bash
pip install arc-tsdb-client[all]
```

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    client.write.write_columnar(
        measurement="cpu",
        columns={"time": [...], "host": [...], "usage": [...]},
    )
    df = client.query.query_pandas("SELECT * FROM default.cpu LIMIT 10")
```

See [Python SDK Documentation](/arc/sdks/python/) for full details.

## Next Steps

- **[Python SDK](/arc/sdks/python/)** - Official Python client
- **[Getting Started](/arc/getting-started)** - Quick start guide
- **[Configuration](/arc/configuration/overview)** - Server configuration
