---
sidebar_position: 1
---

# Overview

The Memtrace REST API provides a simple HTTP interface for storing and querying memories.

## Base URL

```
http://localhost:9100
```

Change the host and port via configuration. See [Configuration](/installation/configuration).

## Authentication

All API endpoints (except `/health` and `/ready`) require authentication via API key.

### API Key Header

```bash
x-api-key: mtk_...
```

Or use the `Authorization` header with Bearer scheme:

```bash
Authorization: Bearer mtk_...
```

### Getting Your API Key

On first run, Memtrace prints your admin API key:

```
FIRST RUN: Save your admin API key (shown only once)
API Key: mtk_...
```

**Save this key — it's shown only once.**

## Response Formats

All responses are JSON.

### Success Response

```json
{
  "memory_id": "abc123",
  "agent_id": "my_agent",
  "content": "Crawled example.com",
  "time": "2026-02-13T10:30:00Z"
}
```

### Error Response

```json
{
  "error": "invalid_request",
  "message": "agent_id is required"
}
```

## Common Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request (validation error) |
| `401` | Unauthorized (missing or invalid API key) |
| `404` | Not found |
| `500` | Internal server error |

## Rate Limits

No rate limits by default. Configure rate limiting at the reverse proxy level (nginx, Caddy, etc.) if needed.

## Time Formats

Time values can be specified in two formats:

### Relative Time

Human-readable relative time strings:

- `2h` — 2 hours ago
- `30m` — 30 minutes ago
- `7d` — 7 days ago
- `1w` — 1 week ago

### Absolute Time

ISO 8601 timestamps:

```
2026-02-13T10:30:00Z
```

## Pagination

List endpoints support pagination:

| Param | Type | Description |
|-------|------|-------------|
| `limit` | int | Max results per page (default 100, max 1000) |
| `offset` | int | Number of results to skip |

Response includes pagination metadata:

```json
{
  "memories": [...],
  "count": 42,
  "has_more": true
}
```

## Health Checks

### GET /health

Returns service status. No auth required.

```bash
curl http://localhost:9100/health
```

Response:

```json
{
  "status": "ok",
  "service": "memtrace",
  "uptime": "2h30m15s"
}
```

### GET /ready

Checks Arc connectivity. No auth required.

```bash
curl http://localhost:9100/ready
```

Response:

```json
{
  "status": "ready",
  "arc": "connected"
}
```

## Example Requests

### cURL

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "content": "Crawled https://example.com",
    "memory_type": "episodic"
  }'
```

### Python

```python
import requests

headers = {
    "x-api-key": "mtk_...",
    "Content-Type": "application/json"
}

data = {
    "agent_id": "my_agent",
    "content": "Crawled https://example.com",
    "memory_type": "episodic"
}

response = requests.post(
    "http://localhost:9100/api/v1/memories",
    headers=headers,
    json=data
)
```

### JavaScript

```javascript
const response = await fetch('http://localhost:9100/api/v1/memories', {
  method: 'POST',
  headers: {
    'x-api-key': 'mtk_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agent_id: 'my_agent',
    content: 'Crawled https://example.com',
    memory_type: 'episodic'
  })
});

const data = await response.json();
```

## Next Steps

- [Memories API](/api-reference/memories) - Store and retrieve memories
- [Search API](/api-reference/search) - Search with filters
- [Sessions API](/api-reference/sessions) - Session context
- [Agents API](/api-reference/agents) - Agent management
