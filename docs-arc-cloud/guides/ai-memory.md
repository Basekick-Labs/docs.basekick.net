---
sidebar_position: 3
---

# AI Agent Memory

Use Arc Cloud as a persistent memory layer for AI agents and chatbots -- fast retrieval, SQL flexibility, and structured conversation storage.

## Why Arc Cloud for AI Agents

AI agents need persistent memory that goes beyond in-memory context windows. Arc Cloud provides:

- **Fast Retrieval**: Sub-second SQL queries to fetch relevant conversation history
- **SQL Flexibility**: Query by session, time range, content keywords, role, or any custom metadata
- **Persistent Storage**: Conversations survive restarts, deployments, and scaling events
- **Schema Flexibility**: Store structured metadata alongside conversation content
- **Scalable**: Handle millions of messages across thousands of sessions
- **Integration with Memtrace**: Use [Memtrace](/memtrace) for higher-level memory abstractions built on Arc

## Schema Design

### Conversation History Schema

Conversations map to a `messages` measurement with tags for indexed lookups and fields for content:

| Column | Type | Description |
|--------|------|-------------|
| `time` | timestamp (ns) | When the message was created |
| `session_id` | tag | Conversation session identifier |
| `role` | tag | `system`, `user`, `assistant`, or `tool` |
| `content` | field (string) | Message text content |
| `message_id` | field (string) | Unique message identifier |
| `model` | field (string) | LLM model used (e.g., `claude-sonnet-4-20250514`) |
| `tokens_in` | field (integer) | Input token count |
| `tokens_out` | field (integer) | Output token count |
| `metadata` | field (string) | JSON-encoded additional context (tool calls, user info, tags) |

### Memory/Knowledge Schema

For agent long-term memory and learned facts, use a `memories` measurement:

| Column | Type | Description |
|--------|------|-------------|
| `time` | timestamp (ns) | When the memory was stored |
| `agent_id` | tag | Agent that created this memory |
| `category` | tag | Memory type: `fact`, `preference`, `instruction`, `summary` |
| `content` | field (string) | The memory content |
| `memory_id` | field (string) | Unique memory identifier |
| `source_session` | field (string) | Session that originated this memory |
| `relevance_score` | field (float) | Agent-assigned importance (0.0 to 1.0) |

## Storing Conversation History

### Line Protocol (curl)

Store each message as it occurs in the conversation:

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=ai_memory" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'messages,session_id=sess_abc123,role=user content="What were our Q1 revenue numbers?",message_id="msg_001",metadata="{\"user_id\":\"u_8f3k2\",\"channel\":\"slack\"}" 1711195200000000000
messages,session_id=sess_abc123,role=assistant content="Based on the data I have access to, Q1 revenue was $2.4M, up 18% from last quarter.",message_id="msg_002",model="claude-sonnet-4-20250514",tokens_in=1250i,tokens_out=340i,metadata="{\"tool_calls\":[\"query_revenue_db\"],\"confidence\":0.95}" 1711195202000000000'
```

### Storing Long-Term Memories

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/write/line-protocol?db=ai_memory" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'memories,agent_id=agent_support_01,category=fact content="User u_8f3k2 prefers Python for data pipelines",memory_id="mem_001",source_session="sess_abc123",relevance_score=0.9 1711195200000000000
memories,agent_id=agent_support_01,category=preference content="User u_8f3k2 prefers concise answers",memory_id="mem_002",source_session="sess_abc123",relevance_score=0.85 1711195200000000000'
```

### Python SDK Integration

```python
from arc_tsdb_client import ArcClient
from datetime import datetime

class ArcMemory:
    """Persistent memory store for AI agents using Arc Cloud."""

    def __init__(self, arc_url: str, arc_token: str, database: str = "ai_memory"):
        self.client = ArcClient(
            url=arc_url,
            token=arc_token,
            database=database,
        )

    def store_message(self, session_id: str, role: str, content: str, **kwargs):
        """Store a single message in conversation history."""
        fields = {"content": content}
        fields.update(kwargs)

        self.client.write(
            measurement="messages",
            tags={"session_id": session_id, "role": role},
            fields=fields,
        )

    def store_memory(self, agent_id: str, category: str, content: str, **kwargs):
        """Store a long-term memory or learned fact."""
        fields = {"content": content}
        fields.update(kwargs)

        self.client.write(
            measurement="memories",
            tags={"agent_id": agent_id, "category": category},
            fields=fields,
        )

    def get_recent_messages(self, session_id: str, limit: int = 20) -> list:
        """Retrieve recent messages from a session."""
        result = self.client.query(
            sql=f"""
                SELECT role, content, time
                FROM ai_memory.messages
                WHERE session_id = '{session_id}'
                ORDER BY time DESC
                LIMIT {limit}
            """,
            format="json",
        )
        result.reverse()  # Return in chronological order
        return result

    def search_by_content(self, keywords: str, limit: int = 10) -> list:
        """Search across all sessions for messages matching keywords."""
        return self.client.query(
            sql=f"""
                SELECT session_id, role, content, time
                FROM ai_memory.messages
                WHERE content ILIKE '%{keywords}%'
                ORDER BY time DESC
                LIMIT {limit}
            """,
            format="json",
        )

    def get_time_window(self, session_id: str, hours: int = 24) -> list:
        """Retrieve messages from a session within a time window."""
        return self.client.query(
            sql=f"""
                SELECT role, content, time
                FROM ai_memory.messages
                WHERE session_id = '{session_id}'
                  AND time > NOW() - INTERVAL '{hours} hours'
                ORDER BY time ASC
            """,
            format="json",
        )

    def get_agent_memories(self, agent_id: str, category: str = None, limit: int = 50) -> list:
        """Retrieve long-term memories for an agent."""
        where_clause = f"WHERE agent_id = '{agent_id}'"
        if category:
            where_clause += f" AND category = '{category}'"

        return self.client.query(
            sql=f"""
                SELECT category, content, relevance_score, time
                FROM ai_memory.memories
                {where_clause}
                ORDER BY relevance_score DESC, time DESC
                LIMIT {limit}
            """,
            format="json",
        )
```

## Retrieving Context

Query your data using SQL via the `/api/v1/query` endpoint:

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/query" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT role, content, time FROM ai_memory.messages WHERE session_id = '\''sess_abc123'\'' ORDER BY time DESC LIMIT 20", "format": "json"}'
```

### Recent Messages for a Session

```sql
SELECT role, content, time
FROM ai_memory.messages
WHERE session_id = 'sess_abc123'
ORDER BY time DESC
LIMIT 20;
```

### Search by Content

Find all messages mentioning a topic across sessions:

```sql
SELECT session_id, role, content, time
FROM ai_memory.messages
WHERE content ILIKE '%revenue%'
ORDER BY time DESC
LIMIT 20;
```

### Time-Windowed Retrieval

Get the last 24 hours of conversation for a session:

```sql
SELECT role, content, time
FROM ai_memory.messages
WHERE session_id = 'sess_abc123'
  AND time > NOW() - INTERVAL '24 hours'
