---
sidebar_position: 2
---

# Memories

Store and retrieve memories for AI agents.

## POST /api/v1/memories

Create a memory (single or batch).

### Single Memory

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_web_crawler",
    "session_id": "sess_abc123",
    "memory_type": "episodic",
    "event_type": "page_crawled",
    "content": "Crawled https://example.com — found 3 product pages",
    "metadata": {"url": "https://example.com", "pages_found": 3},
    "tags": ["crawling", "products"],
    "importance": 0.7,
    "dedup_key": "crawl_example_2026-02-07"
  }'
```

### Batch Memories

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "memories": [
      {"agent_id": "agent_1", "content": "First memory", "memory_type": "episodic"},
      {"agent_id": "agent_1", "content": "Second memory", "memory_type": "decision"}
    ]
  }'
```

### Request Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agent_id` | string | yes | — | Agent identifier |
| `content` | string | yes | — | Memory content |
| `memory_type` | string | no | `episodic` | `episodic`, `session`, `decision`, `entity` |
| `event_type` | string | no | `general` | App-defined event type |
| `session_id` | string | no | — | Session scope |
| `metadata` | object | no | — | Arbitrary key-value data |
| `tags` | string[] | no | — | Tags for filtering |
| `importance` | float | no | 0 | 0.0 to 1.0 |
| `dedup_key` | string | no | auto | Deduplication key |
| `parent_id` | string | no | — | Parent memory for threading |

### Memory Types

- **`episodic`**: What happened (actions, observations)
- **`decision`**: Why something happened (reasoning, choices)
- **`entity`**: What exists (entities, facts, relationships)
- **`session`**: Session-specific context

### Response

Status: `201 Created`

```json
{
  "time": "2026-02-07T20:15:00Z",
  "org_id": "org_default",
  "agent_id": "agent_web_crawler",
  "content": "Crawled https://example.com — found 3 product pages",
  "memory_type": "episodic",
  "event_type": "page_crawled",
  "dedup_key": "a1b2c3d4..."
}
```

## GET /api/v1/memories

List memories with filters.

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Filter by agent |
| `session_id` | string | Filter by session |
| `memory_type` | string | Filter by type |
| `event_type` | string | Filter by event type |
| `tags` | string | Comma-separated tags (AND) |
| `since` | string | Relative (`2h`, `7d`) or ISO8601 |
| `until` | string | Relative or ISO8601 |
| `limit` | int | Max results (default 100, max 1000) |
| `offset` | int | Pagination offset |
| `order` | string | `asc` or `desc` (default) |

### Examples

Recent memories for an agent:

```bash
curl "http://localhost:9100/api/v1/memories?agent_id=my_agent&since=2h" \
  -H "x-api-key: mtk_..."
```

Memories for a session:

```bash
curl "http://localhost:9100/api/v1/memories?session_id=sess_abc&since=4h" \
  -H "x-api-key: mtk_..."
```

Filter by type and tags:

```bash
curl "http://localhost:9100/api/v1/memories?agent_id=my_agent&memory_type=episodic&tags=crawling,products&since=7d" \
  -H "x-api-key: mtk_..."
```

Time range:

```bash
curl "http://localhost:9100/api/v1/memories?agent_id=my_agent&since=2026-02-01T00:00:00Z&until=2026-02-07T23:59:59Z" \
  -H "x-api-key: mtk_..."
```

Pagination:

```bash
curl "http://localhost:9100/api/v1/memories?agent_id=my_agent&limit=50&offset=100" \
  -H "x-api-key: mtk_..."
```

### Response

```json
{
  "memories": [
    {
      "time": "2026-02-13T10:30:00Z",
      "agent_id": "my_agent",
      "session_id": "sess_abc",
      "memory_type": "episodic",
      "event_type": "page_crawled",
      "content": "Crawled https://example.com",
      "metadata": {"url": "https://example.com"},
      "tags": ["crawling"],
      "importance": 0.7
    }
  ],
  "count": 42,
  "has_more": true
}
```

## GET /api/v1/memories/:id

Get a specific memory by ID.

### Request

```bash
curl "http://localhost:9100/api/v1/memories/abc123" \
  -H "x-api-key: mtk_..."
```

### Response

```json
{
  "time": "2026-02-13T10:30:00Z",
  "memory_id": "abc123",
  "agent_id": "my_agent",
  "content": "Crawled https://example.com",
  "memory_type": "episodic",
  "event_type": "page_crawled",
  "metadata": {"url": "https://example.com"},
  "tags": ["crawling"],
  "importance": 0.7
}
```

## Examples

### Store an episodic memory

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_researcher",
    "content": "Read article: Go generics best practices",
    "memory_type": "episodic",
    "event_type": "article_read",
    "tags": ["research", "golang"],
    "importance": 0.8
  }'
```

### Store a decision memory

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_writer",
    "content": "Decided to write about Go generics because engagement was high last week",
    "memory_type": "decision",
    "event_type": "topic_selected",
    "tags": ["content"],
    "importance": 0.9
  }'
```

### Store an entity memory

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_crm",
    "content": "Customer prefers email communication, timezone PST",
    "memory_type": "entity",
    "event_type": "customer_preference",
    "metadata": {"customer_id": "cust_123"},
    "tags": ["customer", "preferences"],
    "importance": 0.7
  }'
```

### Batch insert

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "memories": [
      {
        "agent_id": "agent_pipeline",
        "content": "Processed batch 1: 1000 records",
        "memory_type": "episodic",
        "event_type": "batch_processed"
      },
      {
        "agent_id": "agent_pipeline",
        "content": "Processed batch 2: 1000 records",
        "memory_type": "episodic",
        "event_type": "batch_processed"
      },
      {
        "agent_id": "agent_pipeline",
        "content": "Processed batch 3: 1000 records",
        "memory_type": "episodic",
        "event_type": "batch_processed"
      }
    ]
  }'
```

### Deduplication

Use `dedup_key` to prevent duplicate memories:

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_crawler",
    "content": "Crawled https://example.com",
    "memory_type": "episodic",
    "dedup_key": "crawl_example_2026-02-13"
  }'
```

If another memory with the same `dedup_key` exists within the deduplication window (default 24 hours), the second memory will be rejected.
