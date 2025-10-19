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
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/query
```

### Public Endpoints (No Auth Required)

- `GET /` - API information
- `GET /health` - Health check
- `GET /ready` - Readiness probe
- `GET /docs` - Swagger UI
- `GET /redoc` - ReDoc
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
    "http://localhost:8000/write/v1/msgpack",
    headers={
        "Authorization": "Bearer YOUR_TOKEN",
        "Content-Type": "application/msgpack"
    },
    data=msgpack.packb(data)
)
```

### Query Data (JSON)

```bash
curl -X POST http://localhost:8000/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM cpu LIMIT 10"}'
```

### Query Data (Apache Arrow)

For large result sets, use Arrow format for 7.36x faster performance:

```python
import requests
import pyarrow as pa

response = requests.post(
    "http://localhost:8000/query/arrow",
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

- **[MessagePack Protocol](/arc/api-reference/ingestion#messagepack)** (Recommended - 8x faster)
- **[Line Protocol](/arc/api-reference/ingestion#line-protocol)** (InfluxDB compatible)
- **[JSON API](/arc/api-reference/ingestion#json)** (Simple integration)

[View Ingestion API →](/arc/api-reference/ingestion)

### Querying

Execute SQL queries with DuckDB.

- **[Execute Query](/arc/api-reference/queries#execute)** - Run SQL queries (JSON format)
- **[Execute Query (Arrow)](/arc/api-reference/queries#arrow)** - Run SQL queries (Apache Arrow format)
- **[Stream Results](/arc/api-reference/queries#stream)** - Stream large datasets
- **[Query Estimation](/arc/api-reference/queries#estimate)** - Estimate query cost
- **[List Measurements](/arc/api-reference/queries#list)** - Show available tables

[View Query API →](/arc/api-reference/queries)

### Authentication

Manage API tokens and access control.

- **[Create Token](/arc/api-reference/auth#create)** - Generate new tokens
- **[List Tokens](/arc/api-reference/auth#list)** - View all tokens
- **[Rotate Token](/arc/api-reference/auth#rotate)** - Generate new token value
- **[Delete Token](/arc/api-reference/auth#delete)** - Revoke access

[View Auth API →](/arc/api-reference/auth)

### Health & Monitoring

Monitor Arc's health and performance.

- **[Health Check](/arc/api-reference/monitoring#health)** - Service status
- **[Metrics](/arc/api-reference/monitoring#metrics)** - Prometheus metrics
- **[Memory Profile](/arc/api-reference/monitoring#memory)** - Memory usage
- **[Logs](/arc/api-reference/monitoring#logs)** - Application logs

[View Monitoring API →](/arc/api-reference/monitoring)

### Compaction

Manage Parquet file compaction.

- **[Status](/arc/api-reference/compaction#status)** - Current compaction state
- **[Trigger](/arc/api-reference/compaction#trigger)** - Manual compaction
- **[History](/arc/api-reference/compaction#history)** - Job history
- **[Candidates](/arc/api-reference/compaction#candidates)** - Eligible partitions

[View Compaction API →](/arc/api-reference/compaction)

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

Arc API uses URL versioning:

- `/write` - Current version (InfluxDB compatibility)
- `/write/v1/msgpack` - Versioned MessagePack endpoint
- `/api/v1/write` - InfluxDB 1.x compatible
- `/api/v1/write/influxdb` - InfluxDB 2.x compatible

## Client Libraries

### Python

```python
import msgpack
import requests

class ArcClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}"}

    def write(self, measurement, fields, tags=None, timestamp=None):
        data = {
            "batch": [{
                "m": measurement,
                "t": timestamp or int(time.time() * 1000),
                "h": tags.get("host") if tags else None,
                "tags": tags,
                "fields": fields
            }]
        }

        response = requests.post(
            f"{self.base_url}/write/v1/msgpack",
            headers={**self.headers, "Content-Type": "application/msgpack"},
            data=msgpack.packb(data)
        )
        response.raise_for_status()

    def query(self, sql):
        response = requests.post(
            f"{self.base_url}/query",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"sql": sql, "format": "json"}
        )
        response.raise_for_status()
        return response.json()

# Usage
client = ArcClient("http://localhost:8000", "YOUR_TOKEN")
client.write("cpu", {"usage": 45.2}, tags={"host": "server01"})
data = client.query("SELECT * FROM cpu LIMIT 10")
```

### JavaScript

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

    await this.client.post('/write/v1/msgpack',
      msgpack.encode(data),
      { headers: { 'Content-Type': 'application/msgpack' } }
    );
  }

  async query(sql) {
    const response = await this.client.post('/query', {
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

### Go

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
    req, _ := http.NewRequest("POST", c.BaseURL+"/write/v1/msgpack", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer "+c.Token)
    req.Header.Set("Content-Type", "application/msgpack")

    _, err := c.Client.Do(req)
    return err
}

func (c *ArcClient) Query(sql string) (map[string]interface{}, error) {
    query := map[string]string{"sql": sql, "format": "json"}
    body, _ := json.Marshal(query)

    req, _ := http.NewRequest("POST", c.BaseURL+"/query", bytes.NewBuffer(body))
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
    "http://localhost:8000/query/stream",
    headers=headers,
    json={"sql": "SELECT * FROM cpu"},
    stream=True
)

for chunk in response.iter_content(chunk_size=8192):
    process_chunk(chunk)
```

## Next Steps

- **[Ingestion API →](/arc/api-reference/ingestion)** - Write data to Arc
- **[Query API →](/arc/api-reference/queries)** - Execute SQL queries
- **[Authentication →](/arc/api-reference/auth)** - Manage tokens
- **[Interactive Docs →](http://localhost:8000/docs)** - Try the API
