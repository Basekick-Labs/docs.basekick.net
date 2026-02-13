---
sidebar_position: 1
---

# Query Governance

Control resource usage with per-token rate limits, query quotas, and row limits. Protect your cluster from runaway queries and ensure fair resource allocation across teams.

## Overview

Query governance enforces limits at the API token level:

- **Rate limits** — Maximum queries per minute and per hour
- **Query quotas** — Maximum queries per hour and per day
- **Row limits** — Maximum rows returned per query
- **Per-token policies** — Override defaults for specific tokens
- **Usage monitoring** — Track current usage and remaining quotas

## Prerequisites

- Authentication must be enabled (`ARC_AUTH_ENABLED=true`) — governance is enforced per token
- Arc Enterprise license with query governance feature

## Configuration

### Default Limits

Set global defaults that apply to all tokens without a specific policy:

```toml
[governance]
enabled = true
default_rate_limit_per_min = 60      # 0 = unlimited
default_rate_limit_per_hour = 1000
default_max_queries_per_hour = 500
default_max_queries_per_day = 5000
default_max_rows_per_query = 100000
```

### Environment Variables

```bash
ARC_GOVERNANCE_ENABLED=true
ARC_GOVERNANCE_DEFAULT_RATE_LIMIT_PER_MIN=60
ARC_GOVERNANCE_DEFAULT_RATE_LIMIT_PER_HOUR=1000
ARC_GOVERNANCE_DEFAULT_MAX_QUERIES_PER_HOUR=500
ARC_GOVERNANCE_DEFAULT_MAX_QUERIES_PER_DAY=5000
ARC_GOVERNANCE_DEFAULT_MAX_ROWS_PER_QUERY=100000
```

:::info Unlimited by Default
Setting any limit to `0` means unlimited. If you want governance enabled but with no default restrictions, set all defaults to `0` and create explicit policies for tokens that need limits.
:::

## Enforcement Behavior

When a limit is exceeded, Arc responds with:

| Scenario | HTTP Status | Behavior |
|----------|------------|----------|
| Rate limit exceeded | `429 Too Many Requests` | Includes `Retry-After` header |
| Query quota exhausted | `429 Too Many Requests` | Quota resets at the next period boundary |
| Max rows exceeded | `200 OK` | Returns partial results with a warning |

**Rate limit response example:**

```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 45 seconds.",
  "retry_after": 45
}
```

The response includes a `Retry-After` HTTP header that clients can use for automatic backoff.

## Per-Token Policies

Override default limits for specific tokens. This is useful for giving higher limits to critical services or stricter limits to external integrations.

### Create Policy

```bash
curl -X POST http://localhost:8000/api/v1/governance/policies \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token_id": 1,
    "rate_limit_per_minute": 120,
    "rate_limit_per_hour": 5000,
    "max_queries_per_hour": 2000,
    "max_queries_per_day": 20000,
    "max_rows_per_query": 500000
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token_id": 1,
    "rate_limit_per_minute": 120,
    "rate_limit_per_hour": 5000,
    "max_queries_per_hour": 2000,
    "max_queries_per_day": 20000,
    "max_rows_per_query": 500000,
    "created_at": "2026-02-13T10:00:00Z",
    "updated_at": "2026-02-13T10:00:00Z"
  }
}
```

### List All Policies

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/governance/policies
```

### Get Policy for Token

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/governance/policies/1
```

### Update Policy

```bash
curl -X PUT http://localhost:8000/api/v1/governance/policies/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rate_limit_per_minute": 200,
    "max_rows_per_query": 1000000
  }'
```

### Delete Policy

Removes the per-token policy. The token reverts to the global defaults.

```bash
curl -X DELETE http://localhost:8000/api/v1/governance/policies/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Usage Monitoring

Check current usage and remaining quotas for any token.

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/governance/usage/1
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token_id": 1,
    "current_minute_count": 15,
    "rate_limit_per_minute": 120,
    "current_hour_count": 342,
    "max_queries_per_hour": 2000,
    "current_day_count": 1580,
    "max_queries_per_day": 20000,
    "remaining_minute": 105,
    "remaining_hour": 1658,
    "remaining_day": 18420
  }
}
```

## Best Practices

1. **Set conservative defaults** — Start with moderate limits (e.g., 60/min, 500/hour) and increase for tokens that need more.

2. **Give critical services higher limits** — Create explicit policies for ingestion and dashboard tokens that need higher throughput.

3. **Use row limits for external integrations** — Prevent third-party tools from pulling excessive data with `max_rows_per_query`.

4. **Monitor usage patterns** — Use the usage API to identify tokens approaching their limits before they start getting throttled.

5. **Pair with query management** — Use [query management](/arc-enterprise/query-management) to identify which queries consume the most resources.

## Next Steps

- [Query Management](/arc-enterprise/query-management) — Monitor and cancel running queries
- [Audit Logging](/arc-enterprise/audit-logging) — Track all governance enforcement events
