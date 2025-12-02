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

### Public Endpoints (No Auth Required)

- `GET /` - API information
- `GET /health` - Health check
- `GET /ready` - Readiness probe
- `GET /docs` - Swagger UI
- `GET /openapi.json` - OpenAPI spec

## Quick Examples

### Write Data (MessagePack)

```python
import msgpack
import requests

data = {
    "batch": [{
        "m": "cpu",
        "t": 1697472000000,
        "h": "server01",
        "fields": {"usage": 45.2}
    }]
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

For large result sets, use Arrow format for 7.36x faster performance:

```python
import requests
import pyarrow as pa

response = requests.post(
    "http://localhost:8000/api/v1/query/arrow",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    json={"sql": "SELECT * FROM cpu LIMIT 100000"}
)

# Parse Arrow IPC stream
reader = pa.ipc.open_stream(response.content)
arrow_table = reader.read_all()
```

### Health Check

```bash
curl http://localhost:8000/health
```

## API Categories

### Data Ingestion

High-performance data writing endpoints.

- **POST /api/v1/write** - InfluxDB 1.x line protocol (text/plain)
- **POST /api/v1/write/line-protocol** - Standard line protocol endpoint
- **POST /api/v1/write/influxdb** - InfluxDB 2.x compatible endpoint
- **POST /api/v1/write/msgpack** - High-performance MessagePack format (recommended)

### Querying

Execute SQL queries with DuckDB.

- **POST /api/v1/query** - Run SQL queries (JSON format)
- **POST /api/v1/query/arrow** - Run SQL queries (Apache Arrow format)
- **POST /api/v1/query/stream** - Stream large datasets (CSV/JSON)

### Authentication

Manage API tokens and access control.

- **POST /api/v1/auth/verify** - Verify token validity
- **GET /api/v1/auth/tokens** - List all tokens
- **POST /api/v1/auth/tokens** - Create new token
- **DELETE /api/v1/auth/tokens/\{token_id\}** - Revoke token

### Health & Monitoring

Monitor Arc's health and performance.

- **GET /health** - Service health status
- **GET /ready** - Readiness probe
- **GET /** - API information and version

### Compaction

Manage Parquet file compaction.

- **GET /api/v1/compaction/status** - Current compaction state
- **POST /api/v1/compaction/trigger** - Trigger manual compaction
- **GET /api/v1/compaction/history** - View compaction job history
- **GET /api/v1/compaction/candidates** - List eligible partitions for compaction

### Write-Ahead Log (WAL)

Manage Write-Ahead Log for zero data loss.

- **GET /api/v1/wal/status** - Current WAL state
- **GET /api/v1/wal/stats** - WAL statistics and metrics
- **GET /api/v1/wal/files** - List WAL files
- **POST /api/v1/wal/flush** - Force WAL flush to Parquet
- **POST /api/v1/wal/compact** - Compact WAL files
- **POST /api/v1/wal/recover** - Recover data from WAL

### Data Lifecycle

Manage data retention, deletion, and aggregation.

**Retention Policies** - See [Retention Policies Documentation](/arc/data-lifecycle/retention-policies)
- **GET /api/v1/retention** - List all retention policies
- **POST /api/v1/retention** - Create new retention policy
- **GET /api/v1/retention/\{policy_id\}** - Get specific policy
- **PUT /api/v1/retention/\{policy_id\}** - Update retention policy
- **DELETE /api/v1/retention/\{policy_id\}** - Delete retention policy
- **POST /api/v1/retention/\{policy_id\}/execute** - Execute policy manually

**Delete Operations** - See [Delete Operations Documentation](/arc/data-lifecycle/delete-operations)
- **POST /api/v1/delete** - Delete data matching conditions

**Continuous Queries** - See [Continuous Queries Documentation](/arc/data-lifecycle/continuous-queries)
- **GET /api/v1/continuous_queries** - List all continuous queries
- **POST /api/v1/continuous_queries** - Create new continuous query
- **GET /api/v1/continuous_queries/\{query_id\}** - Get specific query
- **PUT /api/v1/continuous_queries/\{query_id\}** - Update continuous query
- **DELETE /api/v1/continuous_queries/\{query_id\}** - Delete continuous query
- **POST /api/v1/continuous_queries/\{query_id\}/execute** - Execute query manually

## Interactive Documentation

Arc includes auto-generated interactive API documentation:

### Swagger UI

Explore and test all endpoints with an interactive interface:

```
http://localhost:8000/docs
```

Features:
- Try endpoints directly from browser
- See request/response schemas
- Authentication token input
- Example values

### ReDoc

Beautiful API documentation with examples:

```
http://localhost:8000/redoc
```

Features:
- Clean, readable layout
- Code examples in multiple languages
- Search functionality
- Downloadable OpenAPI spec

### OpenAPI Specification

Download the OpenAPI 3.0 specification:

```
http://localhost:8000/openapi.json
```

Use this to generate client libraries in any language.

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
  "detail": "Error message",
  "status": 400
}
```

