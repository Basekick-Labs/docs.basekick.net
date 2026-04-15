---
sidebar_position: 8
---

# Redpanda Connect Integration

Stream data from any of Redpanda Connect's 200+ sources directly into Arc using the native Arc output plugin.

## Overview

[Redpanda Connect](https://github.com/redpanda-data/connect) (formerly Benthos) is a stream processor that connects sources to sinks with a single YAML config file. It handles transformations, filtering, batching, retries, and backpressure out of the box. Arc has a native output plugin that speaks Arc's MessagePack ingestion protocol directly, so data flows from your source into Arc's columnar storage with no translation layer.

**Benefits:**
- Native MessagePack columnar format with zstd compression
- 200+ input connectors (Kafka, HTTP, MQTT, S3, GCS, Postgres CDC, etc.)
- Bloblang transformations for reshaping, filtering, and enriching data in-flight
- Interpolated measurement names for per-message routing to different Arc tables
- Single binary, no JVM, no cluster required

## Why This Matters

Arc already has native ingestion paths for metrics ([Telegraf](/integrations/telegraf)) and IoT data ([MQTT](/integrations/mqtt)). Redpanda Connect covers a different gap: event-driven data that needs reshaping, filtering, or enrichment before it lands in Arc.

| Tool | Best For |
|------|----------|
| Telegraf | Pulling metrics from systems at fixed intervals |
| Native MQTT | Subscribing to IoT brokers directly |
| Redpanda Connect | Event streams, CDC, webhooks, complex transformations, fan-out pipelines |

Some concrete examples where Redpanda Connect fits:

- **Kafka to Arc** — consume events, filter out bot traffic, normalize timestamps, write to Arc
- **Webhooks to Arc** — receive HTTP webhooks from third-party APIs, reshape the payload, store for analytics
- **CDC to Arc** — capture Postgres/MySQL change events and stream them into Arc for historical tracking
- **Multi-destination** — send the same data to Arc and Kafka (or S3, or Elasticsearch) with different transformations per sink

## Prerequisites

- **Redpanda Connect 4.88 or higher** (required for the `arc` output)
- Arc server running and accessible
- Arc API token (if auth is enabled)

## Quick Start

### 1. Install Redpanda Connect

```bash
# Homebrew (macOS/Linux)
brew install redpanda-data/tap/redpanda-connect

# Docker
docker run --rm -v $(pwd)/config.yaml:/config.yaml \
  docker.redpanda.com/redpandadata/connect:latest run /config.yaml

# Direct binary download
# https://github.com/redpanda-data/connect/releases
```

Verify you have 4.88+:

```bash
redpanda-connect --version
```

### 2. Create a Pipeline Config

Create `arc-pipeline.yaml`:

```yaml
input:
  generate:
    count: 10
    interval: 1s
    mapping: |
      root.vehicle_id = "truck-" + random_int(min: 1, max: 5).string()
      root.lat = 40.7128 + (random_int(min: -1000, max: 1000).number() / 10000)
      root.lon = -74.0060 + (random_int(min: -1000, max: 1000).number() / 10000)
      root.speed_kmh = random_int(min: 0, max: 120)

output:
  arc:
    base_url: http://localhost:8000
    token: "${ARC_TOKEN}"
    database: logistics
    measurement: fleet_tracking
    format: columnar
    compression: zstd
    batching:
      count: 100
      period: 1s
```

### 3. Run the Pipeline

```bash
export ARC_TOKEN="your-arc-token"
redpanda-connect run arc-pipeline.yaml
```

Expected output:

```
INFO Running main config from specified file       path=arc-pipeline.yaml
INFO Input type generate is now active
INFO Output type arc is now active
INFO Pipeline has terminated. Shutting down the service
```

### 4. Verify Data in Arc

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT vehicle_id, speed_kmh FROM logistics.fleet_tracking ORDER BY time DESC LIMIT 10"}'
```

## Configuration Reference

| Option | Description | Default |
|--------|-------------|---------|
| `base_url` | Base URL of the Arc instance | Required |
| `token` | Bearer token for authentication | Optional |
| `database` | Target database in Arc | `default` |
| `measurement` | Measurement (table) name, supports interpolation | Required |
| `format` | Payload format: `columnar` or `row` | `columnar` |
| `compression` | Compression: `zstd`, `gzip`, or `none` | `zstd` |
| `timestamp_field` | Field name in the message containing the timestamp | empty (uses current time) |
| `timestamp_unit` | Unit of numeric timestamps: `us`, `ms`, `s`, `ns`, `auto` | `auto` |
| `tags_mapping` | Bloblang mapping to extract tags (row format only) | Optional |
| `tls` | TLS configuration | Optional |
| `batching` | Batch policy (`count`, `period`, `byte_size`) | None |
| `max_in_flight` | Maximum parallel batches | `64` |
| `timeout` | HTTP request timeout | `5s` |

## Payload Formats

### Columnar (default, recommended)

Transposes batched messages into column arrays. This is Arc's fastest ingestion path because it maps directly to Arc's Arrow buffers and avoids per-row overhead.

```yaml
output:
  arc:
    base_url: http://localhost:8000
    database: logistics
    measurement: fleet_tracking
    format: columnar
    compression: zstd
```

Requirement: all messages within a single batch must have the same set of fields. Arc validates this server-side and rejects batches with mismatched columns. Schema evolution across separate batches is fully supported.

### Row

Sends each message as an individual record with fields and optional tags. Useful when messages within a batch have varying schemas, or when you need per-message tags.

```yaml
output:
  arc:
    base_url: http://localhost:8000
    database: logistics
    measurement: fleet_tracking
    format: row
    tags_mapping: |
      root = {"vehicle_id": this.vehicle_id, "fleet": this.fleet, "region": this.region}
```

## Real-World Examples

### Kafka Events to Arc

Consume JSON events from a Kafka topic, drop bot traffic, reshape fields, and normalize the timestamp:

```yaml
input:
  kafka:
    addresses: ["kafka:9092"]
    topics: ["app-events"]
    consumer_group: "arc-analytics"

pipeline:
  processors:
    - mapping: |
        # Drop bot traffic
        root = if this.user_id.has_prefix("bot-") { deleted() }
        # Reshape the fields we care about
        root.user_id = this.user_id
        root.page = this.page
        root.duration_ms = this.duration_ms
        root.event_type = this.event

output:
  arc:
    base_url: http://localhost:8000
    token: "${ARC_TOKEN}"
    database: analytics
    measurement: page_views
    format: columnar
    timestamp_field: timestamp
    timestamp_unit: ms
    compression: zstd
    batching:
      count: 5000
      period: 5s
```

### HTTP Webhooks to Arc

Expose an HTTP endpoint that receives webhooks and writes them to Arc:

```yaml
input:
  http_server:
    address: "0.0.0.0:8080"
    path: /webhook

pipeline:
  processors:
    - mapping: |
        root.source = meta("Http_Header_X_Webhook_Source")
        root.received_at = now()
        root.payload = this

output:
  arc:
    base_url: http://localhost:8000
    token: "${ARC_TOKEN}"
    database: webhooks
    measurement: "${!metadata(\"Http_Header_X_Webhook_Source\")}"
    format: row
    compression: zstd
    batching:
      count: 100
      period: 2s
```

### MQTT to Arc with Transformations

When you want Redpanda Connect's transformation power on top of MQTT (instead of the native MQTT ingestion):

```yaml
input:
  mqtt:
    urls: ["tcp://broker.example.com:1883"]
    topics: ["sensors/#"]
    client_id: "arc-connect"

pipeline:
  processors:
    - mapping: |
        root.device_id = meta("mqtt_topic").split("/").index(1)
        root.reading = this.value
        root.temperature_c = (this.value - 32) * 5 / 9

output:
  arc:
    base_url: http://localhost:8000
    token: "${ARC_TOKEN}"
    database: sensors
    measurement: readings
    format: columnar
    compression: zstd
    batching:
      count: 1000
      period: 1s
```

### Multi-Destination Fan-Out

Send the same events to Arc and Kafka simultaneously:

```yaml
output:
  broker:
    pattern: fan_out
    outputs:
      - arc:
          base_url: http://localhost:8000
          token: "${ARC_TOKEN}"
          database: events
          measurement: user_actions
          format: columnar
      - kafka:
          addresses: ["kafka:9092"]
          topic: processed-events
```

## Dynamic Measurement Routing

The `measurement` field supports Redpanda Connect's Bloblang interpolation. Messages with different types can be routed to different Arc tables in a single pipeline:

```yaml
output:
  arc:
    base_url: http://localhost:8000
    database: telemetry
    # Messages with {"asset_type": "truck", ...} go to the "truck" table
    # Messages with {"asset_type": "drone", ...} go to the "drone" table
    measurement: ${!json("asset_type")}
```

Or route from message metadata (e.g., from Kafka headers, HTTP headers, or MQTT topics):

```yaml
output:
  arc:
    base_url: http://localhost:8000
    database: telemetry
    measurement: ${!metadata("measurement")}
```

## Bloblang Transformations

[Bloblang](https://docs.redpanda.com/redpanda-connect/guides/bloblang/about/) is Redpanda Connect's built-in mapping language. A few patterns that come up when writing to Arc:

### Drop messages conditionally

```yaml
processors:
  - mapping: |
      root = if this.value == null { deleted() }
```

### Flatten nested structures

```yaml
processors:
  - mapping: |
      root.device_id = this.device.id
      root.device_model = this.device.model
      root.reading = this.payload.reading
```

### Parse timestamps from strings

```yaml
processors:
  - mapping: |
      root.event_time = this.timestamp.ts_parse("2006-01-02T15:04:05Z")
      root.event_name = this.event
```

### Enrich with static or derived fields

```yaml
processors:
  - mapping: |
      root = this
      root.region = env("DEPLOY_REGION")
      root.ingested_at = now()
```

## Querying the Data

Once data is in Arc, query it with standard SQL:

```sql
-- Latest records per vehicle
SELECT vehicle_id, lat, lon, speed_kmh, time
FROM logistics.fleet_tracking
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC
LIMIT 100;

-- Average speed by vehicle over the last 24h
SELECT
    vehicle_id,
    AVG(speed_kmh) as avg_speed,
    MAX(speed_kmh) as max_speed,
    COUNT(*) as reading_count
FROM logistics.fleet_tracking
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY vehicle_id
ORDER BY avg_speed DESC;

-- Hourly throughput of ingested events
SELECT
    time_bucket(INTERVAL '1 hour', time) as hour,
    COUNT(*) as events
FROM analytics.page_views
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

## Performance Tuning

### Batch Size

Arc's columnar format is significantly more efficient with larger batches. Tune `batching.count` and `batching.period` based on your volume.

| Volume | Recommended `batching.count` |
|--------|------------------------------|
| Low (&lt;1K msg/sec) | 100 – 500 |
| Medium (1K – 10K/sec) | 1000 – 5000 |
| High (&gt;10K/sec) | 5000 – 10000 |

### Max In Flight

`max_in_flight` controls how many batches can be sent concurrently. Default is `64`. For very high throughput, increase it along with the Arc server's resources:

```yaml
output:
  arc:
    max_in_flight: 128
    batching:
      count: 5000
      period: 1s
```

### Compression Choice

- **`zstd`** (default) — Best decompression performance on the Arc server. Recommended for most workloads.
- **`gzip`** — Slightly smaller payloads but higher CPU. Use if the Arc server is I/O bound and CPU is plentiful.
- **`none`** — Only useful for debugging or when running on localhost with very small payloads.

### Format Choice

Prefer `columnar` whenever batches share a consistent schema. It is significantly faster end-to-end. Use `row` only when you need per-message tags or flexible per-message fields.

## Troubleshooting

### 401 Unauthorized

The Arc token is missing, invalid, or not being expanded by the shell.

```yaml
output:
  arc:
    token: "${ARC_TOKEN}"   # Make sure ARC_TOKEN is exported in your env
```

Test the token directly:

```bash
curl -H "Authorization: Bearer $ARC_TOKEN" http://localhost:8000/api/v1/query \
  -d '{"sql": "SHOW DATABASES"}'
```

### 400 Bad Request with "column length mismatch"

Columnar format requires all messages in a batch to share the same set of fields. If some messages have extra or missing fields, Arc rejects the batch.

Options:
- Switch to `format: row` if messages have varying schemas
- Add a Bloblang step that normalizes fields before the output
- Reduce batch size so each batch is more homogeneous

### Messages written but nothing queryable

Arc buffers data in memory before flushing to Parquet (default 5 seconds). If you're checking immediately after writing, wait a few seconds and try again. For very small batches in local dev, set:

```yaml
batching:
  count: 10
  period: 1s
```

### Measurement name rejected

Arc validates measurement names (alphanumeric, underscores, hyphens, max 64 chars, must start with a letter). If you're using interpolation, make sure the value is clean:

```yaml
measurement: ${!json("type").string()}
```

### Timestamps in the wrong unit

If your source produces timestamps in milliseconds but Arc is interpreting them as something else, set `timestamp_unit` explicitly:

```yaml
timestamp_field: ts
timestamp_unit: ms   # us | ms | s | ns | auto
```

The `auto` default detects the unit from magnitude, which is usually correct but fails for edge cases (e.g. very small timestamps from the 1970s).

## Resources

- [Arc output plugin source](https://github.com/redpanda-data/connect/tree/main/internal/impl/arc)
- [Arc output reference docs](https://docs.redpanda.com/redpanda-connect/components/outputs/arc/)
- [Redpanda Connect documentation](https://docs.redpanda.com/redpanda-connect/about/)
- [Bloblang language reference](https://docs.redpanda.com/redpanda-connect/guides/bloblang/about/)
- [Basekick blog post on the integration](https://basekick.net/update/arc-redpanda-connect-output-plugin)

## Next Steps

- Pair with [Grafana](/integrations/grafana) to visualize the data Redpanda Connect ingests
- Use [Arc's native MQTT](/integrations/mqtt) when you don't need transformations
- Use [Telegraf](/integrations/telegraf) for system/infrastructure metrics
