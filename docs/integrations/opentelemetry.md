---
sidebar_position: 4
---

# OpenTelemetry Integration

Send traces, metrics, and logs from OpenTelemetry Collector to Arc for unified observability.

## Overview

The Arc OpenTelemetry Exporter enables you to send all your telemetry data from the OpenTelemetry Collector to Arc:

- **✅ Traces**: Distributed traces with full span hierarchy
- **✅ Metrics**: All metric types (gauge, counter, histogram, summary)
- **✅ Logs**: Structured logs with attributes
- **🚀 High Performance**: Uses Arc's columnar MessagePack format
- **📦 Compression**: Automatic gzip compression
- **🔄 Retry Logic**: Configurable retry with exponential backoff
- **🔐 Authentication**: Bearer token support

**Performance:**
- Traces: 500K-1M spans/sec
- Metrics: 3M-6M data points/sec
- Logs: 1M-2M logs/sec

## Why OpenTelemetry + Arc?

Traditional observability requires 3+ separate systems:
- Jaeger for traces
- Prometheus for metrics
- Loki/Elasticsearch for logs
- **Manual correlation** between systems

**With Arc + OpenTelemetry:**
- ✅ All signals in one database
- ✅ Join traces, metrics, and logs in SQL
- ✅ No manual correlation needed
- ✅ Single query for complete context
- ✅ One storage backend to manage

This is **unified observability**.

## Installation

### Option 1: OpenTelemetry Collector Builder (OCB)

Add to your `builder-config.yaml`:

```yaml
exporters:
  - gomod: github.com/basekick-labs/arc-opentelemetry-exporter v0.1.0
```

Build the collector:

```bash
ocb --config builder-config.yaml
```

### Option 2: Pre-built Binary

