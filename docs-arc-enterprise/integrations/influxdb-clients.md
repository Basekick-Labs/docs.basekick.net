---
sidebar_position: 4
---

# InfluxDB Client Compatibility

Arc's Line Protocol endpoints use the same paths as InfluxDB, enabling drop-in compatibility with all official InfluxDB client libraries. Point your existing InfluxDB client at Arc - it just works.

## Supported Clients

All official InfluxDB client libraries work with Arc without code changes:

| Language | Library | Version |
|----------|---------|---------|
| Go | `github.com/influxdata/influxdb-client-go` | v2.x |
| Python | `influxdb-client` | v1.x |
| JavaScript/Node.js | `@influxdata/influxdb-client` | v1.x |
| Java | `influxdb-client-java` | v6.x |
| C# | `InfluxDB.Client` | v4.x |
| PHP | `influxdb-client-php` | v3.x |
| Ruby | `influxdb-client-ruby` | v2.x |

**Also supported:**
- Telegraf (InfluxDB output plugin)
- Node-RED (`node-red-contrib-influxdb`)
- Grafana InfluxDB datasource
- Any tool using InfluxDB Line Protocol

## Endpoint Mapping

| InfluxDB Endpoint | Arc Endpoint | Use Case |
|-------------------|--------------|----------|
| `/write` | `/write` | InfluxDB 1.x clients |
| `/api/v2/write` | `/api/v2/write` | InfluxDB 2.x clients |

## Authentication Methods

Arc supports all InfluxDB authentication styles:

| Method | Header/Parameter | Example |
|--------|------------------|---------|
| Bearer Token | `Authorization: Bearer <token>` | Standard OAuth2 |
| Token Header | `Authorization: Token <token>` | InfluxDB 2.x style |
| Query Parameter | `?p=<token>` | InfluxDB 1.x style |

## Quick Start Examples

### Python (influxdb-client)

```python
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

# Point to Arc instead of InfluxDB
client = InfluxDBClient(
    url="http://localhost:8000",
    token="your-arc-token",
    org="myorg"  # Required but ignored by Arc
)

write_api = client.write_api(write_options=SYNCHRONOUS)

# Write data - works exactly like InfluxDB
point = Point("cpu") \
    .tag("host", "server01") \
    .field("usage", 45.2)

write_api.write(bucket="mydb", record=point)
client.close()
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
    // Point to Arc instead of InfluxDB
    client := influxdb2.NewClient("http://localhost:8000", "your-arc-token")
    defer client.Close()

    writeAPI := client.WriteAPIBlocking("myorg", "mydb")

    // Write data - works exactly like InfluxDB
    p := influxdb2.NewPoint(
        "cpu",
        map[string]string{"host": "server01"},
        map[string]interface{}{"usage": 45.2},
        time.Now(),
    )

    writeAPI.WritePoint(context.Background(), p)
}
```

### JavaScript/Node.js (@influxdata/influxdb-client)

```javascript
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// Point to Arc instead of InfluxDB
const client = new InfluxDB({
  url: 'http://localhost:8000',
  token: 'your-arc-token'
});

const writeApi = client.getWriteApi('myorg', 'mydb');

// Write data - works exactly like InfluxDB
const point = new Point('cpu')
  .tag('host', 'server01')
  .floatField('usage', 45.2);

writeApi.writePoint(point);
writeApi.close();
```

### Node-RED (node-red-contrib-influxdb)

Configure the InfluxDB node with:

- **Version**: 2.0
- **URL**: `http://your-arc-host:8000`
- **Token**: Your Arc API token
- **Organization**: Any value (ignored by Arc)
- **Bucket**: Your Arc database name

The node will automatically use `/api/v2/write` which Arc supports natively.

### Telegraf

```toml
[[outputs.influxdb_v2]]
  urls = ["http://localhost:8000"]
  token = "your-arc-token"
  organization = "myorg"
  bucket = "telegraf"
```

Or use the native Arc output plugin for better performance:

