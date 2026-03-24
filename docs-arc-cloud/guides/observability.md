---
sidebar_position: 2
---

# Observability & Logging

Use Arc Cloud as a centralized logging and observability backend -- high ingestion throughput, columnar compression, and full SQL for querying logs and metrics.

## Why Arc Cloud for Logs

Traditional logging platforms charge per GB ingested and lock you into proprietary query languages. Arc Cloud offers:

- **High Ingestion Throughput**: Handle thousands to millions of log records per second depending on your tier
- **Columnar Compression**: Parquet storage compresses repetitive log fields (service names, log levels) by 10-50x
- **Full SQL Queries**: Use DuckDB SQL for log search, aggregation, and analysis -- no custom query syntax to learn
- **Telegraf Native Support**: Ship metrics and logs via Telegraf with Arc's native output plugin or InfluxDB v2 compatibility
- **Cost-Effective Retention**: Keep detailed logs short-term and aggregated metrics long-term

## Schema Design

### Recommended Log Schema

Arc uses a time-series data model. Logs map naturally to measurements with tags and fields:

| Column | Type | Description |
|--------|------|-------------|
| `time` | timestamp (ns) | When the log entry was created |
| `service` | tag | Service or application name |
| `host` | tag | Hostname or container ID |
| `level` | tag | Log level: `debug`, `info`, `warn`, `error`, `fatal` |
| `message` | field (string) | Log message text |
| `trace_id` | field (string) | Distributed trace identifier |
| `span_id` | field (string) | Span identifier within a trace |
| `endpoint` | field (string) | Request endpoint |
| `status_code` | field (integer) | HTTP status code |
| `latency_ms` | field (float) | Request latency in milliseconds |

### Example in Line Protocol

```
logs,service=api-gateway,host=pod-api-7f8b9c,level=error message="upstream timeout after 30s",trace_id="abc123def456",span_id="span_001",endpoint="/api/users",status_code=504i,latency_ms=30012.0 1711200721892000000
```

## Shipping Logs

### Telegraf (Recommended)

