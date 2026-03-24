---
sidebar_position: 4
---

# Integrations

Arc Cloud works with a wide ecosystem of data collection agents, visualization tools, and development environments. This guide covers configuration for each integration.

Throughout this guide, replace the base URL with your instance's endpoint:

```
https://<instance-id>.arc.<region>.basekick.net
```

You can find your instance endpoint on the instance detail page in the dashboard.

## Telegraf

[Telegraf](https://www.influxdata.com/time-series-platform/telegraf/) is an agent for collecting and sending metrics. Arc provides a native output plugin for maximum performance.

### Arc Output Plugin (Recommended)

The native Arc output plugin uses MessagePack columnar format for the best throughput (~9M records/sec). Requires **Telegraf 1.37+**.

```toml
[agent]
  interval = "10s"
  flush_interval = "10s"

[[outputs.arc]]
  url = "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/msgpack"
  api_key = "<your-api-token>"
  content_encoding = "gzip"
  database = "telegraf"

[[inputs.cpu]]
  percpu = true
  totalcpu = true

[[inputs.mem]]
[[inputs.disk]]
[[inputs.net]]
[[inputs.system]]
```

### InfluxDB v2 Output Plugin

If the Arc output plugin is not available in your Telegraf version, use the InfluxDB v2 output. Arc Cloud accepts InfluxDB 2.x writes on `/api/v2/write`.

```toml
[[outputs.influxdb_v2]]
  urls = ["https://<instance-id>.arc.<region>.basekick.net"]
  token = "<your-api-token>"
  organization = ""
  bucket = "telegraf"
```

The `organization` field is ignored by Arc but required by the plugin — set it to any value or leave it empty.

### Performance Tuning

```toml
[agent]
  metric_batch_size = 5000     # Larger batches for higher throughput
  metric_buffer_limit = 50000  # Buffer more metrics before dropping
```

| Volume | Recommended batch_size |
|--------|----------------------|
| Low (&lt;1K metrics/sec) | 1,000 |
| Medium (1K–10K/sec) | 5,000 |
| High (&gt;10K/sec) | 10,000 |

### Common Input Plugins

Telegraf has 300+ input plugins. Some commonly used with Arc Cloud:

| Plugin | Description |
|--------|-------------|
| `inputs.cpu` | CPU usage per core |
| `inputs.mem` | Memory statistics |
| `inputs.disk` | Disk usage |
| `inputs.net` | Network traffic |
| `inputs.docker` | Container metrics |
| `inputs.postgresql` | PostgreSQL monitoring |
| `inputs.redis` | Redis metrics |
| `inputs.http_response` | HTTP endpoint monitoring |

See the [full Telegraf integration guide](/integrations/telegraf) for query examples, Docker monitoring, and troubleshooting.

## Grafana

Connect Arc Cloud to [Grafana](https://grafana.com/) for real-time dashboards, alerting, and time-series visualization using the Arc datasource plugin.

### Installation

Install from the Grafana plugin catalog:

1. In Grafana, go to **Configuration** > **Plugins**
2. Search for **Arc**
3. Click **Install**

Or install from a release:

```bash
wget https://github.com/basekick-labs/grafana-arc-datasource/releases/download/v1.0.0/grafana-arc-datasource-1.0.0.zip
unzip grafana-arc-datasource-1.0.0.zip -d /var/lib/grafana/plugins/
systemctl restart grafana-server
```

### Configure Data Source

1. Go to **Configuration** > **Data sources** > **Add data source**
2. Select **Arc**
3. Set connection details:

| Setting | Value |
|---------|-------|
| **URL** | `https://<instance-id>.arc.<region>.basekick.net` |
| **API Key** | Your Arc Cloud API token |
| **Database** | Default database name |
| **Use Arrow** | `true` (enabled by default, 7x faster than JSON) |

Click **Save & Test** to verify.

### Time Macros

Grafana provides time macros for dynamic queries:

| Macro | Description |
|-------|-------------|
| `$__timeFilter(time)` | Complete time range filter |
| `$__timeFrom()` | Start of selected range |
| `$__timeTo()` | End of selected range |
| `$__interval` | Auto-calculated bucket interval |

### Example Dashboard Query

```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(usage_user + usage_system) AS cpu_usage,
  host
FROM telegraf.cpu
WHERE cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

### Template Variables

Create dynamic dashboards with variables:

```sql
-- Host selector variable
SELECT DISTINCT host FROM telegraf.cpu ORDER BY host
```

Then reference with `$host` in queries:

```sql
WHERE host IN ($hosts)
```

### Alerting

The Arc datasource supports Grafana alerting. Create alert rules directly from panel queries with conditions like "CPU > 80% for 5 minutes".

See the [full Grafana integration guide](/integrations/grafana) for dashboard examples, advanced queries (window functions, percentiles, cross-database), and performance optimization.

## VS Code Extension

The **Arc Database Manager** extension provides a full-featured IDE for working with Arc Cloud directly in Visual Studio Code.

### Installation

1. Open VS Code > **Extensions** (Ctrl+Shift+X / Cmd+Shift+X)
2. Search for **"Arc Database Manager"**
3. Click **Install**

Or from the command line:

```bash
code --install-extension basekick-labs.arc-db-manager
```

### Connect to Arc Cloud

1. Click **"Arc: Not Connected"** in the status bar
2. Enter your instance URL: `https://<instance-id>.arc.<region>.basekick.net`
3. Enter your API token

### Features

| Feature | Description |
|---------|-------------|
| **SQL IntelliSense** | Auto-completion for tables, columns, and DuckDB functions |
| **Interactive Results** | Sortable tables with export to CSV, JSON, Markdown |
| **Arc Notebooks** | Mix SQL and Markdown in `.arcnb` files with parameterized queries |
| **Schema Explorer** | Browse databases and tables with right-click context menus |
| **CSV Import** | Guided import wizard with auto-detection (~50K–100K rows/sec) |
| **Data Generator** | Generate test data from presets (CPU, memory, IoT sensors) |
| **Alerting** | Query-based alerts with desktop notifications |
| **Query History** | Automatic history with search and re-run |
| **Token Management** | Create, rotate, and delete tokens with secure keychain storage |

### Key Shortcuts

| Command | Windows/Linux | macOS |
|---------|--------------|-------|
| Execute Query | Ctrl+Enter | Cmd+Enter |
| New Query | Ctrl+Shift+P > Arc: New Query | Cmd+Shift+P > Arc: New Query |

See the [full VS Code extension guide](/integrations/vscode) for notebooks, CSV import, alerting, and troubleshooting.

## Apache Superset

Connect Arc Cloud to [Apache Superset](https://superset.apache.org/) for interactive BI dashboards using the Arc SQLAlchemy dialect.

### Installation

```bash
pip install arc-superset-dialect
```

Or use Docker with Arc pre-configured:

```bash
git clone https://github.com/basekick-labs/arc-superset-dialect.git
cd arc-superset-dialect
docker build -t superset-arc .
docker run -d -p 8088:8088 --name superset-arc superset-arc
```

### Connect to Arc Cloud

In Superset, go to **Settings** > **Database Connections** > **+ Database** > **Other**, then enter:

```
arc://<your-api-token>@<instance-id>.arc.<region>.basekick.net:443/default
```

Click **Test Connection** to verify.

Arc databases appear as schemas in Superset, so you can query across databases:

```sql
SELECT * FROM production.cpu LIMIT 10;
SELECT * FROM staging.cpu LIMIT 10;
```

### Chart Example

```sql
SELECT
  time_bucket(INTERVAL '5 minutes', time) as time,
  host,
  AVG(100 - usage_idle) as cpu_usage
FROM telegraf.cpu
WHERE time > NOW() - INTERVAL '6 hours'
GROUP BY time, host
ORDER BY time DESC
```

Superset supports all DuckDB SQL features including window functions, CTEs, percentiles, and cross-database joins.

See the [full Superset integration guide](/integrations/superset) for dashboard layouts, alerts, scheduled reports, and performance tips.

## OpenTelemetry

The OpenTelemetry Collector can forward traces, metrics, and logs to Arc Cloud using the Arc exporter, enabling unified observability in a single database.

```yaml
exporters:
  arc:
    endpoint: "https://<instance-id>.arc.<region>.basekick.net"
    token: "<your-api-token>"
    database: "otel"

service:
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [arc]
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [arc]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [arc]
```

:::tip
Use a dedicated database (e.g., `otel`) to keep observability data separate from application data. You can still query across databases with DuckDB SQL.
:::

See the [full OpenTelemetry integration guide](/integrations/opentelemetry) for configuration strategies, attribute mapping, and cross-signal correlation queries.

## InfluxDB Client Libraries

All InfluxDB client libraries work with Arc Cloud. Point the URL to your instance and provide your API token.

### Python

```python
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS

client = InfluxDBClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-api-token>",
    org=""
)

write_api = client.write_api(write_options=SYNCHRONOUS)
write_api.write(
    bucket="mydb",
    record="cpu,host=server01 usage=0.64"
)
```

### Go

```go
client := influxdb2.NewClient(
    "https://<instance-id>.arc.<region>.basekick.net",
    "<your-api-token>",
)
defer client.Close()

writeAPI := client.WriteAPIBlocking("", "mydb")
writeAPI.WriteRecord(
    context.Background(),
    "cpu,host=server01 usage=0.64",
)
```

### Node.js

```javascript
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

const client = new InfluxDB({
  url: "https://<instance-id>.arc.<region>.basekick.net",
  token: "<your-api-token>",
});

const writeApi = client.getWriteApi("", "mydb", "ns");
const point = new Point("cpu").tag("host", "server01").floatField("usage", 0.64);
writeApi.writePoint(point);
writeApi.close();
```

See the [full InfluxDB client compatibility guide](/integrations/influxdb-clients) for Java, C#, PHP, Ruby, and migration details.

## Vector

[Vector](https://vector.dev/) can send data to Arc Cloud via the HTTP sink, targeting the line protocol endpoint.

```toml
[sinks.arc_cloud]
  type = "http"
  inputs = ["your_source"]
  uri = "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol"
  method = "post"
  encoding.codec = "text"

  [sinks.arc_cloud.request.headers]
    Authorization = "Bearer <your-api-token>"
    Content-Type = "text/plain"
```

## Fluentd

Use the Fluentd HTTP output plugin to send data to Arc Cloud's line protocol endpoint.

```text
<match **>
  @type http
  endpoint https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol
  content_type text/plain
  headers {"Authorization": "Bearer <your-api-token>"}

  <format>
    @type single_value
    message_key message
  </format>

  <buffer>
    flush_interval 5s
  </buffer>
</match>
```

For structured metrics, consider writing a custom formatter that outputs line protocol, or use Vector as an intermediary.

## Python SDK

The official Arc Python SDK provides a high-level client for ingestion and queries.

```bash
pip install arc-tsdb-client[all]
```

```python
from arc_tsdb_client import ArcClient

client = ArcClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-api-token>",
)

# Write line protocol
client.write("mydb", "cpu,host=server01 usage=0.64")

# Query
result = client.query("SELECT * FROM cpu ORDER BY time DESC LIMIT 10")
print(result.to_pandas())

# Write a Pandas DataFrame
import pandas as pd

df = pd.DataFrame({
    "time": pd.to_datetime(["2026-03-24T12:00:00Z"]),
    "host": ["server01"],
    "usage": [0.64],
})
client.write_dataframe("mydb", "cpu", df, tag_columns=["host"])
```

## MQTT

Arc Cloud supports native MQTT ingestion for IoT and streaming workloads. See the dedicated [MQTT Integration](/arc-cloud/ingestion/mqtt) page for setup instructions, topic mapping, authentication, and use cases.
