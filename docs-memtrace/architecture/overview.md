---
sidebar_position: 1
---

# Architecture Overview

Memtrace is a Go microservice that provides a memory layer for AI agents. A single deployment can serve multiple organizations, each routed to its own [Arc](https://github.com/Basekick-Labs/arc) time-series database instance over HTTP.

## System Architecture

```
                          ┌──> Arc (org_acme)
Client App  --[mtk_...]-->│
                Memtrace ─┼──> Arc (org_default)
                          └──> Arc (org_other)
```

- The Memtrace API key (`mtk_...`) identifies the caller's org.
- Memtrace looks up that org's Arc connection details (URL, API key, database, measurement) in its metadata DB and routes the request to the right Arc instance.
- **Writes** go to Arc via `POST /api/v1/write/msgpack` (columnar msgpack format).
- **Queries** go to Arc via `POST /api/v1/query` (SQL over Parquet).
- **Metadata** (orgs, Arc instance bindings, sessions, agents, API keys) lives in a local SQLite database.

## Components

### Memtrace Server

The core HTTP API server built with Go Fiber. Handles:
- Memory ingestion and retrieval
- Session management
- Agent registration
- API key authentication and per-org routing
- Write batching and deduplication

### Arc Integration

Arc is a high-performance analytical database that stores all memory events. Memtrace uses Arc's columnar storage format (Parquet) for efficient time-windowed queries.

**Why Arc?**
- Native time-series data model
- Columnar storage for fast queries
- SQL query interface (DuckDB)
- High write throughput
- Time-based partitioning

### SQLite Metadata Store

Local SQLite database stores everything that isn't memory-event data:

- **organizations** — Tenant identity (id, name)
- **arc_instances** — Per-org Arc connection (URL, encrypted API key, database, measurement); `UNIQUE(org_id)`
- **api_keys** — bcrypt-hashed `mtk_` keys, each bound to an `org_id`
- **agents** — Registered agents with config (org-scoped)
- **sessions** — Bounded work contexts with lifecycle (org-scoped)

This separation keeps hot-path operations (memory reads/writes) fast while providing robust metadata management.

## Data Flow

### Write Path

1. Client sends memory via REST API with API key
2. Auth middleware validates the key and pins the caller's `org_id` in the request context
3. Memtrace resolves `arcRegistry.Get(orgID)` → returns the per-org Arc client
4. Memory is checked for deduplication (filtered by `org_id`)
5. Memory is buffered in-memory batch on that org's Arc client
6. Batch is flushed to that org's Arc instance (configurable size/interval)
7. Arc stores memory in columnar Parquet format

### Read Path

1. Client queries memories via REST API with API key
2. Auth middleware pins `org_id` into the request context
3. Memtrace resolves the per-org Arc client and translates the query to Arc SQL — every query has `org_id = '...'` as a hard filter (defense in depth)
4. Arc scans time-partitioned Parquet files
5. Results are filtered and formatted
6. Memtrace returns memories to client

### Session Context Path

1. Client requests session context
2. Memtrace resolves the per-org Arc client and queries memories for that session
3. Memories are grouped by type and sorted by time
4. Memtrace generates LLM-ready markdown
5. Client injects context into LLM prompt

## Multi-tenancy

Memtrace is multi-tenant at both the data and the transport layer:

- **Auth ↔ org binding.** Every API key (`mtk_...`) is bound to exactly one `org_id`. The auth middleware extracts that `org_id` from the request and pins it into the request context — handlers never accept it from the body or URL.
- **Per-org Arc routing.** An Arc client registry holds one `*arc.Client` per org, built from the `arc_instances` table at startup. On every read or write, the manager resolves `arcRegistry.Get(orgID)` and uses that org's Arc instance, database, and API key. There is no global Arc client.
- **Encryption at rest.** Each org's Arc API key is stored AES-256-GCM-encrypted in `arc_instances.api_key_cipher`. The 32-byte master key comes from the `MEMTRACE_MASTER_KEY` environment variable; it is never written to disk by Memtrace. Tampering with a ciphertext fails decryption loudly at startup.
- **Filtered queries.** Even though each org has its own Arc database, every query Memtrace generates also filters by `org_id` as a defense-in-depth measure, so a misconfiguration cannot leak data between orgs.
- **Admin CLI.** Orgs and their Arc bindings are provisioned with `memtrace org create`, `memtrace org add-arc`, and `memtrace key create`. Commands operate directly on the metadata DB and work whether the server is up or not.

If a request arrives with an API key for an org that has no `arc_instances` row, the API returns `503` with a clear error pointing to `memtrace org add-arc` — no nil-pointer, no wrong-database write.

## Key Features

### Deduplication

Memories are deduplicated using a SHA256 key derived from `agent_id + event_type + content[:200]`. Before writing, Memtrace checks Arc for an existing memory with the same key within a configurable time window (default: 24h). The dedup query also filters by `org_id`, so two orgs cannot collide.

```toml
[dedup]
enabled = true
window_hours = 24
```

### Write Batching

Writes are buffered in-memory **per Arc client** (one buffer per org) and flushed in batches. Each org's batch is independent. This provides high write throughput without overwhelming Arc.

```toml
[arc]
write_batch_size = 100
write_flush_interval_ms = 1000
```

### Shared Memory within an org

Multiple agents in the same org can share memories through:

- **Organization scope** — All agents in an org see each other's memories (and use the same Arc instance)
- **Session sharing** — Multiple agents can write to the same session
- **Tag-based filtering** — Agents query for memories tagged with relevant topics

This enables use cases like call center agents sharing customer context, or a team of specialized agents collaborating on a complex task.

## Performance Characteristics

- **Write throughput:** 10,000+ memories/sec (batched, per Arc instance)
- **Query latency:** Under 100ms for time-windowed queries
- **Storage:** Columnar Parquet compression (10x-100x vs JSON)
- **Scalability:** Horizontal scaling via Arc clustering (per-org); per-Memtrace-deployment scaling via standard load balancing

## Next Steps

- [How clients connect](../how-clients-connect.md) — the per-org-API-key model
- Learn about [Memory Types](./memory-types.md) and when to use each
- Understand the [Data Model](./data-model.md) and storage format
- Explore the [API Reference](../api-reference/overview.md) for implementation details
