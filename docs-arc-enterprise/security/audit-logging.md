---
sidebar_position: 2
---

# Audit Logging

Track every significant operation in your Arc deployment. Audit logging captures authentication attempts, data access, configuration changes, and infrastructure events for compliance and security monitoring.

## Overview

Arc Enterprise audit logging provides:

- **Comprehensive event capture** — Authentication, data operations, RBAC changes, and infrastructure events
- **Query and filter API** — Search logs by event type, actor, database, and time range
- **Configurable retention** — Automatic cleanup of old audit entries
- **Non-blocking** — Audit events are captured asynchronously with zero impact on request latency

## Event Types

| Category | Events | Description |
|----------|--------|-------------|
| **Authentication** | `auth.failed` | Failed authentication attempts (401/403) |
| **Token Management** | `token.created`, `token.deleted`, `token.rotated` | API token lifecycle events |
| **RBAC** | `rbac.org.created`, `rbac.team.updated`, `rbac.role.deleted`, etc. | Organization, team, role, and membership changes |
| **Data Operations** | `data.query`, `data.write`, `data.import`, `data.delete` | Data read/write operations |
| **Database Management** | `database.created`, `database.deleted` | Database lifecycle events |
| **Infrastructure** | `mqtt.*`, `compaction.triggered`, `tiering.*` | System and background operations |
| **API** | `api.POST`, `api.PUT`, `api.DELETE` | Catch-all for other API operations |

## Configuration

### TOML

```toml
[audit_log]
enabled = true
retention_days = 90          # Auto-cleanup entries older than this
include_reads = false        # Log GET/query requests (high volume)
```

### Environment Variables

```bash
ARC_AUDIT_LOG_ENABLED=true
ARC_AUDIT_LOG_RETENTION_DAYS=90
ARC_AUDIT_LOG_INCLUDE_READS=false
```

:::warning High-Volume Read Logging
Enabling `include_reads` logs every query and GET request. This can generate significant log volume in high-throughput environments. Enable it only when needed for compliance or debugging, and consider a shorter `retention_days` when active.
:::

## API Reference

All audit endpoints require admin authentication.

### Query Audit Logs

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/audit/logs?limit=20"
```

**Filter parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `event_type` | string | Filter by event type (e.g., `auth.failed`, `data.write`) |
| `actor` | string | Filter by actor (token name or ID) |
| `database` | string | Filter by database name |
| `since` | string | Start time (RFC3339, e.g., `2026-02-01T00:00:00Z`) |
| `until` | string | End time (RFC3339) |
| `limit` | int | Maximum results (default: 50) |
| `offset` | int | Pagination offset |

**Examples:**

```bash
# Failed authentication attempts in the last 24 hours
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/audit/logs?event_type=auth.failed&since=2026-02-12T00:00:00Z"

# All write operations to the production database
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/audit/logs?event_type=data.write&database=production"

# Recent RBAC changes
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/audit/logs?event_type=rbac&limit=50"

# Activity by a specific token
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/audit/logs?actor=telegraf-writer&limit=100"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1542,
      "event_type": "data.write",
      "actor": "telegraf-writer",
      "database": "production",
      "detail": "measurement=cpu, records=5000",
      "ip_address": "10.0.1.50",
      "timestamp": "2026-02-13T10:30:00Z"
    },
    {
      "id": 1541,
      "event_type": "auth.failed",
      "actor": "unknown",
      "detail": "invalid token",
      "ip_address": "192.168.1.100",
      "timestamp": "2026-02-13T10:29:55Z"
    }
  ],
  "total": 1542,
  "limit": 20,
  "offset": 0
}
```

### Get Audit Statistics

Aggregate event counts by type, useful for dashboards and alerting.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/audit/stats"
```

**With time range:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/audit/stats?since=2026-02-01T00:00:00Z&until=2026-02-13T23:59:59Z"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "auth.failed": 23,
    "data.write": 15420,
    "data.query": 8340,
    "token.created": 5,
    "rbac.role.created": 3,
    "database.created": 2
  }
}
```

## Compliance Use Cases

### SOC 2

SOC 2 requires logging of access to systems and data. Arc audit logging captures:
- Who accessed the system (actor/token identification)
- What they did (event type and detail)
- When it happened (timestamp)
- Where the request came from (IP address)

### HIPAA

For healthcare data, enable `include_reads = true` to log all data access, including queries. Set `retention_days` according to your HIPAA retention requirements (typically 6 years).

### Security Monitoring

Monitor `auth.failed` events to detect brute-force attempts. Use the stats API to set up alerts when failed authentication counts exceed normal thresholds.

## Best Practices

1. **Start with writes only** — Keep `include_reads = false` (default) and enable read logging only when compliance requires it.

2. **Set appropriate retention** — 90 days is a good default. Adjust based on your compliance requirements (HIPAA may require years).

3. **Monitor failed auth attempts** — Set up alerts on `auth.failed` events to detect unauthorized access attempts.

4. **Pair with RBAC** — Use audit logs to verify that RBAC permissions are configured correctly by reviewing who accessed what data.

5. **Export for long-term analysis** — For retention beyond what Arc stores, periodically export audit logs to your SIEM or log management system.

## Next Steps

- [RBAC](/arc-enterprise/rbac) — Control who can access your data
- [Query Governance](/arc-enterprise/query-governance) — Add rate limits and quotas
