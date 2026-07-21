---
sidebar_position: 3
---

# MQTT Integration

Ingest data directly from MQTT brokers into Arc. Connect to IoT devices, industrial sensors, and message brokers without middleware.

:::info Available since v26.02.1
MQTT integration with API-driven subscription management is available starting Arc v26.02.1 (February 2026).
:::

## Overview

Arc provides native MQTT subscription with dynamic, API-driven configuration. Manage multiple MQTT brokers and subscriptions at runtime without server restarts.

**Key features:**
- **API-driven subscription management** - Create, update, delete, start/stop subscriptions via REST API
- **Multiple simultaneous brokers** - Connect to different MQTT brokers for different data sources
- **Topic wildcards** - Subscribe using `+` (single level) and `#` (multi-level) wildcards
- **Auto-detection** - Automatically detects JSON and MessagePack message formats
- **High performance** - ~6M records/sec with MessagePack columnar format
- **Topic mapping** - Extract tags from topic path segments
- **TLS/SSL support** - Client certificates and CA verification
- **Encrypted credentials** - Passwords encrypted at rest using AES-256-GCM
- **Auto-reconnect** - Exponential backoff on connection loss
- **QoS support** - QoS 0, 1, and 2

## Prerequisites

- Arc server running (v26.02.1 or higher)
- Arc API token (if authentication is enabled)
- MQTT broker accessible from Arc server

## Quick Start

### 1. Enable MQTT in Arc

MQTT is **disabled by default**. Enable it via either:

**Option A — environment variable (recommended for Docker / Kubernetes):**

```bash
ARC_MQTT_ENABLED=true
```

In `docker-compose.yml`:

```yaml
services:
  arc:
    environment:
      ARC_MQTT_ENABLED: "true"
```

Or with `docker run`:

```bash
docker run -e ARC_MQTT_ENABLED=true ...
```

**Option B — `arc.toml`:**

```toml
[mqtt]
enabled = true
```

Arc looks for `arc.toml` in `.`, `/etc/arc/`, and `$HOME/.arc/`. In containers, editing the file inside a running container does **not** persist across restarts — use the env-var path or mount the file as a volume.

Restart Arc after changing either source. Verify with:

```bash
curl http://localhost:8000/api/v1/mqtt/health
```

| Response                                            | Meaning                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `200` with `{"status":"healthy", ...}`              | MQTT is enabled and running.                                                                             |
| `200` with `{"status":"disabled","healthy":false}`  | MQTT was not enabled at startup. Check `ARC_MQTT_ENABLED` / `[mqtt].enabled` and restart.                |
| `503` with `{"error":"MQTT subsystem disabled"}`    | Same as above, on older builds.                                                                          |
| Plaintext `Cannot GET /api/v1/mqtt/health`          | Your Arc build pre-dates the MQTT API. Upgrade to a release that includes PR #416 (v26.05.1 or later).   |

### 2. Create a Subscription

```bash
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -d '{
    "name": "factory-sensors",
    "broker": "tcp://localhost:1883",
    "topics": ["sensors/#"],
    "database": "iot",
    "auto_start": true
  }'
```

Response:
```json
{
  "id": "sub_abc123",
  "name": "factory-sensors",
  "broker": "tcp://localhost:1883",
  "topics": ["sensors/#"],
  "database": "iot",
  "status": "running",
  "created_at": "2026-02-01T10:00:00Z"
}
```

### 3. Send Test Data

Publish a message to your MQTT broker:

```bash
mosquitto_pub -h localhost -t "sensors/temperature" \
  -m '{"time": 1706745600000000, "value": 23.5, "device_id": "sensor-001"}'
```

### 4. Query the Data

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM iot.temperature ORDER BY time DESC LIMIT 10",
    "format": "json"
  }'