### HTTP Status Codes

- `200` - Success
- `204` - No Content (successful write)
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

Arc does not enforce rate limiting by default. For production deployments, consider:

- Reverse proxy rate limiting (Nginx, Traefik)
- API Gateway (AWS API Gateway, Kong)
- Application-level throttling

## CORS

CORS is disabled by default. Enable in `arc.conf`:

```toml
[server]
cors_enabled = true
cors_origins = ["http://localhost:3000", "https://your-app.com"]
```

## Versioning

Arc API uses URL versioning with the `/api/v1/` prefix:

- `/api/v1/write` - InfluxDB 1.x line protocol (text/plain)
- `/api/v1/write/line-protocol` - Standard line protocol endpoint
- `/api/v1/write/influxdb` - InfluxDB 2.x compatible endpoint
- `/api/v1/write/msgpack` - High-performance MessagePack format (recommended)
- `/api/v1/query` - SQL query endpoint (JSON format)
- `/api/v1/query/arrow` - Apache Arrow format queries
- `/api/v1/query/stream` - Streaming query results

## Client Libraries

### Python (Official SDK)

For production use, we recommend the official Python SDK which provides high-level abstractions, DataFrame integration, buffered writes, and comprehensive error handling.

```bash
pip install arc-tsdb-client[all]
```

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    # Write data (columnar format - 9M+ records/sec)
    client.write.write_columnar(
        measurement="cpu",
        columns={
            "time": [1704067200000000, 1704067260000000],
            "host": ["server01", "server01"],
            "usage": [45.2, 47.8],
        },
    )

    # Query to pandas DataFrame
    df = client.query.query_pandas("SELECT * FROM default.cpu LIMIT 10")
    print(df)
```

**Features:**
- High-performance columnar ingestion
- pandas, Polars, and PyArrow integration
- Buffered writes with automatic batching
- Full async support (`AsyncArcClient`)
- Retention policies, continuous queries, delete operations
- Token management

📖 **[Full Python SDK Documentation →](/arc/sdks/python/)**

### JavaScript (Example Implementation)

No official JavaScript SDK is available yet. Here's an example implementation:

```javascript
const msgpack = require('@msgpack/msgpack');
const axios = require('axios');

class ArcClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  async write(measurement, fields, tags = {}, timestamp = null) {
    const data = {
      batch: [{
        m: measurement,
        t: timestamp || Date.now(),
        h: tags.host || null,
        tags: tags,
        fields: fields
      }]
    };

    await this.client.post('/api/v1/write/msgpack',
      msgpack.encode(data),
      { headers: { 'Content-Type': 'application/msgpack' } }
    );
  }

  async query(sql) {
    const response = await this.client.post('/api/v1/query', {
      sql: sql,
      format: 'json'
    });
    return response.data;
  }
}

