---
sidebar_position: 2
---

# Automated Scheduling

Automatically execute continuous queries and retention policies on configurable schedules. Eliminate manual data lifecycle management and build efficient data pipelines.

## Overview

Arc OSS provides [continuous queries](/arc/data-lifecycle/continuous-queries) and [retention policies](/arc/data-lifecycle/retention-policies) with manual API-triggered execution. Arc Enterprise adds automatic scheduling — define your schedules once, and Arc handles execution automatically.

**Two schedulers:**

| Scheduler | Purpose | Default Schedule |
|-----------|---------|-----------------|
| **CQ Scheduler** | Runs continuous queries at their configured intervals | Per-CQ interval |
| **Retention Scheduler** | Enforces retention policies on a cron schedule | Daily at 3am (`0 3 * * *`) |

## CQ Scheduler

The CQ Scheduler automatically executes continuous queries at their configured intervals. Each continuous query runs independently on its own schedule.

### How It Works

1. Define continuous queries with intervals via the [CQ API](/arc/data-lifecycle/continuous-queries)
2. Enable the CQ scheduler (requires enterprise license)
3. Arc automatically executes each CQ at its configured interval
4. Results are written to the destination measurement

### Configuration

The CQ Scheduler is enabled when continuous queries are enabled and a valid enterprise license is present:

```toml
[continuous_query]
enabled = true
```

```bash
ARC_CONTINUOUS_QUERY_ENABLED=true
```

Each continuous query defines its own execution interval when created through the API.

## Retention Scheduler

The Retention Scheduler automatically enforces retention policies on a cron schedule, deleting data that has exceeded its retention period.

### How It Works

1. Define retention policies via the [Retention API](/arc/data-lifecycle/retention-policies)
2. Enable the retention scheduler (requires enterprise license)
3. Arc evaluates all active policies on the configured schedule
4. Expired data is automatically deleted

### Configuration

```toml
[retention]
enabled = true

[scheduler]
retention_schedule = "0 3 * * *"   # Cron: daily at 3am
```

```bash
ARC_RETENTION_ENABLED=true
ARC_SCHEDULER_RETENTION_SCHEDULE="0 3 * * *"
```

:::tip Cron Schedule Syntax
The schedule uses standard 5-field cron syntax: `minute hour day-of-month month day-of-week`.

| Schedule | Meaning |
|----------|---------|
| `0 3 * * *` | Daily at 3:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 2 * * 0` | Weekly on Sunday at 2:00 AM |
| `30 1 1 * *` | Monthly on the 1st at 1:30 AM |
:::

## Data Lifecycle Pipeline

Combine CQ and retention scheduling to build a complete data lifecycle pipeline:

```
Raw Data (1-second resolution)
    │
    │ CQ: 1-minute aggregation (runs every minute)
    ▼
1-Minute Data
    │
    │ CQ: 1-hour aggregation (runs every hour)
    ▼
1-Hour Data
    │
    │ CQ: 1-day aggregation (runs daily)
    ▼
1-Day Data

Retention Schedule (runs daily at 3am):
  ├── Delete raw data older than 7 days
  ├── Delete 1-minute data older than 30 days
  ├── Delete 1-hour data older than 365 days
  └── Keep 1-day data indefinitely
```

### Example Setup

**1. Create continuous queries for downsampling:**

```bash
# 1-minute aggregation
curl -X POST http://localhost:8000/api/v1/continuous-queries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "downsample_1min",
    "database": "telemetry",
    "source_measurement": "sensors_raw",
    "destination_measurement": "sensors_1min",
    "query": "SELECT time_bucket('\''1 minute'\'', timestamp) as timestamp, device_id, AVG(temperature) as temperature, MAX(pressure) as pressure FROM sensors_raw WHERE timestamp >= $start AND timestamp < $end GROUP BY 1, 2",
    "interval": "1m",
    "enabled": true
  }'

# 1-hour aggregation
curl -X POST http://localhost:8000/api/v1/continuous-queries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "downsample_1hr",
    "database": "telemetry",
    "source_measurement": "sensors_1min",
    "destination_measurement": "sensors_1hr",
    "query": "SELECT time_bucket('\''1 hour'\'', timestamp) as timestamp, device_id, AVG(temperature) as temperature, MAX(pressure) as pressure FROM sensors_1min WHERE timestamp >= $start AND timestamp < $end GROUP BY 1, 2",
    "interval": "1h",
    "enabled": true
  }'
```

**2. Create retention policies:**

```bash
# Delete raw data after 7 days
curl -X POST http://localhost:8000/api/v1/retention \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "raw_7d",
    "database": "telemetry",
    "measurement": "sensors_raw",
    "retention_days": 7,
    "enabled": true
  }'

# Delete 1-minute data after 30 days
curl -X POST http://localhost:8000/api/v1/retention \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "1min_30d",
    "database": "telemetry",
    "measurement": "sensors_1min",
    "retention_days": 30,
    "enabled": true
  }'
```

With enterprise scheduling enabled, these queries and policies run automatically — no cron jobs, no external orchestration.

## Best Practices

1. **Schedule retention during off-peak hours** — File deletion generates I/O. The default 3am schedule avoids impacting daytime workloads.

2. **Add buffer days to retention policies** — Use the `buffer_days` parameter in retention policies to provide a safety margin before deletion.

3. **Test CQ queries manually first** — Before enabling automatic execution, run your continuous query SQL manually to verify correct results.

4. **Combine with tiered storage** — Use [tiered storage](/arc-enterprise/tiered-storage) to move data to cold storage before retention deletes it, keeping long-term archives at low cost.

5. **Monitor CQ execution** — Check Arc logs for CQ execution results and errors. Failed CQ executions are logged at WARN level.

## Next Steps

- [Continuous Queries](/arc/data-lifecycle/continuous-queries) — Create and manage continuous queries (OSS docs)
- [Retention Policies](/arc/data-lifecycle/retention-policies) — Create and manage retention policies (OSS docs)
- [Tiered Storage](/arc-enterprise/tiered-storage) — Combine scheduling with tiered storage for optimal cost management
