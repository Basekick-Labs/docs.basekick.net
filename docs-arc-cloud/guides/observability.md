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
- **Schema Flexibility**: Auto-detect columns from your log payloads, add new fields at any time
- **Cost-Effective Retention**: Keep detailed logs short-term and aggregated metrics long-term

## Schema Design

### Recommended Log Schema

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | ISO 8601 string | When the log entry was created |
| `level` | string | Log level: `debug`, `info`, `warn`, `error`, `fatal` |
| `service` | string | Service or application name |
| `host` | string | Hostname or container ID |
| `message` | string | Log message text |
| `trace_id` | string | Distributed trace identifier |
| `span_id` | string | Span identifier within a trace |
| `metadata` | JSON string | Additional structured data |

### Example Log Payload

```json
{
  "timestamp": "2026-03-23T14:32:01.892Z",
  "level": "error",
  "service": "api-gateway",
  "host": "pod-api-7f8b9c",
  "message": "upstream timeout after 30s",
  "trace_id": "abc123def456",
  "span_id": "span_001",
  "metadata": "{\"endpoint\": \"/api/users\", \"status_code\": 504, \"latency_ms\": 30012}"
}
```

## Shipping Logs

### Direct HTTP Ingestion

Send logs directly from your application:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/ingest \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "database": "logs",
    "records": [
      {
        "timestamp": "2026-03-23T14:32:01.892Z",
        "level": "error",
        "service": "api-gateway",
        "host": "pod-api-7f8b9c",
        "message": "upstream timeout after 30s",
        "trace_id": "abc123def456",
        "metadata": "{\"endpoint\": \"/api/users\", \"status_code\": 504, \"latency_ms\": 30012}"
      },
      {
        "timestamp": "2026-03-23T14:32:02.105Z",
        "level": "info",
        "service": "auth-service",
        "host": "pod-auth-3a2c1d",
        "message": "token refreshed for user u_8f3k2",
        "trace_id": "abc123def456",
        "metadata": "{\"user_id\": \"u_8f3k2\"}"
      }
    ]
  }'
```

### Python Logger Integration

```python
import logging
import json
import requests
from datetime import datetime
from queue import Queue
from threading import Thread, Event

ARC_URL = "https://<instance-id>.arc.<region>.basekick.net"
ARC_TOKEN = "<your-token>"

class ArcCloudHandler(logging.Handler):
    """Log handler that ships logs to Arc Cloud in batches."""

    def __init__(self, batch_size=100, flush_interval=5):
        super().__init__()
        self.buffer = Queue()
        self.batch_size = batch_size
        self.stop_event = Event()

        # Background thread flushes periodically
        self.flush_thread = Thread(target=self._flush_loop, args=(flush_interval,), daemon=True)
        self.flush_thread.start()

    def emit(self, record):
        self.buffer.put({
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "service": record.name,
            "host": record.module,
            "message": record.getMessage(),
            "metadata": json.dumps(getattr(record, "extra", {})),
        })

        if self.buffer.qsize() >= self.batch_size:
            self._flush()

    def _flush(self):
        records = []
        while not self.buffer.empty() and len(records) < self.batch_size:
            records.append(self.buffer.get())

        if records:
            requests.post(
                f"{ARC_URL}/api/v1/ingest",
                headers={"Authorization": f"Bearer {ARC_TOKEN}"},
                json={"database": "logs", "records": records},
            )

    def _flush_loop(self, interval):
        while not self.stop_event.wait(interval):
            self._flush()

# Usage
logger = logging.getLogger("my-app")
logger.addHandler(ArcCloudHandler())
logger.setLevel(logging.INFO)

logger.info("Server started on port 8080")
logger.error("Database connection failed", extra={"extra": {"db_host": "db-01", "retry": 3}})
```

### Vector Configuration

Ship logs from [Vector](https://vector.dev) to Arc Cloud:

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
type = "http"
inputs = ["parse_logs"]
uri = "https://<instance-id>.arc.<region>.basekick.net/api/v1/ingest"
method = "post"
encoding.codec = "json"

[sinks.arc_cloud.request]
headers.Authorization = "Bearer <your-token>"
headers.Content-Type = "application/json"

[sinks.arc_cloud.batch]
max_events = 1000
timeout_secs = 5
```