```

## REST API Reference

### Subscription Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/mqtt/subscriptions` | Create a new subscription |
| `GET` | `/api/v1/mqtt/subscriptions` | List all subscriptions |
| `GET` | `/api/v1/mqtt/subscriptions/{id}` | Get subscription details |
| `PUT` | `/api/v1/mqtt/subscriptions/{id}` | Update subscription |
| `DELETE` | `/api/v1/mqtt/subscriptions/{id}` | Delete subscription |

### Lifecycle Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/mqtt/subscriptions/{id}/start` | Start subscription |
| `POST` | `/api/v1/mqtt/subscriptions/{id}/stop` | Stop subscription |
| `POST` | `/api/v1/mqtt/subscriptions/{id}/restart` | Restart subscription |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/mqtt/subscriptions/{id}/stats` | Get subscription stats |
| `GET` | `/api/v1/mqtt/stats` | Aggregate stats (all subscriptions) |
| `GET` | `/api/v1/mqtt/health` | Health check |

## Subscription Options

### Create Subscription Request

```json
{
  "name": "factory-sensors",
  "broker": "tcp://localhost:1883",
  "topics": ["sensors/#", "factory/+/metrics"],
  "database": "iot",
  "qos": 1,
  "client_id": "arc-factory",
  "username": "mqtt_user",
  "password": "mqtt_pass",
  "tls_enabled": false,
  "tls_cert_path": "/path/to/client.crt",
  "tls_key_path": "/path/to/client.key",
  "tls_ca_path": "/path/to/ca.crt",
  "topic_mapping": {},
  "keep_alive_seconds": 60,
  "connect_timeout_seconds": 30,
  "reconnect_max_seconds": 60,
  "auto_start": true
}
```

### Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | - | Unique subscription name |
| `broker` | string | Yes | - | MQTT broker URL (tcp://, ssl://, ws://, wss://) |
| `topics` | array | Yes | - | List of topics to subscribe |
| `database` | string | Yes | - | Target Arc database |
| `qos` | int | No | 1 | QoS level: 0, 1, or 2 |
| `client_id` | string | No | auto | MQTT client ID |
| `username` | string | No | - | MQTT username |
| `password` | string | No | - | MQTT password (encrypted at rest) |
| `tls_enabled` | bool | No | false | Enable TLS/SSL |
| `tls_cert_path` | string | No | - | Client certificate path |
| `tls_key_path` | string | No | - | Client key path |
| `tls_ca_path` | string | No | - | CA certificate path |
| `topic_mapping` | object (`{string: string}`) | No | {} | Per-topic target-database override: maps an exact MQTT topic to a database name, overriding `database` for messages on that topic. See [Topic Mapping](#topic-mapping-per-topic-database-override). |
| `keep_alive_seconds` | int | No | 60 | MQTT keep-alive interval |
| `connect_timeout_seconds` | int | No | 30 | Connection timeout |
| `reconnect_max_seconds` | int | No | 60 | Maximum reconnect backoff delay. The reconnect delay starts at 1 second and doubles up to this cap (the 1-second minimum is fixed by the MQTT client library and is not configurable). |
| `auto_start` | bool | No | true | Start on creation and server restart |

## Message Formats

Arc automatically detects the message format based on content.

### JSON Single Record

```json
{
  "time": 1706745600000000,
  "temperature": 23.5,
  "humidity": 65.2,
  "device_id": "sensor-001"
}
```

### JSON Batch

```json
[
  {"time": 1706745600000000, "temperature": 23.5},
  {"time": 1706745601000000, "temperature": 23.6},
  {"time": 1706745602000000, "temperature": 23.4}
]
```

### MessagePack Row-Based

Same structure as JSON, but MessagePack encoded. Detected via magic bytes.

### MessagePack Columnar (Fastest)

```
{
  "m": "temperature",
  "columns": {
    "time": [1706745600000000, 1706745601000000],
    "value": [23.5, 23.6],
    "device_id": ["sensor-001", "sensor-001"]
  }
}
```

**Performance:** ~6M records/sec with MessagePack columnar format.

### Timestamp Handling

- If `time` field is present: used as-is (auto-detects milliseconds/microseconds/nanoseconds)
- If `time` field is missing: current UTC time is used

## Measurement, Tags, and Fields

Arc derives the measurement, tags, and fields **from the message payload**, not from the topic structure. The topic itself is not parsed for the measurement name or for tag values.

For each decoded message:

- **Measurement** — taken from the payload's `m` field, or `measurement` field. If neither is present, it defaults to `mqtt`.
- **Tags** — taken from a `tags` object in the payload (string values).
- **Fields** — taken from a `fields` object if present; otherwise every remaining top-level key (anything other than `m`/`measurement`, `t`/`time`/`timestamp`, `tags`, `fields`) is treated as a field.
- **Timestamp** — from `t`, `time`, or `timestamp` (auto-detects ms/µs/ns); current UTC time if absent.

So to land in measurement `machine_metrics` with tags `line` and `machine_id`, publish a payload like:

```json
{
  "m": "machine_metrics",
  "time": 1706745600000000,
  "tags": { "line": "A", "machine_id": "42" },
  "fields": { "temperature": 71.5, "rpm": 1480 }
}
```

A flat payload with no `m`/`tags`/`fields` (e.g. `{"time": ..., "temperature": 23.5}`) is also accepted: it lands in the default `mqtt` measurement with the remaining keys as fields and no tags.

:::note
Deriving the measurement or tags from topic path segments (e.g. `tags_from_topic` / positional extraction) is **not** currently supported. Set the measurement and tags in the published payload as shown above.
:::

## Topic Mapping (Per-Topic Database Override)

`topic_mapping` maps an **exact MQTT topic string to a target database name**, overriding the subscription's `database` for messages received on that topic. It is a flat `{ "<topic>": "<database>" }` object — it does not configure measurements or tags.

```json
{
  "name": "factory-sensors",
  "broker": "tcp://localhost:1883",
  "topics": ["factory/line1/metrics", "factory/line2/metrics"],
  "database": "iot",
  "topic_mapping": {
    "factory/line2/metrics": "iot_line2"
  }
}
```

In this example, messages on `factory/line1/metrics` are written to the default `iot` database, while messages on `factory/line2/metrics` are routed to `iot_line2`.

:::note
The mapping key is matched against the message's actual topic by exact string equality — wildcard topic patterns (`+`, `#`) are not expanded for matching. A subscription may use wildcards in `topics`, but `topic_mapping` keys must be the concrete topics you want to route to a different database.
:::

