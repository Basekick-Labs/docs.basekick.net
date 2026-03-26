---
sidebar_position: 1
---

# API Reference

Arc Cloud instances expose the full Arc HTTP API. Any Arc client, SDK, or integration that works with Arc will work with Arc Cloud without modification -- including InfluxDB-compatible endpoints.

## Base URL

Each instance has a unique base URL:

```
https://<instance-id>.arc.<region>.basekick.net
```

For example, if your instance ID is `abc123` in `us-east`:

```
https://abc123.arc.us-east.basekick.net
```

You can find your instance's base URL on the dashboard overview page.

## Authentication

All API requests (except `/health`) require authentication. Arc Cloud supports multiple authentication methods:

| Method | Header / Param | Example |
|--------|---------------|---------|
| Bearer token (standard) | `Authorization: Bearer TOKEN` | Most clients and SDKs |
| Token prefix (InfluxDB 2.x) | `Authorization: Token TOKEN` | InfluxDB 2.x client libraries |
| API key header | `x-api-key: TOKEN` | Programmatic access |
| Query parameter (InfluxDB 1.x) | `?p=TOKEN` | Legacy InfluxDB 1.x tools |

Generate API tokens from **Settings > API Tokens** in your instance dashboard.

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check (no auth required) |
| `/api/v1/write/msgpack` | POST | MessagePack ingestion (fastest) |
| `/api/v1/write/line-protocol` | POST | Line protocol ingestion |
| `/write` | POST | InfluxDB 1.x compatible write |
| `/api/v2/write` | POST | InfluxDB 2.x compatible write |
| `/api/v1/query` | POST | SQL query (JSON response) |
| `/api/v1/query/arrow` | POST | SQL query (Arrow response) |
| `/api/v1/import/csv` | POST | CSV bulk import |
| `/api/v1/import/parquet` | POST | Parquet bulk import |
| `/api/v1/import/lp` | POST | Line protocol bulk import |
| `/api/v1/databases` | GET | List databases |
| `/api/v1/measurements` | GET | List measurements |

## Examples

### Health Check

```bash
curl https://abc123.arc.us-east.basekick.net/health
```

### Write Data (Line Protocol)

```bash
curl -X POST https://abc123.arc.us-east.basekick.net/api/v1/write/line-protocol \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/plain" \
  -d 'cpu,host=server01 usage=0.64 1711180800000000000
cpu,host=server02 usage=0.38 1711180800000000000'
```

### Write Data (MessagePack)

MessagePack is the fastest ingestion path. Use the Arc SDK or serialize your data as MessagePack and POST to the endpoint:

```bash
curl -X POST https://abc123.arc.us-east.basekick.net/api/v1/write/msgpack \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/msgpack" \
  --data-binary @data.msgpack
```

### Write Data (InfluxDB 2.x Compatible)

```bash
curl -X POST "https://abc123.arc.us-east.basekick.net/api/v2/write?bucket=mydb&precision=ns" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: text/plain" \
  -d 'cpu,host=server01 usage=0.64 1711180800000000000'
```

### Write Data (InfluxDB 1.x Compatible)

```bash
curl -X POST "https://abc123.arc.us-east.basekick.net/write?db=mydb&p=<token>" \
  -H "Content-Type: text/plain" \
  -d 'cpu,host=server01 usage=0.64 1711180800000000000'
```

### SQL Query (JSON)

```bash
curl -X POST https://abc123.arc.us-east.basekick.net/api/v1/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"q": "SELECT * FROM cpu WHERE host = '\''server01'\'' LIMIT 10"}'
```

### SQL Query (Arrow)

For large result sets, the Arrow response format is significantly more efficient:

```bash
curl -X POST https://abc123.arc.us-east.basekick.net/api/v1/query/arrow \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"q": "SELECT * FROM cpu ORDER BY time DESC LIMIT 1000"}' \
  --output results.arrow
```

### List Databases

```bash
curl https://abc123.arc.us-east.basekick.net/api/v1/databases \
  -H "Authorization: Bearer <token>"
```

### List Measurements

```bash
curl "https://abc123.arc.us-east.basekick.net/api/v1/measurements?db=mydb" \
  -H "Authorization: Bearer <token>"
```

### Bulk Import (CSV)

```bash
curl -X POST "https://abc123.arc.us-east.basekick.net/api/v1/import/csv?db=mydb&measurement=sensors&time_column=timestamp" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/csv" \
  --data-binary @data.csv
```

### Bulk Import (Parquet)

```bash
curl -X POST "https://abc123.arc.us-east.basekick.net/api/v1/import/parquet?db=mydb&measurement=sensors" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @data.parquet
```

## Response Format

JSON query responses (`/api/v1/query`) return the following structure:

```json
{
  "columns": ["time", "host", "usage"],
  "types": ["timestamp", "string", "float64"],
  "data": [
    ["2026-03-23T12:00:00Z", "server01", 0.64],
    ["2026-03-23T12:00:00Z", "server02", 0.38]
  ],
  "row_count": 2,
  "execution_time_ms": 3
}
```

On error:

```json
{
  "error": "Description of the error"
}
```

## Rate Limiting

Rate limits vary by tier. When you exceed your tier's ingest rate, the API returns a `429 Too Many Requests` response. See the [tier resource table](../configuration/instances.md#resource-allocation-per-tier) for ingest rate limits.

## Full API Documentation

For complete endpoint documentation, request/response schemas, and advanced usage, see the [Arc API Reference](/arc/api-reference).
