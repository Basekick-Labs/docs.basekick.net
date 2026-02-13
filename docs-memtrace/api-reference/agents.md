---
sidebar_position: 5
---

# Agents

Manage agents and view statistics.

## POST /api/v1/agents

Register a new agent.

### Request

```bash
curl -X POST http://localhost:9100/api/v1/agents \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web_crawler",
    "description": "Crawls product pages",
    "config": {"max_depth": 3}
  }'
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Agent name/identifier |
| `description` | string | no | Human-readable description |
| `config` | object | no | Arbitrary configuration data |

### Response

```json
{
  "agent_id": "agent_abc123",
  "name": "web_crawler",
  "description": "Crawls product pages",
  "config": {"max_depth": 3},
  "created_at": "2026-02-13T10:30:00Z"
}
```

## GET /api/v1/agents

List all agents in the organization.

### Request

```bash
curl "http://localhost:9100/api/v1/agents" \
  -H "x-api-key: mtk_..."
```

### Response

```json
{
  "agents": [
    {
      "agent_id": "agent_abc123",
      "name": "web_crawler",
      "description": "Crawls product pages",
      "created_at": "2026-02-13T10:30:00Z"
    }
  ],
  "count": 5
}
```

## GET /api/v1/agents/:id

Get a specific agent.

### Request

```bash
curl "http://localhost:9100/api/v1/agents/agent_abc123" \
  -H "x-api-key: mtk_..."
```

### Response

```json
{
  "agent_id": "agent_abc123",
  "name": "web_crawler",
  "description": "Crawls product pages",
  "config": {"max_depth": 3},
  "created_at": "2026-02-13T10:30:00Z",
  "updated_at": "2026-02-13T14:45:00Z"
}
```

## GET /api/v1/agents/:id/stats

Get memory statistics for an agent.

### Request

```bash
curl "http://localhost:9100/api/v1/agents/agent_abc/stats" \
  -H "x-api-key: mtk_..."
```

### Response

```json
{
  "agent_id": "agent_abc",
  "memory_count": 1523,
  "memories_24h": 47,
  "errors_24h": 2,
  "session_count": 12,
  "active_sessions": 1,
  "memory_types": {
    "episodic": 1200,
    "decision": 300,
    "entity": 23
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Agent identifier |
| `memory_count` | int | Total memories for this agent |
| `memories_24h` | int | Memories created in last 24 hours |
| `errors_24h` | int | Errors in last 24 hours |
| `session_count` | int | Total sessions for this agent |
| `active_sessions` | int | Currently active sessions |
| `memory_types` | object | Breakdown by memory type |

## DELETE /api/v1/agents/:id

Delete an agent.

### Request

```bash
curl -X DELETE "http://localhost:9100/api/v1/agents/agent_abc123" \
  -H "x-api-key: mtk_..."
```

### Response

Status: `204 No Content`

## Examples

### Register an agent

```bash
curl -X POST http://localhost:9100/api/v1/agents \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "research_agent",
    "description": "Researches market trends and competitor analysis",
    "config": {
      "focus_areas": ["golang", "databases"],
      "update_frequency": "daily"
    }
  }'
```

### List all agents

```bash
curl "http://localhost:9100/api/v1/agents" \
  -H "x-api-key: mtk_..."
```

### Get agent details

```bash
curl "http://localhost:9100/api/v1/agents/agent_abc123" \
  -H "x-api-key: mtk_..."
```

### Get agent statistics

```bash
curl "http://localhost:9100/api/v1/agents/agent_abc123/stats" \
  -H "x-api-key: mtk_..."
```

Response:

```json
{
  "agent_id": "agent_abc123",
  "memory_count": 2543,
  "memories_24h": 156,
  "errors_24h": 0,
  "session_count": 23,
  "active_sessions": 2,
  "memory_types": {
    "episodic": 2100,
    "decision": 380,
    "entity": 63
  }
}
```

### Delete an agent

```bash
curl -X DELETE "http://localhost:9100/api/v1/agents/agent_abc123" \
  -H "x-api-key: mtk_..."
```

## Agent Lifecycle

### 1. Register

Create an agent record before storing memories.

```bash
curl -X POST http://localhost:9100/api/v1/agents \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "my_agent"}'
```

### 2. Store Memories

Store memories for the agent.

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_abc123",
    "content": "First memory"
  }'
```

### 3. Monitor

Check agent statistics periodically.

```bash
curl "http://localhost:9100/api/v1/agents/agent_abc123/stats" \
  -H "x-api-key: mtk_..."
```

### 4. Cleanup

Delete agent when no longer needed.

```bash
curl -X DELETE "http://localhost:9100/api/v1/agents/agent_abc123" \
  -H "x-api-key: mtk_..."
```

## Notes

- Agent IDs are automatically generated on creation
- Deleting an agent does not delete its memories (memories persist in Arc)
- Statistics are computed in real-time from Arc queries
- Agent config is free-form JSON for app-specific data