## Authentication

### Basic Authentication

```bash
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "authenticated-broker",
    "broker": "tcp://broker.example.com:1883",
    "topics": ["data/#"],
    "database": "production",
    "username": "mqtt_user",
    "password": "mqtt_password"
  }'
```

### Password Encryption

Passwords are encrypted at rest using AES-256-GCM. Set the encryption key:

```bash
# Generate a 32-byte key
openssl rand -base64 32

# Set environment variable before starting Arc
export ARC_ENCRYPTION_KEY="your-base64-encoded-32-byte-key"
```

**Note:** The encryption key is only required when subscriptions have passwords. Subscriptions without credentials work without the key.

## TLS/SSL Configuration

### Server Certificate Verification

```bash
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "secure-broker",
    "broker": "ssl://broker.example.com:8883",
    "topics": ["secure/#"],
    "database": "production",
    "tls_enabled": true,
    "tls_ca_path": "/etc/arc/certs/ca.crt"
  }'
```

### Client Certificate Authentication

```bash
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mtls-broker",
    "broker": "ssl://broker.example.com:8883",
    "topics": ["secure/#"],
    "database": "production",
    "tls_enabled": true,
    "tls_cert_path": "/etc/arc/certs/client.crt",
    "tls_key_path": "/etc/arc/certs/client.key",
    "tls_ca_path": "/etc/arc/certs/ca.crt"
  }'
```

