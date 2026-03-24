---
sidebar_position: 1
---

# Product Analytics

Build a product analytics backend with Arc Cloud -- columnar storage, SQL queries, and sub-second aggregations over millions of events.

## Why Arc Cloud for Analytics

Traditional product analytics platforms lock you into proprietary query languages and rigid schemas. Arc Cloud gives you:

- **Columnar Storage**: Parquet-backed storage compresses event data efficiently and accelerates analytical queries
- **Full SQL**: Use DuckDB SQL for funnels, cohorts, retention, and ad-hoc analysis -- no proprietary query language
- **High Ingestion Throughput**: Ingest tens of thousands to millions of events per second depending on your tier
- **Schema Auto-Detection**: Send events and Arc Cloud creates tables and columns automatically
- **Cost-Effective Retention**: Keep raw events for weeks and aggregated rollups indefinitely

## Schema Design

Design your events around a measurement with tags and fields. Arc Cloud auto-creates columns on first insert, so you can start simple and add fields over time.

### Recommended Event Schema

| Column | Type | Description |
|--------|------|-------------|
| `time` | timestamp (ns) | When the event occurred |
| `source` | tag | Event origin (e.g., `web`, `mobile`, `api`) |
| `event_name` | field (string) | Event type (e.g., `page_view`, `signup`, `purchase`) |
| `user_id` | field (string) | Unique user identifier |
| `session_id` | field (string) | Session identifier for grouping |
| `page` | field (string) | Page URL or screen name |
| `referrer` | field (string) | Traffic source |
| `properties` | field (string) | JSON-encoded key-value pairs for event-specific data |

### Example in Line Protocol

```
events,source=web event_name="purchase",user_id="u_8f3k2",session_id="sess_a1b2c3",page="/checkout",referrer="google",properties="{\"product_id\":\"prod_99\",\"amount\":49.99,\"currency\":\"USD\"}" 1711200721000000000
```

## Ingesting Events

Send events to your Arc Cloud instance using line protocol or MessagePack. Batch multiple events per request for optimal throughput.

### Single Event

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=analytics" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'events,source=web event_name="page_view",user_id="u_8f3k2",session_id="sess_a1b2c3",page="/pricing",referrer="google" 1711200721000000000'
```

### Batch Ingestion

For production use, batch multiple events per request (one line per event):

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=analytics" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'events,source=web event_name="page_view",user_id="u_8f3k2",page="/pricing" 1711200721000000000
events,source=web event_name="signup",user_id="u_8f3k2",page="/signup" 1711200725000000000
events,source=mobile event_name="page_view",user_id="u_9x7m1",page="/home" 1711200792000000000'
```

### JavaScript Example

```javascript
const ARC_URL = "https://<instance-id>.arc.<region>.basekick.net";
const ARC_TOKEN = "<your-token>";

// Buffer events and flush in batches
const eventBuffer = [];

function trackEvent(eventName, userId, properties = {}) {
  const timestampNs = Date.now() * 1_000_000; // ms to ns
  const propsJson = JSON.stringify(properties).replace(/"/g, '\\"');
  eventBuffer.push(
    `events,source=web event_name="${eventName}",user_id="${userId}",session_id="${getSessionId()}",page="${window.location.pathname}",referrer="${document.referrer}",properties="${propsJson}" ${timestampNs}`
  );

  if (eventBuffer.length >= 100) {
    flushEvents();
  }
}

async function flushEvents() {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, eventBuffer.length);
  await fetch(`${ARC_URL}/api/v1/write/line-protocol?db=analytics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ARC_TOKEN}`,
      "Content-Type": "text/plain",
    },
    body: batch.join("\n"),
  });
}
```

### Python SDK Example

```python
from arc_tsdb_client import ArcClient

client = ArcClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-token>",
    database="analytics",
)

with client.buffered_writer(batch_size=5000, flush_interval=5.0) as writer:
    writer.write(
        measurement="events",
        tags={"source": "web"},
        fields={
            "event_name": "page_view",
            "user_id": "u_8f3k2",
            "session_id": "sess_a1b2c3",
            "page": "/pricing",
            "referrer": "google",
        },
    )
```

## Querying Events

Query your data using SQL via the `/api/v1/query` endpoint:

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/query" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM analytics.events ORDER BY time DESC LIMIT 10", "format": "json"}'
```

For large result sets, use the Arrow endpoint for efficient binary transfer:

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/query/arrow" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM analytics.events ORDER BY time DESC LIMIT 100000"}' \
  -o results.arrow
```

## Example Queries

### Daily Active Users

```sql
SELECT
    date_trunc('day', epoch_us(time)) AS day,
    COUNT(DISTINCT user_id) AS daily_active_users
FROM analytics.events
WHERE time > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;
```

### Funnel Analysis

Track conversion through a sequence of steps:

```sql
WITH step1 AS (
    SELECT DISTINCT user_id
    FROM analytics.events
    WHERE event_name = 'page_view' AND page = '/pricing'
      AND time > NOW() - INTERVAL '7 days'
),
step2 AS (
    SELECT DISTINCT user_id
    FROM analytics.events
    WHERE event_name = 'signup'
      AND time > NOW() - INTERVAL '7 days'
      AND user_id IN (SELECT user_id FROM step1)
),
step3 AS (
    SELECT DISTINCT user_id
    FROM analytics.events
    WHERE event_name = 'purchase'
      AND time > NOW() - INTERVAL '7 days'
      AND user_id IN (SELECT user_id FROM step2)
)
SELECT
    'Viewed Pricing' AS step,
    (SELECT COUNT(*) FROM step1) AS users
UNION ALL
SELECT 'Signed Up', (SELECT COUNT(*) FROM step2)
UNION ALL
SELECT 'Purchased', (SELECT COUNT(*) FROM step3);
```

