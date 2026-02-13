---
sidebar_position: 4
---

# Sessions

Manage sessions and retrieve LLM-ready context.

## POST /api/v1/sessions

Create a new session.

### Request

```bash
curl -X POST http://localhost:9100/api/v1/sessions \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_abc",
    "metadata": {"task": "product_research"}
  }'
```

### Response

```json
{
  "session_id": "sess_abc123",
  "agent_id": "agent_abc",
  "status": "active",
  "created_at": "2026-02-13T10:30:00Z",
  "metadata": {"task": "product_research"}
}
```

## GET /api/v1/sessions

List sessions. Optional `agent_id` query param to filter.

### Request

```bash
curl "http://localhost:9100/api/v1/sessions?agent_id=agent_abc" \
  -H "x-api-key: mtk_..."
```

### Response

```json
{
  "sessions": [
    {
      "session_id": "sess_abc123",
      "agent_id": "agent_abc",
      "status": "active",
      "created_at": "2026-02-13T10:30:00Z"
    }
  ],
  "count": 12
}
```

## GET /api/v1/sessions/:id

Get a specific session.

### Request

```bash
curl "http://localhost:9100/api/v1/sessions/sess_abc123" \
  -H "x-api-key: mtk_..."
```

### Response

```json
{
  "session_id": "sess_abc123",
  "agent_id": "agent_abc",
  "status": "active",
  "created_at": "2026-02-13T10:30:00Z",
  "updated_at": "2026-02-13T14:45:00Z",
  "metadata": {"task": "product_research"}
}
```

## PUT /api/v1/sessions/:id

Update session status or metadata.

### Request

```bash
curl -X PUT http://localhost:9100/api/v1/sessions/sess_abc123 \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

### Response

```json
{
  "session_id": "sess_abc123",
  "agent_id": "agent_abc",
  "status": "closed",
  "updated_at": "2026-02-13T15:00:00Z"
}
```

## POST /api/v1/sessions/:id/context

Get LLM-ready formatted context for a session.

This is the killer feature: it queries memories for a session, groups them by type, and returns LLM-ready markdown that you inject directly into any prompt.

### Request

```bash
curl -X POST http://localhost:9100/api/v1/sessions/sess_abc/context \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "since": "4h",
    "include_types": ["episodic", "decision"],
    "max_tokens": 2000
  }'
```

### Request Fields

| Field | Type | Description |
|-------|------|-------------|
| `since` | string | Relative (`2h`, `7d`) or ISO8601 |
| `until` | string | Relative or ISO8601 |
| `include_types` | string[] | Memory types to include |
| `exclude_types` | string[] | Memory types to exclude |
| `max_tokens` | int | Approximate token limit |
| `order` | string | `asc` or `desc` (default) |

### Response

```json
{
  "session_id": "sess_abc",
  "context": "## Session Context (sess_abc)\n\n### Recent Actions (12)\n- Crawled https://example.com — found 3 product pages\n- Extracted pricing data from 3 pages\n...\n\n### Decisions (5)\n- Decided to focus on product category A based on higher engagement\n...",
  "memory_count": 15
}
```

### Context Format

The `context` field contains markdown formatted for LLM consumption:

```markdown
## Session Context (sess_abc)

### Recent Actions (12)
- Crawled https://example.com — found 3 product pages
- Extracted pricing data from 3 pages
- Stored data in database

### Decisions (5)
- Decided to focus on product category A based on higher engagement
- Chose to skip category B due to low quality data

### Entities (3)
- Product X: High engagement, trending topic
- Product Y: Low stock, price increased 20%
- Product Z: New release, positive reviews
```

## Examples

### Create a session

```bash
curl -X POST http://localhost:9100/api/v1/sessions \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_researcher",
    "metadata": {
      "task": "market_research",
      "topic": "golang_generics"
    }
  }'
```

### Get session context

```bash
curl -X POST http://localhost:9100/api/v1/sessions/sess_abc123/context \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "since": "4h",
    "include_types": ["episodic", "decision"]
  }'
```

### Use context in an LLM prompt

```python
from memtrace import Memtrace

client = Memtrace("http://localhost:9100", "mtk_...")

# Get session context
ctx = client.get_session_context(
    "sess_abc123",
    since="4h",
    include_types=["episodic", "decision"]
)

# Inject into Claude prompt
from anthropic import Anthropic

anthropic = Anthropic()

response = anthropic.messages.create(
    model="claude-sonnet-4-20250514",
    system=f"You are a research agent.\n\n{ctx['context']}",
    messages=[
        {"role": "user", "content": "What have you learned so far?"}
    ]
)
```

### Close a session

```bash
curl -X PUT http://localhost:9100/api/v1/sessions/sess_abc123 \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

### Filter context by time

Get context from the last 2 hours only:

```bash
curl -X POST http://localhost:9100/api/v1/sessions/sess_abc/context \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "since": "2h"
  }'
```

### Limit context size

Limit context to approximately 2000 tokens:

```bash
curl -X POST http://localhost:9100/api/v1/sessions/sess_abc/context \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "since": "4h",
    "max_tokens": 2000
  }'
```

### Exclude certain memory types

Get context without entity memories:

```bash
curl -X POST http://localhost:9100/api/v1/sessions/sess_abc/context \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "since": "4h",
    "exclude_types": ["entity"]
  }'
```