## Configuration Examples

### Multiple Brokers

Connect to different brokers for different environments:

```bash
# Production broker
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production",
    "broker": "ssl://prod-mqtt.example.com:8883",
    "topics": ["prod/#"],
    "database": "production",
    "tls_enabled": true
  }'

# Development broker
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "development",
    "broker": "tcp://dev-mqtt.example.com:1883",
    "topics": ["dev/#"],
    "database": "development"
  }'
```

### IoT Sensor Network

```bash
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iot-sensors",
    "broker": "tcp://mosquitto:1883",
    "topics": [
      "sensors/+/temperature",
      "sensors/+/humidity",
      "sensors/+/pressure"
    ],
    "database": "iot",
    "qos": 1
  }'
```

Devices set the measurement and tags in the payload — e.g. a temperature sensor publishes:

```json
{ "m": "temperature", "tags": { "sensor_id": "temp-001" }, "fields": { "value": 23.5 } }
```

### Industrial Factory

```bash
curl -X POST http://localhost:8000/api/v1/mqtt/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "factory-floor",
    "broker": "tcp://factory-mqtt:1883",
    "topics": ["factory/+/+/metrics"],
    "database": "manufacturing",
    "qos": 2
  }'
```

Machines publish the measurement and tags in the payload:

```json
{
  "m": "machine_metrics",
  "tags": { "line": "A", "machine_id": "42" },
  "fields": { "temperature": 71.5, "rpm": 1480 }
}
```

## Monitoring

### Subscription Stats

```bash
# Stats for a specific subscription
curl http://localhost:8000/api/v1/mqtt/subscriptions/{id}/stats

# Aggregate stats for all subscriptions
curl http://localhost:8000/api/v1/mqtt/stats
```

Response:
```json
{
  "status": "success",
  "running_count": 2,
  "subscriptions_stats": {
    "sub_abc123": {
      "messages_received": 15420,
      "bytes_received": 2458320,
      "decode_errors": 0,
      "last_message_at": "2026-02-01T10:30:15Z",
      "topics": {
        "sensors/temperature": 8500,
        "sensors/humidity": 6920
      }
    }
  }
}
```

`last_message_at` and `connected_since` are **omitted** when the subscription has not yet received a message / is not connected (rather than reporting a zero timestamp). When present they are always UTC.

### Health Check

```bash
curl http://localhost:8000/api/v1/mqtt/health
```

Response:
```json
{
  "status": "healthy",
  "healthy": true,
  "running_count": 2,
  "connected_count": 2,
  "disconnected_count": 0,
  "service": "mqtt_subscriptions"
}
```

### Prometheus Metrics

Arc exposes MQTT metrics for Prometheus:

| Metric | Type | Description |
|--------|------|-------------|
| `arc_mqtt_messages_received_total` | Counter | Total messages received |
| `arc_mqtt_bytes_received_total` | Counter | Total bytes received |
| `arc_mqtt_decode_errors_total` | Counter | Message decode errors |
| `arc_mqtt_connection_status` | Gauge | Connection status (1=connected) |

## Querying MQTT Data

### List Measurements

```sql
SHOW TABLES FROM iot;
```

### Basic Query

```sql
SELECT * FROM iot.temperature
ORDER BY time DESC
LIMIT 10;
```

### Time-Based Aggregation

```sql
SELECT
  time_bucket(INTERVAL '5 minutes', time) as bucket,
  AVG(value) as avg_temp,
  MIN(value) as min_temp,
  MAX(value) as max_temp
FROM iot.temperature
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket
ORDER BY bucket DESC;
```

### Filter by Tag

```sql
SELECT * FROM iot.sensor_data
WHERE sensor_id = 'temp-001'
  AND time > NOW() - INTERVAL '24 hours'
ORDER BY time DESC;
```