### Fluentd Configuration

Ship logs from [Fluentd](https://www.fluentd.org) to Arc Cloud:

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
  endpoint https://<instance-id>.arc.<region>.basekick.net/api/v1/ingest
  headers {"Authorization": "Bearer <your-token>", "Content-Type": "application/json"}
  json_array true
  <buffer>
    flush_interval 5s
    chunk_limit_records 1000
  </buffer>
  <format>
    @type json
  </format>
</match>
```

### Telegraf Configuration

Ship logs and metrics via [Telegraf](https://www.influxdata.com/time-series-platform/telegraf/):

```toml
[[inputs.tail]]
  files = ["/var/log/myapp/*.log"]
  data_format = "json"
  json_time_key = "timestamp"
  json_time_format = "2006-01-02T15:04:05Z07:00"

[[outputs.http]]
  url = "https://<instance-id>.arc.<region>.basekick.net/api/v1/ingest"
  method = "POST"
  data_format = "json"
  [outputs.http.headers]
    Authorization = "Bearer <your-token>"
    Content-Type = "application/json"
```

## Example Queries

### Error Rate by Service

```sql
SELECT
    service,
    COUNT(*) FILTER (WHERE level = 'error') AS errors,
    COUNT(*) AS total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE level = 'error') / COUNT(*), 2) AS error_rate_pct
FROM logs.events
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY service
ORDER BY error_rate_pct DESC;
```

### P95 Latency by Endpoint

Extract latency from the metadata JSON column:

```sql
SELECT
    json_extract_string(metadata, '$.endpoint') AS endpoint,
    COUNT(*) AS requests,
    ROUND(AVG(CAST(json_extract(metadata, '$.latency_ms') AS DOUBLE)), 1) AS avg_latency_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (
        ORDER BY CAST(json_extract(metadata, '$.latency_ms') AS DOUBLE)
    ), 1) AS p95_latency_ms,
    ROUND(MAX(CAST(json_extract(metadata, '$.latency_ms') AS DOUBLE)), 1) AS max_latency_ms
FROM logs.events
WHERE time > NOW() - INTERVAL '1 hour'
  AND json_extract(metadata, '$.latency_ms') IS NOT NULL
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
FROM logs.events
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
    FROM logs.events
    WHERE level = 'error'
      AND time > NOW() - INTERVAL '1 hour'
    GROUP BY service
),
previous_hour AS (
    SELECT service, COUNT(*) AS errors
    FROM logs.events
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
    "source_measurement": "events",
    "destination_measurement": "error_rates",
    "query": "SELECT date_trunc('\''minute'\'', epoch_us(time)) - (EXTRACT(minute FROM epoch_us(time)) % 5) * INTERVAL '\''1 minute'\'' AS time, service, COUNT(*) FILTER (WHERE level = '\''error'\'') AS errors, COUNT(*) AS total FROM logs.events GROUP BY 1, service",
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
    "source_measurement": "events",
    "destination_measurement": "latency_metrics",
    "query": "SELECT date_trunc('\''minute'\'', epoch_us(time)) - (EXTRACT(minute FROM epoch_us(time)) % 5) * INTERVAL '\''1 minute'\'' AS time, json_extract_string(metadata, '\''$.endpoint'\'') AS endpoint, ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CAST(json_extract(metadata, '\''$.latency_ms'\'') AS DOUBLE)), 1) AS p95_latency_ms, COUNT(*) AS request_count FROM logs.events WHERE json_extract(metadata, '\''$.latency_ms'\'') IS NOT NULL GROUP BY 1, endpoint",
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
    "measurement": "events",
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
| `events` (raw logs) | 7 days | Full-text search, debugging, trace correlation |
| `error_rates` | 90 days | Error rate trends, alerting |
| `latency_metrics` | 90 days | Latency monitoring, SLA tracking |

## Next Steps

- [Data Ingestion Patterns](/arc-cloud/guides/data-ingestion) -- Optimize batch sizes and throughput
- [SQL Querying Guide](/arc/guides/querying) -- Full SQL reference
- [Telegraf Integration](/arc/integrations/telegraf) -- Ship system metrics alongside logs
- [OpenTelemetry Integration](/arc/integrations/opentelemetry) -- Send traces and metrics via OTLP
