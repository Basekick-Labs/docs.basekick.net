---
sidebar_position: 2
---

# Query Management

Monitor active queries in real time, review query history, and cancel long-running queries. Full visibility into your query workload for debugging and capacity planning.

## Overview

Query management provides:

- **Active query monitoring** — See all currently running queries with their duration, SQL, and resource usage
- **Query history** — Review recently completed queries with execution details
- **Query cancellation** — Cancel long-running or runaway queries on demand
- **Diagnostic details** — View parallel execution status and partition counts per query

## Configuration

### TOML

```toml
[query_management]
enabled = true
history_size = 100           # Number of completed queries to keep in history
```

### Environment Variables

```bash
ARC_QUERY_MANAGEMENT_ENABLED=true
ARC_QUERY_MANAGEMENT_HISTORY_SIZE=100
```

## API Reference

All query management endpoints require admin authentication.

### List Active Queries

View all currently running queries:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/queries/active
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "q-abc123",
      "sql": "SELECT * FROM production.sensors WHERE timestamp > NOW() - INTERVAL '1 hour'",
      "status": "running",
      "token_name": "grafana-readonly",
      "remote_addr": "10.0.1.50:54321",
      "started_at": "2026-02-13T10:30:00Z",
      "duration_ms": 2500,
      "is_parallel": true,
      "partition_count": 4
    },
    {
      "id": "q-def456",
      "sql": "SELECT COUNT(*) FROM analytics.events GROUP BY event_type",
      "status": "running",
      "token_name": "dashboard-token",
      "remote_addr": "10.0.1.51:54322",
      "started_at": "2026-02-13T10:30:01Z",
      "duration_ms": 1200,
      "is_parallel": false,
      "partition_count": 1
    }
  ]
}
```

### View Query History

Review recently completed queries:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/queries/history
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "q-ghi789",
      "sql": "SELECT AVG(temperature) FROM production.sensors GROUP BY device_id",
      "status": "completed",
      "token_name": "analytics-token",
      "remote_addr": "10.0.1.52:54323",
      "started_at": "2026-02-13T10:29:00Z",
      "duration_ms": 850,
      "is_parallel": true,
      "partition_count": 3
    }
  ]
}
```

### Get Query Details

Inspect a specific query by ID:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/queries/q-abc123
```

### Cancel a Query

Stop a long-running or runaway query:

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/queries/q-abc123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Query cancelled",
    "id": "q-abc123"
  }
}
```

## Use Cases

### Debugging Slow Queries

1. Check active queries to find long-running operations
2. Review the SQL and execution details
3. Cancel if the query is consuming excessive resources
4. Optimize the query and retry

```bash
# Find queries running longer than expected
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/queries/active

# Cancel a specific runaway query
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/queries/q-abc123
```

### Capacity Planning

Review query history to understand workload patterns:

- Which tokens generate the most queries?
- What are typical query durations?
- How many queries run in parallel?
- Are queries hitting multiple partitions (indicating large time ranges)?

### Incident Response

During performance incidents:

1. List active queries to identify the cause
2. Cancel offending queries immediately
3. Review history to understand what changed
4. Apply [query governance](/arc-enterprise/query-governance) policies to prevent recurrence

## Best Practices

1. **Set an appropriate history size** — The default (100) works for most deployments. Increase it if you need more historical context for debugging.

2. **Monitor active queries in dashboards** — Poll the active queries endpoint from your monitoring system to detect long-running queries early.

3. **Combine with query governance** — Use governance policies to prevent runaway queries automatically, and query management for visibility and manual intervention.

4. **Review parallel query patterns** — Queries with high partition counts span large time ranges. Consider adding time bounds to improve performance.

## Next Steps

- [Query Governance](/arc-enterprise/query-governance) — Automatically enforce rate limits and quotas
- [Audit Logging](/arc-enterprise/audit-logging) — Track query patterns for compliance
