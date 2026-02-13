---
sidebar_position: 1
---

# Architecture Overview

Memtrace is a Go microservice that provides a memory layer for AI agents. It connects to a running [Arc](https://github.com/Basekick-Labs/arc) time-series database instance over HTTP.

## System Architecture

```
Client App  --[API key]--> Memtrace --[Arc API key]--> Arc
```

- **Writes** go to Arc via `POST /api/v1/write/msgpack` (columnar msgpack format)
- **Queries** go to Arc via `POST /api/v1/query` (SQL over Parquet)
- **Metadata** (sessions, agents, API keys) lives in a local SQLite database

## Components

### Memtrace Server

The core HTTP API server built with Go Fiber. Handles:
- Memory ingestion and retrieval
- Session management
- Agent registration
- API key authentication
- Write batching and deduplication

### Arc Integration

Arc is a high-performance time-series database that stores all memory events. Memtrace uses Arc's columnar storage format (Parquet) for efficient time-windowed queries.

**Why Arc?**
- Native time-series data model
- Columnar storage for fast queries
- SQL query interface (DuckDB)
- High write throughput
- Time-based partitioning

### SQLite Metadata Store

Local SQLite database stores metadata:
- **organizations** — Multi-tenant support
- **agents** — Registered agents with configuration
- **sessions** — Bounded work contexts with lifecycle
- **api_keys** — bcrypt-hashed keys with `mtk_` prefix

This separation keeps hot-path operations (memory reads/writes) fast while providing robust metadata management.

## Data Flow

### Write Path

1. Client sends memory via REST API with API key
2. Memtrace validates authentication and input
3. Memory is checked for deduplication
4. Memory is buffered in-memory batch
5. Batch is flushed to Arc (configurable size/interval)
6. Arc stores memory in columnar Parquet format

### Read Path

1. Client queries memories via REST API
2. Memtrace translates query to Arc SQL
3. Arc scans time-partitioned Parquet files
4. Results are filtered and formatted
5. Memtrace returns memories to client

### Session Context Path

1. Client requests session context
2. Memtrace queries Arc for session memories
3. Memories are grouped by type and sorted by time
4. Memtrace generates LLM-ready markdown
5. Client injects context into LLM prompt

## Key Features

### Deduplication

Memories are deduplicated using a SHA256 key derived from `agent_id + event_type + content[:200]`. Before writing, Memtrace checks Arc for an existing memory with the same key within a configurable time window (default: 24h). This prevents agents from logging duplicate actions.

**Configuration:**
```toml
[deduplication]
enabled = true
window = "24h"
```

### Write Batching

Writes are buffered in-memory and flushed to Arc in batches. This provides high write throughput without overwhelming Arc.

**Configuration:**
```toml
[write_buffer]
max_size = 1000      # Flush after N memories
max_interval = "5s"  # Flush after N seconds
```

### Shared Memory

Multiple agents can share memories through:
- **Organization scope** — All agents in an org see each other's memories
- **Session sharing** — Multiple agents can write to the same session
- **Tag-based filtering** — Agents query for memories tagged with relevant topics

This enables use cases like call center agents sharing customer context, or a team of specialized agents collaborating on a complex task.

## Performance Characteristics

- **Write throughput:** 10,000+ memories/sec (batched)
- **Query latency:** Under 100ms for time-windowed queries
- **Storage:** Columnar Parquet compression (10x-100x vs JSON)
- **Scalability:** Horizontal scaling via Arc clustering

## Next Steps

- Learn about [Memory Types](./memory-types.md) and when to use each
- Understand the [Data Model](./data-model.md) and storage format
- Explore the [API Reference](../api-reference/endpoints.md) for implementation details