### Retention Cohorts

Calculate week-over-week retention by signup cohort:

```sql
WITH cohorts AS (
    SELECT
        user_id,
        date_trunc('week', epoch_us(MIN(time))) AS cohort_week
    FROM analytics.events
    WHERE event_name = 'signup'
    GROUP BY user_id
),
activity AS (
    SELECT
        e.user_id,
        c.cohort_week,
        date_trunc('week', epoch_us(e.time)) AS activity_week
    FROM analytics.events e
    JOIN cohorts c ON e.user_id = c.user_id
)
SELECT
    cohort_week,
    COUNT(DISTINCT user_id) AS cohort_size,
    COUNT(DISTINCT CASE WHEN activity_week = cohort_week + INTERVAL '1 week' THEN user_id END) AS week_1,
    COUNT(DISTINCT CASE WHEN activity_week = cohort_week + INTERVAL '2 weeks' THEN user_id END) AS week_2,
    COUNT(DISTINCT CASE WHEN activity_week = cohort_week + INTERVAL '3 weeks' THEN user_id END) AS week_3,
    COUNT(DISTINCT CASE WHEN activity_week = cohort_week + INTERVAL '4 weeks' THEN user_id END) AS week_4
FROM activity
GROUP BY cohort_week
ORDER BY cohort_week;
```

### Top Pages

```sql
SELECT
    page,
    COUNT(*) AS views,
    COUNT(DISTINCT user_id) AS unique_visitors,
    COUNT(DISTINCT session_id) AS sessions
FROM analytics.events
WHERE event_name = 'page_view'
  AND time > NOW() - INTERVAL '7 days'
GROUP BY page
ORDER BY views DESC
LIMIT 20;
```

## Aggregation Rollups with Continuous Queries

Pre-aggregate metrics into rollup tables so dashboards query summarized data instead of scanning raw events.

### Daily Rollup

Create a continuous query that aggregates events into daily summaries:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/continuous_queries \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "events_daily_rollup",
    "database": "analytics",
    "source_measurement": "events",
    "destination_measurement": "events_daily",
    "query": "SELECT date_trunc('\''day'\'', epoch_us(time)) AS time, event_name, COUNT(*) AS event_count, COUNT(DISTINCT user_id) AS unique_users, COUNT(DISTINCT session_id) AS unique_sessions FROM analytics.events GROUP BY date_trunc('\''day'\'', epoch_us(time)), event_name",
    "interval": "1d",
    "is_active": true
  }'
```

### Hourly Rollup

For more granular dashboards, create an hourly rollup:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/continuous_queries \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "events_hourly_rollup",
    "database": "analytics",
    "source_measurement": "events",
    "destination_measurement": "events_hourly",
    "query": "SELECT date_trunc('\''hour'\'', epoch_us(time)) AS time, event_name, page, COUNT(*) AS event_count, COUNT(DISTINCT user_id) AS unique_users FROM analytics.events GROUP BY date_trunc('\''hour'\'', epoch_us(time)), event_name, page",
    "interval": "1h",
    "is_active": true
  }'
```

### Querying Rollups

Once rollups are populated, query them for fast dashboard responses:

```sql
-- Daily trend from rollup (fast)
SELECT time, event_name, event_count, unique_users
FROM analytics.events_daily
WHERE time > NOW() - INTERVAL '30 days'
ORDER BY time;

-- Hourly breakdown from rollup (fast)
SELECT time, page, event_count
FROM analytics.events_hourly
WHERE event_name = 'page_view'
  AND time > NOW() - INTERVAL '24 hours'
ORDER BY time;
```

## Retention Policies

Keep raw events for recent analysis and rollups for long-term trends.

### Keep Raw Events for 30 Days

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/retention \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "raw_events_30d",
    "database": "analytics",
    "measurement": "events",
    "retention_days": 30,
    "buffer_days": 3,
    "is_active": true
  }'
```

### Keep Rollups Indefinitely

Do not set a retention policy on `events_daily` or `events_hourly` -- they will be retained indefinitely. Rollup data is compact (typically 100-1000x smaller than raw events), so long-term storage costs are minimal.

### Storage Strategy Summary

| Data | Retention | Purpose |
|------|-----------|---------|
| `events` (raw) | 30 days | Detailed drill-down, debugging |
| `events_hourly` | No limit | Hourly dashboards, intra-day analysis |
| `events_daily` | No limit | Long-term trends, reporting |

## Next Steps

- [Data Ingestion Patterns](/arc-cloud/guides/data-ingestion) -- All ingestion methods and optimization
- [SQL Querying Guide](/arc/guides/querying) -- Full SQL reference for Arc
- [Continuous Queries](/arc/data-lifecycle/continuous-queries) -- Advanced rollup configuration
- [Retention Policies](/arc/data-lifecycle/retention-policies) -- Manage data lifecycle
