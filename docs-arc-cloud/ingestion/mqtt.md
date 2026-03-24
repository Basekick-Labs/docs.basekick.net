---
sidebar_position: 2
---

# MQTT Integration

Arc Cloud supports native MQTT ingestion, allowing you to stream data directly from IoT devices, sensors, and message brokers into your database.

:::info
MQTT integration is available on all paid tiers. The MQTT broker connection is managed per-instance.
:::

## Overview

Arc's built-in MQTT client connects to external brokers and subscribes to topics. Incoming messages are automatically parsed (JSON or MessagePack) and written to your database at up to **6M records/sec**.

Key capabilities:

- **Multiple simultaneous broker connections**
- **Topic wildcards** — `+` (single level) and `#` (multi-level)
- **Auto-detection** of JSON and MessagePack payloads
- **TLS/SSL** with client certificate support
- **QoS 0, 1, and 2**
- **Auto-reconnect** with exponential backoff

## Managing Subscriptions

Subscriptions are managed via the Arc API on your instance endpoint.

### Create a Subscription

```bash
curl -X POST https://<instance>.arc.<region>.basekick.net/api/v1/mqtt/subscriptions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "broker_url": "tcp://broker.example.com:1883",
    "topic": "sensors/#",
    "database": "iot",
    "measurement": "sensor_data",
    "qos": 1
  }'
```

### Topic Mapping

Map MQTT topic segments to database tags:

```json
{
  "broker_url": "tcp://broker.example.com:1883",
  "topic": "factory/{factory_id}/line/{line_id}/sensor/#",
  "database": "manufacturing",
  "measurement": "sensor_readings",
  "qos": 1
}
```

Topic segments wrapped in `{}` are extracted as tags. For example, a message on `factory/plant-1/line/assembly-3/sensor/temperature` creates tags `factory_id=plant-1` and `line_id=assembly-3`.

### Authentication

```json
{
  "broker_url": "ssl://broker.example.com:8883",
  "topic": "data/#",
  "database": "mydb",
  "measurement": "events",
  "username": "arc-client",
  "password": "secret",
  "tls": {
    "ca_cert": "/path/to/ca.pem",
    "client_cert": "/path/to/client.pem",
    "client_key": "/path/to/client-key.pem"
  }
}
```

### List Subscriptions

```bash
curl https://<instance>.arc.<region>.basekick.net/api/v1/mqtt/subscriptions \
  -H "Authorization: Bearer <token>"
```

### Delete a Subscription

```bash
curl -X DELETE https://<instance>.arc.<region>.basekick.net/api/v1/mqtt/subscriptions/<id> \
  -H "Authorization: Bearer <token>"
```

## Monitoring

Check subscription health and message rates:

```bash
curl https://<instance>.arc.<region>.basekick.net/api/v1/mqtt/subscriptions/<id>/status \
  -H "Authorization: Bearer <token>"
```

Metrics are also visible in the **Monitoring** tab of your instance dashboard.

## Use Cases

### IoT Sensor Data

```json
{
  "broker_url": "tcp://mqtt.example.com:1883",
  "topic": "devices/+/telemetry",
  "database": "iot",
  "measurement": "telemetry"
}
```

### Factory Floor Monitoring

```json
{
  "broker_url": "ssl://factory-broker:8883",
  "topic": "factory/{factory_id}/line/{line_id}/sensor/#",
  "database": "manufacturing",
  "measurement": "sensor_readings",
  "username": "arc",
  "password": "secret"
}
```

See the [Arc MQTT documentation](/arc/integrations/mqtt) for the full API reference and advanced configuration.
