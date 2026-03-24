---
sidebar_position: 1
---

# API Reference

Arc Cloud instances expose the same HTTP API as self-hosted Arc. Any Arc client, SDK, or integration that works with Arc will work with Arc Cloud without modification.

## Base URL

Each instance has a unique base URL:

```
https://<instance-id>.arc.<region>.basekick.net
```

For example, if your instance ID is `abc123` in `us-east-1`:

```
https://abc123.arc.us-east-1.basekick.net
```

You can find your instance's base URL on the dashboard overview page.

## Authentication

All API requests (except the health check) require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Generate API tokens from the **Settings > API Tokens** section of your instance dashboard.

## Key Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/sql` | Execute SQL queries | Yes |
| `POST` | `/api/v1/ingest` | Ingest records | Yes |
| `GET` | `/health` | Health check | No |
| `GET` | `/api/v1/databases` | List databases | Yes |
| `GET` | `/api/v1/databases/:name/tables` | List tables in a database | Yes |

### Execute SQL

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/sql \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM analytics.events LIMIT 10"}'
```

### Ingest Records

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/ingest \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "database": "analytics",
    "table": "events",
    "records": [
      {"timestamp": "2026-03-23T12:00:00Z", "event": "page_view", "page": "/home"}
    ]
  }'
```

## Response Format

All API responses return JSON with the following structure:

```json
{
  "success": true,
  "data": [...],
  "columns": ["column_name", "column_type"]
}
```

On error:

```json
{
  "success": false,
  "error": "Description of the error"
}
```

## Rate Limiting

Rate limits vary by tier. When you exceed your tier's ingest rate, the API returns a `429 Too Many Requests` response. See the [tier resource table](../configuration/instances.md#resource-allocation-per-tier) for ingest rate limits.

## Full API Documentation

The Arc Cloud API is identical to the self-hosted Arc API. For complete endpoint documentation, request/response schemas, and advanced usage, see the [Arc API Reference](/arc/api-reference).

Any Arc client or SDK works with Arc Cloud — just point it at your instance's base URL and provide your API token.