Download from the [releases page](https://github.com/basekick-labs/arc-opentelemetry-exporter/releases):

```bash
# Download latest release
wget https://github.com/basekick-labs/arc-opentelemetry-exporter/releases/download/v0.1.0/otelcol-arc-linux-amd64

# Make executable
chmod +x otelcol-arc-linux-amd64

# Run
./otelcol-arc-linux-amd64 --config=config.yaml
```

## Quick Start

### 1. Start Arc

```bash
docker run -d -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:25.11.2
```

### 2. Get Your API Token

```bash
# Check logs for admin token
docker logs <container-id> 2>&1 | grep "Admin token"

# Or create a new token
curl -X POST http://localhost:8000/api/v1/auth/tokens \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "otel-collector",
    "description": "OpenTelemetry Collector access"
  }'
```

### 3. Create Collector Configuration

Create `otel-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1000

exporters:
  arc:
    endpoint: http://localhost:8000
    auth_token: your-arc-token-here

    # Recommended: Separate databases per signal type
    traces_database: traces
    metrics_database: metrics
    logs_database: logs

    # Optional: Custom measurement names
    traces_measurement: distributed_traces
    logs_measurement: logs

    # Optional: HTTP settings
    timeout: 30s
    compression: gzip

    # Optional: Retry configuration
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [arc]

    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [arc]

    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [arc]
```

### 4. Run OpenTelemetry Collector

```bash
./otelcol-arc-linux-amd64 --config=otel-config.yaml
```

### 5. Send Telemetry Data

Your applications instrumented with OpenTelemetry SDKs will now send data to Arc!

**Example: Python Application**

```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Configure tracer
trace.set_tracer_provider(TracerProvider())
otlp_exporter = OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True)
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Create spans
tracer = trace.get_tracer(__name__)
with tracer.start_as_current_span("my-operation"):
    # Your code here
    print("Trace sent to Arc via OTel Collector!")
```

## Configuration

### Database Organization Strategies

#### Strategy 1: Single Database (Simple)

All signals in one database:

```yaml
exporters:
  arc:
    endpoint: http://localhost:8000
    database: default
```

**Structure:**
```
default/
  ├── distributed_traces
  ├── logs
  ├── system_cpu_usage
  └── http_requests_total
```

**Pros:** Simple, easy cross-signal correlation
**Cons:** All data in one namespace

#### Strategy 2: Database Per Signal (Recommended)

Separate databases for each signal type:

```yaml
exporters:
  arc:
    endpoint: http://localhost:8000
    traces_database: traces
    metrics_database: metrics
    logs_database: logs
```

**Structure:**
```
traces/
  └── distributed_traces

metrics/
  ├── system_cpu_usage
  ├── system_memory_usage
  └── http_requests_total

logs/
  └── logs
```

**Pros:**
- Clean separation of concerns
- Independent retention policies per signal
- Independent scaling and storage backends
- Easier permission management
- Matches traditional observability architecture

**Cons:** Slightly more complex configuration

**✅ Recommended for production deployments.**

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `endpoint` | Arc API endpoint | Required |
| `auth_token` | Authentication token | Optional |
| `database` | Single database for all signals | `default` |
| `traces_database` | Database for traces | - |
| `metrics_database` | Database for metrics | - |
| `logs_database` | Database for logs | - |
| `traces_measurement` | Table name for traces | `distributed_traces` |
| `logs_measurement` | Table name for logs | `logs` |
| `timeout` | HTTP request timeout | `30s` |
| `compression` | Compression type | `gzip` |
| `retry_on_failure.enabled` | Enable retry logic | `true` |
| `retry_on_failure.initial_interval` | Initial retry interval | `5s` |
| `retry_on_failure.max_interval` | Maximum retry interval | `30s` |
| `retry_on_failure.max_elapsed_time` | Maximum total retry time | `300s` |

## Data Format

The exporter uses Arc's high-performance **columnar MessagePack format** with **dynamic columns**. All OpenTelemetry attributes automatically become individual columns for optimal query performance.

### Traces

All span attributes and resource attributes become columns:

```json
{
  "m": "distributed_traces",
  "columns": {
    "time": [1699900000000],
    "trace_id": ["5b8efff798038103d269b633813fc60c"],
    "span_id": ["def456..."],
    "parent_span_id": ["ghi789..."],
    "service_name": ["api-gateway"],
    "operation_name": ["HTTP GET /users"],
    "span_kind": ["server"],
    "duration_ns": [1234567],
    "status_code": [0],
    "http.method": ["GET"],
    "http.status_code": [200],
    "http.url": ["/api/users"],
    "host.name": ["server-1"]
  }
}
```

**Dynamic schema**: Columns created automatically from span and resource attributes.

### Metrics

Each metric name becomes its own table. All attributes become columns:

```json
{
  "m": "http_requests_total",
  "columns": {
    "time": [1699900000000],
    "value": [42.0],
    "service": ["api"],
    "method": ["GET"],
    "status": ["200"],
    "host.name": ["server-1"]
  }
}
```

**Metric name sanitization:**
- `system.cpu.usage` → `system_cpu_usage`
- `http.server.duration` → `http_server_duration`
- `process-memory-bytes` → `process_memory_bytes`

### Logs

All log attributes and resource attributes become columns:

```json
{
  "m": "logs",
  "columns": {
    "time": [1699900000000],
    "severity": ["ERROR"],
    "severity_number": [17],
    "body": ["Database connection failed"],
    "trace_id": ["abc123..."],
    "span_id": ["def456..."],
    "service_name": ["api-gateway"],
    "http.method": ["POST"],
    "user_id": ["12345"],
    "host.name": ["server-1"]
  }
}
```

## Querying Data

### Traces

```sql
-- Recent traces
SELECT * FROM traces.distributed_traces
WHERE time > NOW() - INTERVAL '1 hour'
LIMIT 100;

-- Traces by service
SELECT
  service_name,
  operation_name,
  duration_ns / 1000000 AS duration_ms,
  "http.method",
  "http.status_code"
FROM traces.distributed_traces
WHERE service_name = 'api-gateway'
  AND time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC;

-- Debug specific trace
SELECT * FROM traces.distributed_traces
WHERE trace_id = '5b8efff798038103d269b633813fc60c'
ORDER BY time;

-- Slow requests (p99 latency)
SELECT
  service_name,
  operation_name,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ns) / 1000000 AS p99_ms
FROM traces.distributed_traces
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY service_name, operation_name
ORDER BY p99_ms DESC;
```

### Metrics

Each metric is its own table with all attributes as columns:

```sql
-- CPU usage
SELECT
  time,
  value,
  "host.name",
  cpu,
  state
FROM metrics.system_cpu_usage
WHERE time > NOW() - INTERVAL '1 hour'
  AND "host.name" = 'server-1'
ORDER BY time DESC;

-- HTTP requests by method and status
SELECT
  time_bucket(INTERVAL '1 minute', time) AS minute,
  method,
  status,
  SUM(value) AS total_requests
FROM metrics.http_requests_total
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY minute, method, status
ORDER BY minute DESC;

-- Memory usage aggregated
SELECT
  time_bucket(INTERVAL '5 minutes', time) AS bucket,
  "host.name",
  AVG(value) AS avg_memory_bytes
FROM metrics.system_memory_usage
WHERE time > NOW() - INTERVAL '6 hours'
GROUP BY bucket, "host.name"
ORDER BY bucket DESC;
```

### Logs

All attributes are individual columns for fast filtering:

```sql
-- Recent error logs
SELECT
  time,
  severity,
  body,
  service_name,
  "host.name",
  trace_id
FROM logs.logs
WHERE severity IN ('ERROR', 'FATAL')
  AND time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC;

-- Logs for specific trace (correlation)
SELECT
  time,
  severity,
  body,
  service_name
FROM logs.logs
WHERE trace_id = '5b8efff798038103d269b633813fc60c'
ORDER BY time;

-- Count errors by service
SELECT
  service_name,
  "host.name",
  COUNT(*) AS error_count
FROM logs.logs
WHERE severity IN ('ERROR', 'FATAL')
  AND time > NOW() - INTERVAL '1 hour'
GROUP BY service_name, "host.name"
ORDER BY error_count DESC;
```

## Unified Observability: Join Across Signals

Arc's most powerful feature: **correlate traces, metrics, and logs in a single SQL query**.

### Example 1: Failed Requests with Full Context

Get traces, error logs, and CPU metrics for failed requests:

```sql
SELECT
  t.time,
  t.trace_id,
  t.service_name,
  t.operation_name,
  t.duration_ns / 1000000 AS duration_ms,
  t."http.status_code",
  l.severity,
  l.body AS error_message,
  cpu.value AS cpu_usage
FROM traces.distributed_traces t
LEFT JOIN logs.logs l
  ON t.trace_id = l.trace_id
LEFT JOIN metrics.system_cpu_usage cpu
  ON t.service_name = cpu.service_name
  AND time_bucket(INTERVAL '1 minute', t.time) = time_bucket(INTERVAL '1 minute', cpu.time)
WHERE t.status_code >= 2  -- OTel status: 2 = Error
  AND t.time > NOW() - INTERVAL '1 hour'
ORDER BY t.time DESC
LIMIT 100;
```

**Result:** Traces + error logs + CPU usage at time of failure — all in one query!

### Example 2: Service Health Dashboard

Complete service health metrics:

```sql
WITH trace_stats AS (
  SELECT
    time_bucket(INTERVAL '5 minutes', time) AS bucket,
    service_name,
    COUNT(*) AS request_count,
    AVG(duration_ns / 1000000) AS avg_latency_ms,
    SUM(CASE WHEN status_code >= 2 THEN 1 ELSE 0 END) AS error_count
  FROM traces.distributed_traces
  WHERE time > NOW() - INTERVAL '1 hour'
  GROUP BY bucket, service_name
),
error_logs AS (
  SELECT
    time_bucket(INTERVAL '5 minutes', time) AS bucket,
    service_name,
    COUNT(*) AS log_error_count
  FROM logs.logs
  WHERE severity IN ('ERROR', 'FATAL')
    AND time > NOW() - INTERVAL '1 hour'
  GROUP BY bucket, service_name
),
cpu_stats AS (
  SELECT
    time_bucket(INTERVAL '5 minutes', time) AS bucket,
    service_name,
    AVG(value) AS avg_cpu
  FROM metrics.system_cpu_usage
  WHERE time > NOW() - INTERVAL '1 hour'
  GROUP BY bucket, service_name
)
SELECT
  ts.bucket AS time,
  ts.service_name,
  ts.request_count,
  ROUND(ts.avg_latency_ms, 2) AS avg_latency_ms,
  ts.error_count,
  ROUND((ts.error_count::float / NULLIF(ts.request_count, 0) * 100), 2) AS error_rate_pct,
  el.log_error_count,
  ROUND(cs.avg_cpu, 2) AS avg_cpu_usage
FROM trace_stats ts
LEFT JOIN error_logs el ON ts.bucket = el.bucket AND ts.service_name = el.service_name
LEFT JOIN cpu_stats cs ON ts.bucket = cs.bucket AND ts.service_name = cs.service_name
ORDER BY ts.bucket DESC, ts.service_name;
```

**Result:**
- Request volume and latency (traces)
- Error rate (traces)
- Error log count (logs)
- CPU usage (metrics)

All from one database, in one query!

### Example 3: Debug Incident Timeline

Unified timeline of traces and logs for a single request:

```sql
SELECT
  t.time,
  'trace' AS signal_type,
  t.operation_name AS event,
  t.duration_ns / 1000000 AS duration_ms,
  t.status_code,
  NULL AS severity,
  NULL AS body
FROM traces.distributed_traces t
WHERE t.trace_id = '5b8efff798038103d269b633813fc60c'

UNION ALL

SELECT
  l.time,
  'log' AS signal_type,
  l.service_name AS event,
  NULL AS duration_ms,
  NULL AS status_code,
  l.severity,
  l.body
FROM logs.logs l
WHERE l.trace_id = '5b8efff798038103d269b633813fc60c'

ORDER BY time;
```

**Result:** Complete chronological view of all events for a single request!

## Use Cases

### Application Performance Monitoring

Monitor service latency, error rates, and throughput:

```sql
SELECT
  time_bucket(INTERVAL '1 minute', time) AS minute,
  service_name,
  COUNT(*) AS requests,
  AVG(duration_ns / 1000000) AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ns) / 1000000 AS p95_ms,
  SUM(CASE WHEN status_code >= 2 THEN 1 ELSE 0 END) AS errors
FROM traces.distributed_traces
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY minute, service_name
ORDER BY minute DESC;
```

### Distributed Tracing

Analyze request flows across microservices:

```sql
-- Trace all spans in a distributed transaction
SELECT
  span_id,
  parent_span_id,
  service_name,
  operation_name,
  duration_ns / 1000000 AS duration_ms,
  "http.method",
  "http.url"
FROM traces.distributed_traces
WHERE trace_id = 'your-trace-id'
ORDER BY time;
```

### Log Analysis

Search and analyze structured logs:

```sql
-- Find all errors from a specific user session
SELECT
  time,
  severity,
  body,
  service_name,
  user_id,
  "http.method",
  "http.url"
FROM logs.logs
WHERE user_id = '12345'
  AND severity IN ('ERROR', 'WARN')
  AND time > NOW() - INTERVAL '24 hours'
ORDER BY time DESC;
```

## Performance Optimization

### 1. Use Batch Processor

Always use the `batch` processor for high throughput:

```yaml
processors:
  batch:
    timeout: 1s
    send_batch_size: 1000  # Adjust based on your load
```

### 2. Configure Retry Logic

Handle transient failures:

```yaml
exporters:
  arc:
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s
```

### 3. Enable Compression

Reduce network bandwidth:

```yaml
exporters:
  arc:
    compression: gzip  # Default and recommended
```

### 4. Tune Collector Resources

For high-volume deployments:

```yaml
service:
  telemetry:
    metrics:
      level: detailed
  extensions: [health_check]
```

### 5. Use Separate Databases

For production, use database-per-signal strategy:

```yaml
exporters:
  arc:
    traces_database: traces
    metrics_database: metrics
    logs_database: logs
```

## Troubleshooting

### Collector Not Sending Data

```bash
# Check collector logs
./otelcol-arc-linux-amd64 --config=config.yaml

# Verify Arc is accessible
curl http://localhost:8000/health

# Test authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/v1/auth/verify
```

### High Memory Usage

Reduce batch size:

```yaml
processors:
  batch:
    timeout: 1s
    send_batch_size: 500  # Reduce from 1000
```

### Data Not Appearing in Arc

```sql
-- Check if data is being written
SHOW TABLES FROM traces;
SHOW TABLES FROM metrics;
SHOW TABLES FROM logs;

-- Verify recent data
SELECT COUNT(*) FROM traces.distributed_traces
WHERE time > NOW() - INTERVAL '5 minutes';
```

### Connection Timeouts

Increase timeout:

```yaml
exporters:
  arc:
    timeout: 60s  # Increase from 30s
```

## Resources

- **[Arc OpenTelemetry Exporter GitHub](https://github.com/basekick-labs/arc-opentelemetry-exporter)**
- **[OpenTelemetry Collector Docs](https://opentelemetry.io/docs/collector/)**
- **[Arc Query API](/arc/api-reference/overview)**
- **[OpenTelemetry SDK Documentation](https://opentelemetry.io/docs/instrumentation/)**

## Next Steps

- **[Getting Started with Arc](/arc/getting-started)** - Install Arc
- **[Grafana Integration](/arc/integrations/grafana)** - Visualize OpenTelemetry data
- **[Query API Reference](/arc/api-reference/overview)** - Learn Arc SQL
- **[Data Lifecycle](/arc/data-lifecycle/retention-policies)** - Manage retention policies

---

**Ready for unified observability!**

Made with ❤️ by [Basekick Labs](https://github.com/basekick-labs)