[Telegraf](https://www.influxdata.com/time-series-platform/telegraf/) is the recommended way to ship metrics and logs to Arc Cloud. Arc is wire-compatible with InfluxDB, so Telegraf works out of the box.

#### Using the InfluxDB v2 Output Plugin

```toml
# /etc/telegraf/telegraf.conf

# -- System metrics --
[[inputs.cpu]]
  percpu = true
  totalcpu = true

[[inputs.mem]]

[[inputs.disk]]
  ignore_fs = ["tmpfs", "devtmpfs"]

[[inputs.net]]

# -- Application logs --
[[inputs.tail]]
  files = ["/var/log/myapp/*.log"]
  data_format = "json"
  json_time_key = "timestamp"
  json_time_format = "2006-01-02T15:04:05Z07:00"
  json_tag_keys = ["service", "host", "level"]
  json_string_fields = ["message", "trace_id", "span_id", "endpoint"]

# -- Output to Arc Cloud --
[[outputs.influxdb_v2]]
  urls = ["https://<instance-id>.arc.<region>.basekick.net"]
  token = "<your-token>"
  organization = "-"
  bucket = "logs"
```

#### Using the InfluxDB v1 Output Plugin

If you prefer the v1 write path (uses the `/write` endpoint with `db` and `p` query parameters):

```toml
[[outputs.influxdb]]
  urls = ["https://<instance-id>.arc.<region>.basekick.net"]
  database = "logs"
  username = ""
  password = "<your-token>"
  skip_database_creation = true
```

#### Shipping Syslog via Telegraf

```toml
[[inputs.syslog]]
  server = "udp://0.0.0.0:6514"

[[outputs.influxdb_v2]]
  urls = ["https://<instance-id>.arc.<region>.basekick.net"]
  token = "<your-token>"
  organization = "-"
  bucket = "logs"
```

### Direct Line Protocol Ingestion

Send logs directly from your application using line protocol:

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=logs" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'logs,service=api-gateway,host=pod-api-7f8b9c,level=error message="upstream timeout after 30s",trace_id="abc123def456",endpoint="/api/users",status_code=504i,latency_ms=30012.0 1711200721892000000
logs,service=auth-service,host=pod-auth-3a2c1d,level=info message="token refreshed for user u_8f3k2",trace_id="abc123def456",user_id="u_8f3k2" 1711200722105000000'
```

### Python Logger Integration

```python
import logging
import time
import requests
from queue import Queue
from threading import Thread, Event

ARC_URL = "https://<instance-id>.arc.<region>.basekick.net"
ARC_TOKEN = "<your-token>"

class ArcCloudHandler(logging.Handler):
    """Log handler that ships logs to Arc Cloud via line protocol."""

    def __init__(self, database="logs", batch_size=100, flush_interval=5):
        super().__init__()
        self.database = database
        self.buffer = Queue()
        self.batch_size = batch_size
        self.stop_event = Event()
        self.flush_thread = Thread(target=self._flush_loop, args=(flush_interval,), daemon=True)
        self.flush_thread.start()

    def emit(self, record):
        level = record.levelname.lower()
        service = record.name
        host = record.module
        message = record.getMessage().replace('"', '\\"')
        timestamp_ns = int(record.created * 1_000_000_000)

        # Build line protocol
        line = f'logs,service={service},host={host},level={level} message="{message}" {timestamp_ns}'
        self.buffer.put(line)

        if self.buffer.qsize() >= self.batch_size:
            self._flush()

    def _flush(self):
        lines = []
        while not self.buffer.empty() and len(lines) < self.batch_size:
            lines.append(self.buffer.get())

        if lines:
            requests.post(
                f"{ARC_URL}/api/v1/write/line-protocol?db={self.database}",
                headers={
                    "Authorization": f"Bearer {ARC_TOKEN}",
                    "Content-Type": "text/plain",
                },
                data="\n".join(lines),
            )

    def _flush_loop(self, interval):
        while not self.stop_event.wait(interval):
            self._flush()

# Usage
logger = logging.getLogger("my-app")
logger.addHandler(ArcCloudHandler())
logger.setLevel(logging.INFO)

logger.info("Server started on port 8080")
logger.error("Database connection failed")
```

### Vector Configuration

Ship logs from [Vector](https://vector.dev) to Arc Cloud via the InfluxDB sink:

```toml
[sources.app_logs]
type = "file"
include = ["/var/log/myapp/*.log"]

[transforms.parse_logs]
type = "remap"
inputs = ["app_logs"]
source = '''
. = parse_json!(.message)
'''

[sinks.arc_cloud]
type = "influxdb_logs"
inputs = ["parse_logs"]
endpoint = "https://<instance-id>.arc.<region>.basekick.net"
bucket = "logs"
org = "-"
token = "<your-token>"

[sinks.arc_cloud.encoding]
codec = "json"
```

Alternatively, send line protocol directly via HTTP:

```toml
[sinks.arc_cloud]
type = "http"
inputs = ["parse_logs"]
uri = "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=logs"
method = "post"
encoding.codec = "text"

[sinks.arc_cloud.request]
headers.Authorization = "Bearer <your-token>"
headers.Content-Type = "text/plain"

[sinks.arc_cloud.batch]
max_events = 1000
timeout_secs = 5
```

### Fluentd Configuration

Ship logs from [Fluentd](https://www.fluentd.org) to Arc Cloud via line protocol:

```xml
<source>
  @type tail
  path /var/log/myapp/*.log
  pos_file /var/log/fluentd/myapp.pos
  tag myapp
  <parse>
    @type json
  </parse>
</source>

<match myapp>
  @type http
  endpoint https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=logs
  headers {"Authorization": "Bearer <your-token>", "Content-Type": "text/plain"}
  <buffer>
    flush_interval 5s
    chunk_limit_records 1000
  </buffer>
  <format>
    @type single_value
    message_key message
  </format>
</match>
```

:::tip
For Fluentd, consider using the [fluent-plugin-influxdb](https://github.com/fangli/fluent-plugin-influxdb) plugin which natively outputs line protocol and works with Arc's InfluxDB-compatible endpoint.
:::

## Querying Logs

Query your logs using SQL via the `/api/v1/query` endpoint:

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/query" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT time, level, service, message FROM logs.logs WHERE level = '\''error'\'' ORDER BY time DESC LIMIT 20", "format": "json"}'
```

## Example Queries

### Error Rate by Service

```sql
SELECT
    service,
    COUNT(*) FILTER (WHERE level = 'error') AS errors,
    COUNT(*) AS total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE level = 'error') / COUNT(*), 2) AS error_rate_pct
FROM logs.logs
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY service
ORDER BY error_rate_pct DESC;
```

### P95 Latency by Endpoint

```sql
SELECT
    endpoint,
    COUNT(*) AS requests,
    ROUND(AVG(latency_ms), 1) AS avg_latency_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 1) AS p95_latency_ms,
    ROUND(MAX(latency_ms), 1) AS max_latency_ms
FROM logs.logs
WHERE time > NOW() - INTERVAL '1 hour'
  AND latency_ms IS NOT NULL
GROUP BY endpoint
ORDER BY p95_latency_ms DESC;
```

### Log Search by Keyword

```sql
SELECT
    time,
    level,
    service,
    message
FROM logs.logs
WHERE time > NOW() - INTERVAL '24 hours'
  AND message ILIKE '%timeout%'
ORDER BY time DESC
LIMIT 100;
```

### Error Spike Detection

Find services with a sudden increase in errors compared to the previous hour:

```sql
WITH current_hour AS (
    SELECT service, COUNT(*) AS errors
    FROM logs.logs
    WHERE level = 'error'
      AND time > NOW() - INTERVAL '1 hour'
    GROUP BY service
),
previous_hour AS (
    SELECT service, COUNT(*) AS errors
    FROM logs.logs
    WHERE level = 'error'
      AND time BETWEEN NOW() - INTERVAL '2 hours' AND NOW() - INTERVAL '1 hour'
    GROUP BY service
)
SELECT
    c.service,
    c.errors AS current_errors,
    COALESCE(p.errors, 0) AS previous_errors,
    CASE
        WHEN COALESCE(p.errors, 0) = 0 THEN 999
        ELSE ROUND(100.0 * (c.errors - p.errors) / p.errors, 1)
    END AS pct_change
FROM current_hour c
LEFT JOIN previous_hour p ON c.service = p.service
WHERE c.errors > 10
ORDER BY pct_change DESC;
```

## Alerts via Continuous Queries

Use continuous queries to aggregate metrics and detect anomalies. Write alert summaries to a dedicated measurement that your alerting system can poll.

### Error Rate Aggregation

Create a continuous query that computes error rates every 5 minutes:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/continuous_queries \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "error_rate_5min",
    "database": "logs",
    "source_measurement": "logs",
    "destination_measurement": "error_rates",
    "query": "SELECT date_trunc('\''minute'\'', epoch_us(time)) - (EXTRACT(minute FROM epoch_us(time)) % 5) * INTERVAL '\''1 minute'\'' AS time, service, COUNT(*) FILTER (WHERE level = '\''error'\'') AS errors, COUNT(*) AS total FROM logs.logs GROUP BY 1, service",
    "interval": "5m",
    "is_active": true
  }'
```

### Latency Aggregation

Aggregate P95 latency per endpoint every 5 minutes:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/continuous_queries \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "latency_5min",
    "database": "logs",
    "source_measurement": "logs",
    "destination_measurement": "latency_metrics",
    "query": "SELECT date_trunc('\''minute'\'', epoch_us(time)) - (EXTRACT(minute FROM epoch_us(time)) % 5) * INTERVAL '\''1 minute'\'' AS time, endpoint, ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 1) AS p95_latency_ms, COUNT(*) AS request_count FROM logs.logs WHERE latency_ms IS NOT NULL GROUP BY 1, endpoint",
    "interval": "5m",
    "is_active": true
  }'
```

### Querying Alert Metrics

Poll the aggregated metrics to trigger alerts:

```sql
-- Services with error rate above 5% in the last 15 minutes
SELECT service, SUM(errors) AS total_errors, SUM(total) AS total_requests,
       ROUND(100.0 * SUM(errors) / SUM(total), 2) AS error_rate_pct
FROM logs.error_rates
WHERE time > NOW() - INTERVAL '15 minutes'
GROUP BY service
HAVING error_rate_pct > 5.0
ORDER BY error_rate_pct DESC;
```

## Retention Policies

Keep detailed logs for short-term debugging and aggregated metrics for long-term analysis.

### Keep Raw Logs for 7 Days

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/retention \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "raw_logs_7d",
    "database": "logs",
    "measurement": "logs",
    "retention_days": 7,
    "buffer_days": 1,
    "is_active": true
  }'
```

### Keep Aggregated Metrics for 90 Days

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/retention \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "error_rates_90d",
    "database": "logs",
    "measurement": "error_rates",
    "retention_days": 90,
    "buffer_days": 3,
    "is_active": true
  }'
```

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/retention \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "latency_metrics_90d",
    "database": "logs",
    "measurement": "latency_metrics",
    "retention_days": 90,
    "buffer_days": 3,
    "is_active": true
  }'
```

### Storage Strategy Summary

| Data | Retention | Purpose |
|------|-----------|---------|
| `logs` (raw) | 7 days | Full-text search, debugging, trace correlation |
| `error_rates` | 90 days | Error rate trends, alerting |
| `latency_metrics` | 90 days | Latency monitoring, SLA tracking |

## Next Steps

- [Data Ingestion Patterns](/arc-cloud/guides/data-ingestion) -- All ingestion methods and optimization
- [SQL Querying Guide](/arc/guides/querying) -- Full SQL reference
- [Telegraf Integration](/arc/integrations/telegraf) -- Ship system metrics alongside logs
- [OpenTelemetry Integration](/arc/integrations/opentelemetry) -- Send traces and metrics via OTLP
