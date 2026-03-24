---
sidebar_position: 6
---

# Integrations

Arc Cloud is compatible with the InfluxDB write API, line protocol, OpenTelemetry, and a wide range of data collection agents. This guide covers configuration for the most common integrations.

Throughout this guide, replace the base URL with your instance's URL:

```
https://<instance-id>.arc.<region>.basekick.net
```

## Telegraf

### Arc Output Plugin (Native)

Telegraf supports Arc natively via the Arc output plugin. This is the recommended approach for best performance.

```toml
[[outputs.arc]]
  url = "https://<instance-id>.arc.<region>.basekick.net"
  token = "<your-api-token>"
  database = "telegraf"
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

The `organization` field is ignored by Arc but required by the plugin -- set it to any value or leave it empty.

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
package main

import (
    "context"
    influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
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
}
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

## OpenTelemetry

The OpenTelemetry Collector can forward traces, metrics, and logs to Arc Cloud using the Arc exporter.

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

```xml
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

### Installation

```bash
pip install arc-tsdb-client[all]
```

### Usage

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
    "time": pd.to_datetime(["2026-03-23T12:00:00Z"]),
    "host": ["server01"],
    "usage": [0.64],
})
client.write_dataframe("mydb", "cpu", df, tag_columns=["host"])
```

## MQTT

Arc Cloud instances that have MQTT enabled can subscribe to MQTT topics for IoT data ingestion. Check your instance dashboard under **Settings > Protocols** to confirm MQTT availability.

```
mqtt://<instance-id>.arc.<region>.basekick.net:1883
```

Authenticate with your API token as the MQTT password. The MQTT topic maps to the measurement name.