// Usage
const client = new ArcClient('http://localhost:8000', 'YOUR_TOKEN');
await client.write('cpu', { usage: 45.2 }, { host: 'server01' });
const data = await client.query('SELECT * FROM cpu LIMIT 10');
```

### Go (Example Implementation)

No official Go SDK is available yet. Here's an example implementation:

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"

    "github.com/vmihailenco/msgpack/v5"
)

type ArcClient struct {
    BaseURL string
    Token   string
    Client  *http.Client
}

type Measurement struct {
    M      string                 `msgpack:"m"`
    T      int64                  `msgpack:"t"`
    H      string                 `msgpack:"h,omitempty"`
    Tags   map[string]string      `msgpack:"tags,omitempty"`
    Fields map[string]interface{} `msgpack:"fields"`
}

func (c *ArcClient) Write(m string, fields map[string]interface{}, tags map[string]string) error {
    data := map[string][]Measurement{
        "batch": {{
            M:      m,
            T:      time.Now().UnixMilli(),
            H:      tags["host"],
            Tags:   tags,
            Fields: fields,
        }},
    }

    body, _ := msgpack.Marshal(data)
    req, _ := http.NewRequest("POST", c.BaseURL+"/api/v1/write/msgpack", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer "+c.Token)
    req.Header.Set("Content-Type", "application/msgpack")

    _, err := c.Client.Do(req)
    return err
}

func (c *ArcClient) Query(sql string) (map[string]interface{}, error) {
    query := map[string]string{"sql": sql, "format": "json"}
    body, _ := json.Marshal(query)

    req, _ := http.NewRequest("POST", c.BaseURL+"/api/v1/query", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer "+c.Token)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    return result, nil
}

// Usage
func main() {
    client := &ArcClient{
        BaseURL: "http://localhost:8000",
        Token:   "YOUR_TOKEN",
        Client:  &http.Client{},
    }

    client.Write("cpu", map[string]interface{}{"usage": 45.2}, map[string]string{"host": "server01"})
    data, _ := client.Query("SELECT * FROM cpu LIMIT 10")
    fmt.Println(data)
}
```

## Best Practices

### 1. Use MessagePack for Writes

MessagePack is 8x faster than Line Protocol:

```python
# Fast: MessagePack binary
data = msgpack.packb({"batch": [...]})

# Slow: Line Protocol text
data = "cpu,host=server01 usage=45.2"
```

### 2. Batch Your Writes

Send multiple measurements in a single request:

```python
# Good: Batch write
data = {
    "batch": [
        {"m": "cpu", "t": ts, "fields": {...}},
        {"m": "mem", "t": ts, "fields": {...}},
        {"m": "disk", "t": ts, "fields": {...}}
    ]
}

# Bad: Individual writes
for measurement in measurements:
    client.write(measurement)  # Too many HTTP requests
```

### 3. Handle Errors Gracefully

```python
import time

def write_with_retry(client, data, max_retries=3):
    for attempt in range(max_retries):
        try:
            client.write(data)
            return
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

### 4. Use Connection Pooling

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
adapter = HTTPAdapter(
    pool_connections=10,
    pool_maxsize=100,
    max_retries=Retry(total=3, backoff_factor=0.1)
)
session.mount('http://', adapter)
session.mount('https://', adapter)

# Use session instead of requests
session.post(url, data=data, headers=headers)
```

### 5. Stream Large Query Results

```python
# For large datasets, use streaming
response = requests.post(
    "http://localhost:8000/api/v1/query/stream",
    headers=headers,
    json={"sql": "SELECT * FROM cpu", "format": "csv"},
    stream=True
)

for chunk in response.iter_content(chunk_size=8192):
    process_chunk(chunk)
```

## Next Steps

- **[Python SDK →](/arc/sdks/python/)** - Official Python client with DataFrame support
- **[Getting Started →](/arc/getting-started)** - Learn how to use Arc
- **[Data Lifecycle →](/arc/data-lifecycle/retention-policies)** - Manage data retention and deletion
- **[Interactive Docs →](http://localhost:8000/docs)** - Try the API with Swagger UI
- **[OpenAPI Spec →](http://localhost:8000/openapi.json)** - Download OpenAPI specification
