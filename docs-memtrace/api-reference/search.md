---
sidebar_position: 3
---

# Search

Search memories with structured filters and content matching.

## POST /api/v1/search

Search memories with structured filters.

### Request

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_abc",
    "memory_types": ["episodic", "decision"],
    "event_types": ["page_crawled"],
    "tags": ["products"],
    "content_contains": "example.com",
    "min_importance": 0.5,
    "since": "7d",
    "order": "desc",
    "limit": 50
  }'
```

### Request Fields

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Filter by agent |
| `session_id` | string | Filter by session |
| `memory_types` | string[] | Filter by types (OR) |
| `event_types` | string[] | Filter by event types (OR) |
| `tags` | string[] | Filter by tags (AND) |
| `content_contains` | string | Case-insensitive substring match |
| `min_importance` | float | Minimum importance score (0.0 to 1.0) |
| `max_importance` | float | Maximum importance score (0.0 to 1.0) |
| `since` | string | Relative (`2h`, `7d`) or ISO8601 |
| `until` | string | Relative or ISO8601 |
| `order` | string | `asc` or `desc` (default) |
| `limit` | int | Max results (default 100, max 1000) |
| `offset` | int | Pagination offset |

### Response

```json
{
  "results": [
    {
      "time": "2026-02-13T10:30:00Z",
      "agent_id": "agent_abc",
      "content": "Crawled https://example.com — found 3 product pages",
      "memory_type": "episodic",
      "event_type": "page_crawled",
      "tags": ["products", "crawling"],
      "importance": 0.7
    }
  ],
  "count": 23,
  "query_time_ms": 12
}
```

## Examples

### Search by content

Find all memories containing "example.com":

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "content_contains": "example.com",
    "since": "7d"
  }'
```

### Filter by memory type

Find all decisions made in the last 24 hours:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "memory_types": ["decision"],
    "since": "24h"
  }'
```

### Filter by event type

Find all page crawl events:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "web_crawler",
    "event_types": ["page_crawled", "link_discovered"],
    "since": "48h"
  }'
```

### Filter by tags

Find memories with specific tags (AND logic):

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "tags": ["products", "crawling"],
    "since": "7d"
  }'
```

### Filter by importance

Find high-importance memories:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "min_importance": 0.8,
    "since": "7d"
  }'
```

### Combine filters

Find important decisions about products:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "memory_types": ["decision"],
    "tags": ["products"],
    "min_importance": 0.7,
    "since": "30d",
    "limit": 20
  }'
```

### Time range search

Find memories in a specific time window:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "since": "2026-02-01T00:00:00Z",
    "until": "2026-02-07T23:59:59Z"
  }'
```

### Pagination

Search with pagination:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "memory_types": ["episodic"],
    "limit": 50,
    "offset": 100
  }'
```

### Search across sessions

Find all memories for an agent across all sessions:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "memory_types": ["episodic", "decision"],
    "since": "30d"
  }'
```

### Session-specific search

Find memories within a specific session:

```bash
curl -X POST http://localhost:9100/api/v1/search \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "session_id": "sess_abc123",
    "since": "4h"
  }'
```

## Search vs. List

The search endpoint (`POST /api/v1/search`) provides more structured filtering than the list endpoint (`GET /api/v1/memories`):

- **Search** supports content matching, importance filters, and multiple memory types
- **List** is simpler and uses query parameters for basic filtering

Use search for complex queries. Use list for simple queries.
