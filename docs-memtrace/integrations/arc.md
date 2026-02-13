---
sidebar_position: 1
---

# Arc Storage Backend

Memtrace requires an Arc instance as its storage backend. All memories are stored in Arc's time-series format, providing high-performance temporal queries and efficient compression.

## Overview

Memtrace uses Arc to store all memory data as time-series events. This architecture provides several key benefits:

- **Native time-windowed queries** - Queries like "what happened in the last 2 hours?" are first-class operations
- **High write throughput** - Arc handles thousands of memory writes per second
- **Efficient compression** - Parquet-based storage with automatic compaction
- **SQL analytics** - Query memories using DuckDB SQL via Arc's query engine
- **Scalable storage** - 2-tier storage system with hot (local) and cold (S3/Azure) tiers

## Database Setup

Memtrace creates a dedicated database in Arc called `memtrace` with the following measurements:

- `memories` - All memory events (episodic, decision, entity, session)
- `agents` - Agent registration metadata
- `sessions` - Session lifecycle events

Each measurement is stored as a time-series with automatic partitioning by year/month/day/hour.

## Connection Configuration

Configure Arc connection in your `memtrace.toml`:

```toml
[arc]
url = "http://localhost:8080"        # Arc instance URL
api_key = "ak_your_arc_key"          # Arc API key
database = "memtrace"                # Database name (created automatically)
write_timeout = "30s"                # Write operation timeout
query_timeout = "60s"                # Query operation timeout
```

Environment variables override config file settings:

```bash
export ARC_URL="http://localhost:8080"
export ARC_API_KEY="ak_your_arc_key"
export ARC_DATABASE="memtrace"
```

## Data Storage Format

### Memory Records

Each memory is stored as a time-series event with the following schema:

```json
{
  "time": "2026-02-13T10:30:00Z",
  "agent_id": "my_agent",
  "session_id": "sess_abc123",
  "memory_type": "episodic",
  "event_type": "observation",
  "content": "User clicked the settings button",
  "tags": ["ui", "navigation"],
  "importance": 0.7,
  "metadata": {"screen": "dashboard"}
}
```

### Agent Records

Agent registrations are stored with metadata:

```json
{
  "time": "2026-02-13T10:00:00Z",
  "agent_id": "my_agent",
  "name": "my-agent",
  "description": "Handles customer support",
  "config": {"model": "gpt-4"}
}
```

### Session Records

Session lifecycle events track session creation and closure:

```json
{
  "time": "2026-02-13T10:15:00Z",
  "session_id": "sess_abc123",
  "agent_id": "my_agent",
  "status": "active",
  "metadata": {"task": "onboarding"}
}
```

## Storage Optimization

Arc automatically optimizes Memtrace data storage through:

- **Hourly compaction** - Small files are merged into larger, more efficient Parquet files
- **Daily compaction** - Hour-level files are merged into daily aggregates
- **Automatic tiering** - Old data moves to cold storage (S3/Azure) based on retention policies
- **Query caching** - Frequently accessed time windows are cached for faster retrieval

## Query Performance

Memtrace queries leverage Arc's optimized time-series engine:

- **Time-windowed queries** - Fast retrieval of memories within specific time ranges
- **Tag filtering** - Efficient filtering by tags using Arc's columnar storage
- **Importance scoring** - Quick filtering by importance threshold
- **Content search** - Full-text search across memory content

Typical query performance:

- Recent memories (last 24h): < 10ms
- Filtered search (7 days): < 50ms
- Full-text search (30 days): < 200ms

## Requirements

### Minimum Arc Version

Memtrace requires Arc 2026.02.1 or later.

### Arc Configuration

Your Arc instance should be configured with:

```toml
[storage]
path = "/path/to/arc/data"
tier_enabled = true                  # Optional: enable cold storage tiering

[compaction]
hourly_min_files = 10
daily_min_files = 12
```

### Authentication

Memtrace requires an Arc API key with the following permissions:

- `database:create` - Create the memtrace database
- `write:data` - Write memory events
- `read:data` - Query memory data

Generate an API key in Arc:

```bash
curl -X POST http://localhost:8080/api/v1/keys \
  -H "x-api-key: <admin_key>" \
  -d '{"name": "memtrace", "permissions": ["database:create", "write:data", "read:data"]}'
```

## Monitoring

Monitor Memtrace storage health through Arc's metrics:

```bash
# Check database size
curl http://localhost:8080/api/v1/databases/memtrace/stats \
  -H "x-api-key: ak_..."

# Check recent writes
curl http://localhost:8080/api/v1/databases/memtrace/measurements/memories/stats \
  -H "x-api-key: ak_..."
```

Key metrics to monitor:

- Write throughput (events/second)
- Query latency (p50, p95, p99)
- Storage size and growth rate
- Compaction progress

## Backup and Recovery

Memtrace data is stored in Arc's standard Parquet format, making backups straightforward:

### Backup

```bash
# Backup Arc data directory
rsync -av /path/to/arc/data/memtrace /backup/location/

# Or use Arc's built-in snapshot feature
curl -X POST http://localhost:8080/api/v1/databases/memtrace/snapshot \
  -H "x-api-key: ak_..."
```

### Recovery

```bash
# Restore from backup
rsync -av /backup/location/memtrace /path/to/arc/data/

# Restart Arc to pick up restored data
systemctl restart arc
```

## Troubleshooting

### Connection Issues

If Memtrace cannot connect to Arc:

1. Verify Arc is running: `curl http://localhost:8080/health`
2. Check API key permissions
3. Verify network connectivity between Memtrace and Arc
4. Check Arc logs for authentication errors

### Write Failures

If memory writes fail:

1. Check Arc write permissions
2. Verify disk space on Arc instance
3. Check Arc write timeout settings
4. Monitor Arc metrics for backpressure

### Query Performance

If queries are slow:

1. Check time window size (smaller windows = faster queries)
2. Verify Arc compaction is running
3. Enable query result caching
4. Consider adding indexes on frequently filtered fields
