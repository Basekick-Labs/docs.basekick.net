---
sidebar_position: 3
---

# Data Model

Memtrace uses a hybrid storage model: time-series data in Arc, metadata in SQLite.

## Arc Storage (Time-Series Data)

All memories are stored in a single `events` measurement with columns optimized for filtering and querying.

### Schema

| Column | Type | Description |
|--------|------|-------------|
| `time` | TIMESTAMP | Auto-set by Arc, nanosecond precision |
| `org_id` | VARCHAR | Organization/tenant ID |
| `agent_id` | VARCHAR | Agent that created this memory |
| `session_id` | VARCHAR | Session scope (empty if unscoped) |
| `memory_type` | VARCHAR | `episodic` / `session` / `decision` / `entity` |
| `event_type` | VARCHAR | App-defined (e.g., `page_crawled`, `error`) |
| `content` | VARCHAR | Primary content text |
| `metadata_json` | VARCHAR | JSON-encoded arbitrary key-value data |
| `tags_csv` | VARCHAR | Comma-separated tags |
| `dedup_key` | VARCHAR | Deduplication key (SHA256) |
| `importance` | DOUBLE | 0.0-1.0 score |
| `parent_id` | VARCHAR | Link to parent memory (threading) |

### Example Row

```sql
time:          2026-02-13T15:30:00.123456789Z
org_id:        org_abc123
agent_id:      web_crawler
session_id:    sess_xyz789
memory_type:   episodic
event_type:    page_crawled
content:       Crawled https://example.com/products — found 12 items
metadata_json: {"url":"https://example.com/products","item_count":12}
tags_csv:      crawling,products,success
dedup_key:     sha256_hash_of_key_fields
importance:    0.7
parent_id:     null
```

## Arc Columnar Format

Arc stores data in Apache Parquet format — a columnar storage format optimized for analytical queries.

### Benefits of Columnar Storage

**Compression:** Columnar data compresses 10x-100x better than row-based JSON. Repeated values in columns (like `agent_id` or `memory_type`) compress extremely well.

**Query speed:** Time-windowed queries only read relevant time partitions. Column pruning means queries only read the columns they need.

**Example:**
```sql
-- Only reads: time, agent_id, content, memory_type
SELECT time, content
FROM events
WHERE agent_id = 'my_agent'
  AND time > now() - interval '2 hours'
  AND memory_type = 'episodic'
```

### Partitioning

Arc partitions data by time:
```
{database}/{measurement}/{year}/{month}/{day}/{hour}/{filename}.parquet
```

**Example:**
```
memtrace/events/2026/02/13/15/1708005000_1708008600.parquet
```

This means time-windowed queries (e.g., "last 2 hours") only scan relevant files, not the entire dataset.

## SQLite Metadata Store

Local SQLite database stores metadata that's queried separately from time-series data.

### Organizations Table

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Agents Table

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  name TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

### API Keys Table

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,  -- bcrypt hash
  name TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);
```

**Security note:** API keys are bcrypt-hashed. The plaintext key is shown only once at creation and never stored.

## Deduplication Strategy

Memtrace prevents duplicate memories using a SHA256 dedup key.

### Dedup Key Generation

```go
key := SHA256(agent_id + event_type + content[:200])
```

The key is derived from:
- `agent_id` — Which agent created it
- `event_type` — What type of event
- `content[:200]` — First 200 chars of content

### Dedup Window

Before writing a memory, Memtrace checks Arc for an existing memory with the same `dedup_key` within a configurable time window (default: 24h).

**Query:**
```sql
SELECT COUNT(*) FROM events
WHERE dedup_key = 'sha256_hash'
  AND time > now() - interval '24 hours'
```

If a match is found, the write is skipped.

### Configuration

```toml
[deduplication]
enabled = true
window = "24h"
```

**Use cases:**
- Prevent agents from logging "API call failed" 100 times in a loop
- Avoid duplicate "user clicked button" events from double-clicks
- Skip redundant "crawled page X" if already crawled recently

## Shared Memory Model

Memtrace supports multi-agent shared memory through scoping.

### Organization Scope

All agents in an organization can query each other's memories by filtering on `org_id`.

**Query:**
```sql
SELECT * FROM events
WHERE org_id = 'org_abc123'
  AND time > now() - interval '4 hours'
```

### Session Scope

Multiple agents can write to the same session, sharing a bounded context.

**Query:**
```sql
SELECT * FROM events
WHERE session_id = 'sess_xyz789'
  AND time > now() - interval '2 hours'
```

### Tag-Based Filtering

Agents can query memories by tags, regardless of which agent created them.

**Query:**
```sql
SELECT * FROM events
WHERE org_id = 'org_abc123'
  AND tags_csv LIKE '%customer_123%'
  AND time > now() - interval '7 days'
```

## Write Batching

Memtrace buffers writes in-memory and flushes to Arc in batches.

### Batch Configuration

```toml
[write_buffer]
max_size = 1000      # Flush after N memories
max_interval = "5s"  # Flush after N seconds
```

### Batch Format

Writes are sent to Arc in columnar msgpack format — the same format Arc uses internally. This avoids conversion overhead.

**Example batch:**
```json
{
  "database": "memtrace",
  "measurement": "events",
  "columns": ["time", "agent_id", "content", "memory_type", ...],
  "rows": [
    [1708005000, "agent_1", "Memory 1", "episodic", ...],
    [1708005001, "agent_1", "Memory 2", "episodic", ...],
    [1708005002, "agent_2", "Memory 3", "decision", ...]
  ]
}
```

### Benefits

- **High throughput:** 10,000+ writes/sec without overwhelming Arc
- **Reduced network overhead:** One HTTP request for 1000 memories instead of 1000 requests
- **Arc optimization:** Columnar batches compress better and write faster

## Query Patterns

### Time-Windowed Recall

Most common query: "What happened in the last N hours?"

```sql
SELECT time, content, memory_type, event_type
FROM events
WHERE agent_id = 'my_agent'
  AND time > now() - interval '2 hours'
ORDER BY time DESC
```

### Session Context

Get all memories for a session, grouped by type.

```sql
SELECT memory_type, time, content, event_type
FROM events
WHERE session_id = 'sess_xyz789'
  AND time > now() - interval '4 hours'
ORDER BY memory_type, time DESC
```

### Tag Search

Find memories by tag across agents.

```sql
SELECT time, agent_id, content
FROM events
WHERE org_id = 'org_abc123'
  AND tags_csv LIKE '%customer_123%'
  AND time > now() - interval '7 days'
ORDER BY time DESC
```

### Importance Filtering

Get only high-importance memories.

```sql
SELECT time, content, importance
FROM events
WHERE agent_id = 'my_agent'
  AND importance >= 0.8
  AND time > now() - interval '24 hours'
ORDER BY importance DESC, time DESC
```

## Next Steps

- Explore the [API Reference](../api-reference/endpoints.md) to see how these queries map to REST endpoints
- Read about [Memory Types](./memory-types.md) to understand the semantic model
- Check out [Use Cases](../use-cases/overview.md) for real-world examples