ORDER BY time ASC;
```

### Session Summary

Get a high-level view of all sessions for a user:

```sql
SELECT
    session_id,
    MIN(time) AS started_at,
    MAX(time) AS last_message_at,
    COUNT(*) AS message_count,
    COUNT(*) FILTER (WHERE role = 'user') AS user_messages,
    COUNT(*) FILTER (WHERE role = 'assistant') AS assistant_messages
FROM ai_memory.messages
WHERE metadata ILIKE '%u_8f3k2%'
GROUP BY session_id
ORDER BY last_message_at DESC;
```

### Agent Memory Retrieval

Fetch learned facts and preferences for context injection:

```sql
SELECT category, content, relevance_score
FROM ai_memory.memories
WHERE agent_id = 'agent_support_01'
  AND category IN ('fact', 'preference')
  AND relevance_score > 0.7
ORDER BY relevance_score DESC
LIMIT 10;
```

## Integration with Memtrace

[Memtrace](/memtrace) is Basekick Labs' structured AI memory system built on top of Arc. It provides higher-level abstractions for managing agent memory:

- **Session management** with automatic context windowing
- **Memory extraction** that identifies and stores key facts from conversations
- **Relevance ranking** for memory retrieval
- **Multi-agent memory sharing** across agent instances

If you need more than raw SQL queries for memory management, Memtrace adds a structured layer on top of Arc Cloud.

```python
from memtrace import MemtraceClient

client = MemtraceClient(
    arc_url="https://<instance-id>.arc.<region>.basekick.net",
    arc_token="<your-token>",
)

# Store a conversation turn with automatic memory extraction
client.add_message(
    session_id="sess_abc123",
    role="user",
    content="My preferred language is Python and I work on data pipelines.",
)

# Memtrace automatically extracts and stores:
# - fact: "User prefers Python"
# - fact: "User works on data pipelines"

# Retrieve relevant memories for context injection
memories = client.recall(agent_id="agent_01", query="coding preferences", limit=5)
```

See the [Memtrace documentation](/memtrace) for setup instructions, SDK reference, and integration guides.

## Example: Chatbot with Persistent Memory

A complete example of a chatbot that stores conversation history in Arc Cloud and uses it to maintain context across sessions.

```python
from arc_tsdb_client import ArcClient
from datetime import datetime
import time

ARC_URL = "https://<instance-id>.arc.<region>.basekick.net"
ARC_TOKEN = "<your-token>"

client = ArcClient(url=ARC_URL, token=ARC_TOKEN, database="ai_memory")

def get_context(session_id: str, max_messages: int = 10) -> list:
    """Fetch recent conversation history for context."""
    rows = client.query(
        sql=f"""
            SELECT role, content
            FROM ai_memory.messages
            WHERE session_id = '{session_id}'
            ORDER BY time DESC
            LIMIT {max_messages}
        """,
        format="json",
    )
    rows.reverse()
    return [{"role": m["role"], "content": m["content"]} for m in rows]

def store_message(session_id: str, role: str, content: str, **extra):
    """Persist a message to Arc Cloud."""
    fields = {"content": content}
    fields.update(extra)

    client.write(
        measurement="messages",
        tags={"session_id": session_id, "role": role},
        fields=fields,
    )

def chat(session_id: str, user_message: str) -> str:
    """Process a user message with full conversation context."""
    # 1. Store user message
    store_message(session_id, "user", user_message)

    # 2. Retrieve context from Arc Cloud
    history = get_context(session_id)

    # 3. Call your LLM with the full context
    response = call_llm(messages=history)

    # 4. Store assistant response
    store_message(
        session_id, "assistant", response,
        model="claude-sonnet-4-20250514",
        tokens_in=len(user_message.split()),
        tokens_out=len(response.split()),
    )

    return response

# Usage
session = f"sess_{int(time.time())}"
reply = chat(session, "Hello! Can you help me with Python data pipelines?")
print(reply)

# Later, in a new process, the context is still available
reply = chat(session, "What libraries would you recommend?")
```

## Next Steps

- [Memtrace Documentation](/memtrace) -- Structured AI memory built on Arc
- [Data Ingestion Patterns](/arc-cloud/ingestion/data-ingestion) -- All ingestion methods and optimization
- [SQL Querying Guide](/arc/guides/querying) -- Full SQL reference
- [Retention Policies](/arc/data-lifecycle/retention-policies) -- Manage memory data lifecycle