```toml
[[outputs.arc]]
  url = "http://localhost:8000/api/v1/write/msgpack"
  api_key = "your-arc-token"
  content_encoding = "gzip"
  database = "telegraf"
```

## Migration from InfluxDB

### Step 1: Update Connection URL

Change your InfluxDB URL to point to Arc:

```python
# Before (InfluxDB)
client = InfluxDBClient(url="http://influxdb:8086", ...)

# After (Arc)
client = InfluxDBClient(url="http://arc:8000", ...)
```

### Step 2: Use Arc Token

Replace your InfluxDB token with an Arc API token:

```bash
# Get token from Arc logs on first startup
docker logs arc 2>&1 | grep -i "admin"
```

### Step 3: Map Buckets to Databases

InfluxDB "buckets" map to Arc "databases":

| InfluxDB | Arc |
|----------|-----|
| Organization | Ignored |
| Bucket | Database |
| Measurement | Measurement |

### Step 4: Verify Connection

```bash
# Test write
curl -X POST "http://localhost:8000/api/v2/write?bucket=mydb&org=myorg" \
  -H "Authorization: Token your-arc-token" \
  -d 'test,host=server01 value=1'

# Query data
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer your-arc-token" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM mydb.test LIMIT 10", "format": "json"}'
```

## Connection Pooling

For high-throughput applications, enable HTTP connection pooling in your client. This reuses TCP connections instead of opening new ones for each request.

### Python

```python
from influxdb_client import InfluxDBClient
import urllib3

# Enable connection pooling
http = urllib3.PoolManager(
    num_pools=10,
    maxsize=50,
    retries=urllib3.Retry(3)
)

client = InfluxDBClient(
    url="http://localhost:8000",
    token="your-token",
    org="myorg"
)
```

### Node.js

```javascript
const { InfluxDB } = require('@influxdata/influxdb-client');
const http = require('http');

// Create agent with connection pooling
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10
});

const client = new InfluxDB({
  url: 'http://localhost:8000',
  token: 'your-token',
  transportOptions: {
    agent: agent
  }
});
```

## Differences from InfluxDB

While Arc is compatible with InfluxDB clients, there are some differences:

| Feature | InfluxDB | Arc |
|---------|----------|-----|
| Query Language | Flux, InfluxQL | SQL (DuckDB) |
| Organizations | Supported | Ignored |
| Retention Policies | Per-bucket | Via retention API |
| Tasks | Built-in | Via continuous queries |
| Flux Functions | Full support | Not supported |

## Querying Data

Arc uses SQL instead of Flux or InfluxQL. Use the Arc query API:

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT time, host, usage FROM mydb.cpu WHERE time > NOW() - INTERVAL '\''1 hour'\'' ORDER BY time DESC LIMIT 100",
    "format": "json"
  }'
```

Or use the [Arc Python SDK](/arc-enterprise/sdks/python/) for DataFrame support:

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    df = client.query.query_pandas(
        "SELECT * FROM mydb.cpu WHERE time > NOW() - INTERVAL '1 hour'"
    )
    print(df.head())
```

## Troubleshooting

### "404 Not Found" on /write

Ensure you're using Arc version 26.02.1 or later which includes the InfluxDB-compatible endpoints.

### Authentication Errors

Arc accepts tokens via:
- `Authorization: Bearer <token>`
- `Authorization: Token <token>`
- `?p=<token>` query parameter

### "Organization not found"

Arc ignores the organization parameter. Any value works.

### Data Not Appearing

1. Check the database exists or will be auto-created
2. Force a flush: `POST /api/v1/write/line-protocol/flush`
3. Verify with: `SELECT * FROM mydb.measurement LIMIT 1`

## Next Steps

- **[Python SDK](/arc-enterprise/sdks/python/)** - Native Arc client with DataFrame support
- **[Telegraf Integration](/arc-enterprise/integrations/telegraf)** - Native Arc output plugin
- **[API Reference](/arc-enterprise/api-reference/overview)** - Full endpoint documentation
