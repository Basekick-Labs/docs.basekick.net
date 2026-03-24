---
sidebar_position: 1
---

# Instance Monitoring

The **Monitoring** tab on the instance console provides real-time visibility into your Arc instance's health, performance, and resource usage.

Navigate to **Instances > [your instance] > Monitoring** to access the dashboard.

## Service Health Dashboard

The monitoring dashboard displays real-time system metrics with configurable time ranges.

### Time Range

Select from preset durations:
- 5, 15, 30, or 60 minutes
- 6 hours
- 24 hours

Enable **auto-refresh** to update metrics every 5 seconds.

### System Metrics

Six key metrics are displayed as cards at the top of the dashboard:

| Metric | Description |
|--------|-------------|
| **Uptime** | Time since the instance last started |
| **Go Heap** | Current heap memory allocation (with system memory total) |
| **Goroutines** | Active concurrent goroutine count |
| **HTTP Requests** | Total request count with success/error breakdown |
| **Avg Latency** | Mean HTTP response time with success rate percentage |
| **GC Cycles** | Garbage collection cycle count with CPU count |

### Time-Series Charts

Six charts provide historical trends over the selected time range:

- **Memory (Heap)** — Heap allocation in MB
- **Goroutines** — Active goroutine count
- **GC Cycles** — Garbage collection frequency
- **HTTP Requests** — Request volume over time
- **HTTP Latency** — Response time trends in milliseconds
- **Storage Writes** — Write operation volume

### Endpoint Statistics

Detailed breakdowns across four categories:

**HTTP Metrics**
- Total requests, success count, error count, average latency

**Query Metrics**
- Total queries, success count, error count, rows returned

**Ingestion Metrics**
- Total records ingested, total bytes, batch count, errors

**Storage Metrics**
- Total writes, bytes written, total reads, errors

## Application Logs

Below the metrics dashboard, the **Application Logs** section shows Arc instance logs (not ingested data — for that, see [Log Explorer](#log-explorer-vs-application-logs)).

### Filtering

- **Level** — Filter by Debug, Info, Warning, or Error
- **Time range** — Last 5/15/30 minutes, 1/6/24 hours
- **Search** — Free-text search across log messages

Logs are color-coded by severity:
- **Red** — Error
- **Yellow** — Warning
- **Blue** — Info
- **Gray** — Debug

Enable auto-refresh to stream new logs every 5 seconds.

## Metrics API

You can also access monitoring data programmatically:

```bash
# System metrics snapshot
curl https://<instance>.arc.<region>.basekick.net/api/v1/metrics \
  -H "Authorization: Bearer <token>"

# Endpoint statistics
curl https://<instance>.arc.<region>.basekick.net/api/v1/metrics/endpoints \
  -H "Authorization: Bearer <token>"

# Time-series data (type: system, api, or application)
curl "https://<instance>.arc.<region>.basekick.net/api/v1/metrics/timeseries/system?duration=60" \
  -H "Authorization: Bearer <token>"

# Application logs
curl "https://<instance>.arc.<region>.basekick.net/api/v1/logs?limit=100&level=error&since_minutes=30" \
  -H "Authorization: Bearer <token>"
```

## Log Explorer vs Application Logs

Arc Cloud has two different log viewing tools:

| Feature | Application Logs (Monitoring tab) | Log Explorer (dedicated tab) |
|---------|-----------------------------------|------------------------------|
| **Purpose** | View Arc instance system logs | Browse ingested log/event data in your databases |
| **Data source** | Arc's internal log output | Your database tables |
| **Use case** | Debugging startup issues, connection errors, health | Analyzing ingested application logs, events, traces |
| **Filtering** | Level, time range, text search | Field-level filtering, pattern detection, SQL queries |
| **Traces** | Not supported | Distributed trace visualization |

- Use **Application Logs** when troubleshooting Arc itself (startup failures, connectivity, errors)
- Use the **Log Explorer** when querying and analyzing data you've ingested into your databases