### Cross-Measurement Join

```sql
SELECT
  t.time,
  t.value as temperature,
  h.value as humidity
FROM iot.temperature t
JOIN iot.humidity h ON t.time = h.time AND t.sensor_id = h.sensor_id
WHERE t.time > NOW() - INTERVAL '1 hour'
ORDER BY t.time DESC;
```

## Troubleshooting

### Connection Failed

```bash
# Check subscription status
curl http://localhost:8000/api/v1/mqtt/subscriptions/{id}
```

If status is `error`, check:
- Broker URL is correct (tcp://, ssl://, ws://)
- Broker is reachable from Arc server
- Credentials are correct
- TLS certificates are valid

### No Data Appearing

1. Verify subscription is running:
```bash
curl http://localhost:8000/api/v1/mqtt/subscriptions/{id}
# status should be "running"
```

2. Check stats for received messages:
```bash
curl http://localhost:8000/api/v1/mqtt/subscriptions/{id}/stats
```

3. Verify topic pattern matches published topics

4. Check Arc logs for decode errors

### Messages Not Decoding

Ensure messages are valid JSON or MessagePack:

```bash
# Test with simple JSON
mosquitto_pub -h localhost -t "test/data" \
  -m '{"time": 1706745600000000, "value": 42}'
```

Check for decode errors in stats:
```bash
curl http://localhost:8000/api/v1/mqtt/subscriptions/{id}/stats | jq '.decode_errors'
```

### Subscription Won't Start

Check for errors:
```bash
curl http://localhost:8000/api/v1/mqtt/subscriptions/{id} | jq '.error_message'
```

Common issues:
- Another client using same client_id
- Invalid broker URL
- Network connectivity issues

## Best Practices

### 1. Use Descriptive Names

```json
{
  "name": "prod-factory-floor-sensors",
  "broker": "ssl://prod-mqtt.example.com:8883"
}
```

### 2. Separate Databases by Environment

```json
// Production
{"database": "production", "topics": ["prod/#"]}

// Staging
{"database": "staging", "topics": ["staging/#"]}
```

### 3. Use QoS Appropriately

- **QoS 0**: Fire-and-forget, no guarantees (highest throughput)
- **QoS 1**: At least once delivery (recommended for most cases)
- **QoS 2**: Exactly once delivery (highest overhead)

### 4. Cap the Reconnect Backoff

Reconnect uses an exponential backoff that starts at 1 second (fixed by the MQTT
client library) and doubles up to `reconnect_max_seconds`. Set the cap to bound
how long the client waits between attempts when a broker is down for a while:

```json
{
  "reconnect_max_seconds": 60
}
```

### 5. Use Topic Wildcards Efficiently

```
# Good - specific wildcards
sensors/+/temperature
factory/line1/+/metrics

# Avoid - too broad
#
sensors/#/#
```

### 6. Monitor Subscription Health

Set up alerts on:
- `arc_mqtt_connection_status == 0` (disconnected)
- `rate(arc_mqtt_decode_errors_total[5m]) > 0` (decode errors)

## Docker Compose Example

```yaml
version: '3.8'
services:
  arc:
    image: basekick/arc:latest
    ports:
      - "8000:8000"
    volumes:
      - arc-data:/data
    environment:
      - ARC_ENCRYPTION_KEY=${ARC_ENCRYPTION_KEY}
    depends_on:
      - mosquitto

  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf

volumes:
  arc-data:
```

**mosquitto.conf:**
```
listener 1883
allow_anonymous true
```

## Next Steps

- **[Query MQTT data](/arc/guides/querying)** - Learn SQL analytics
- **[Create Grafana dashboards](/arc/integrations/grafana)** - Visualize MQTT data
- **[Set up retention policies](/arc/data-lifecycle/retention-policies)** - Manage data lifecycle
- **[Configure alerts](/arc/integrations/grafana)** - Set up Grafana alerting on MQTT data
