---
sidebar_position: 2
---

# Continuous Queries

Continuous queries are scheduled SQL queries that run automatically on a fixed interval. They let you transform, aggregate, and move data without writing external cron jobs or pipeline code.

## Use Cases

- **Materialized views** — pre-compute expensive joins or aggregations so dashboards load instantly.
- **Aggregation rollups** — downsample high-resolution data (e.g., per-second metrics into per-minute or per-hour).
- **Downsampling** — reduce storage costs by summarizing raw data before [retention policies](./retention.md) delete it.
- **Alerting** — periodically check for anomalies and write results to an alerts table that triggers notifications.

## Configuration

Continuous queries are configured from the **SQL Console** in the Arc Cloud dashboard.

### Available Intervals

| Interval |
|----------|
| 1 minute |
| 5 minutes |
| 15 minutes |
| 1 hour |
| 1 day |

## Example: Hourly Page View Aggregation

This continuous query runs every hour and rolls up raw page view events into an hourly summary table:

```sql
INSERT INTO analytics.pageviews_hourly
SELECT
  date_trunc('hour', timestamp) as hour,
  page,
  count(*) as views,
  count(DISTINCT user_id) as unique_users
FROM analytics.events
WHERE timestamp >= now() - INTERVAL '1 hour'
GROUP BY 1, 2
```

The query reads from `analytics.events`, aggregates page views and unique users by hour and page, and inserts the results into `analytics.pageviews_hourly`.

## How It Works

1. At each interval tick, Arc Cloud executes your SQL query against the instance.
2. The query runs with the same permissions and resource limits as your instance tier.
3. Results are written to the target table specified in your `INSERT INTO` statement.
4. If a query fails, the error is logged and visible in the dashboard. The query will be retried on the next interval.

## Best Practices

- **Use a `WHERE` clause with a time window** that matches your interval to avoid reprocessing old data.
- **Pair with retention policies** — aggregate raw data with a continuous query, then let retention clean up the raw records.
- **Monitor execution time** — if a continuous query takes longer than its interval, consider optimizing the query or choosing a longer interval.
- **Use idempotent queries** when possible to handle retries gracefully.
