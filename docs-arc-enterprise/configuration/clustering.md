---
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Clustering & High Availability

Scale Arc horizontally with multi-node clusters. Separate write, read, and compaction workloads across dedicated nodes with automatic failover.

:::tip Choose a deployment pattern first
Arc Enterprise supports two cluster topologies: **shared object storage** and **local storage with peer replication**. See [Deployment Patterns](/arc-enterprise/deployment-patterns) to choose the right one for your environment before configuring a cluster.
:::

## Overview

Arc Enterprise clustering uses a role-based architecture where each node in the cluster serves a specific purpose:

![Arc Enterprise Architecture](/img/arc-enterprise-architecture.jpg)

## Node Roles

| Role | Purpose | Capabilities |
|------|---------|-------------|
| **writer** | Handles data ingestion and WAL | Ingest, coordinate |
| **reader** | Serves queries from shared storage | Query |
| **compactor** | Runs background file optimization | Compact |
| **standalone** | Single-node mode (default) | All capabilities |

- **Writers** receive data via the ingestion API, buffer it, and flush Parquet files to shared storage. WAL replication ensures durability.
- **Readers** query data directly from shared storage using DuckDB. Scale readers horizontally to handle more concurrent queries.
- **Compactors** run hourly and daily file compaction in the background without impacting write or read performance.

## Configuration

### TOML Configuration

```toml
[cluster]
enabled = true
node_id = "writer-01"           # Unique identifier for this node
role = "writer"                 # writer, reader, compactor, standalone
cluster_name = "production"     # Cluster identifier
seeds = ["10.0.1.10:9000", "10.0.1.11:9000"]  # Seed nodes for discovery
coordinator_addr = ":9000"      # Address for inter-node communication
health_check_interval = 10      # Health check interval (seconds)
heartbeat_interval = 5          # Heartbeat interval (seconds)
replication_enabled = true      # Enable WAL replication to readers
query_gate_on_catchup = false   # See "Query Gating During Replication Catch-Up" below
```

### Environment Variables

```bash
ARC_CLUSTER_ENABLED=true
ARC_CLUSTER_NODE_ID=writer-01
ARC_CLUSTER_ROLE=writer
ARC_CLUSTER_CLUSTER_NAME=production
ARC_CLUSTER_SEEDS=10.0.1.10:9000,10.0.1.11:9000
ARC_CLUSTER_COORDINATOR_ADDR=:9000
ARC_CLUSTER_HEALTH_CHECK_INTERVAL=10
ARC_CLUSTER_HEARTBEAT_INTERVAL=5
ARC_CLUSTER_REPLICATION_ENABLED=true
ARC_CLUSTER_QUERY_GATE_ON_CATCHUP=false
```

## Query Gating During Replication Catch-Up

In a [local-storage cluster](/arc-enterprise/configuration/deployment-patterns) with peer replication, a reader node may serve queries before its background puller has finished pulling all the Parquet files the cluster manifest references. Without gating, those queries silently return partial results: the manifest knows about the missing files, but `read_parquet()` globs against local storage and only finds what's already on disk. WAL replication (added in 26.05.1) closes part of this gap for unflushed writer data, but flushed Parquet files still depend on the asynchronous puller.

`cluster.query_gate_on_catchup` (added in 26.06.1, off by default) closes the remaining gap. When enabled, all user-facing read endpoints return `503 Service Unavailable` until peer file replication has fully converged on this node.

:::tip When to enable it
Turn this on if you'd rather a reader return 503 for a few seconds at startup than serve incomplete results. Leave it off if your application can tolerate eventual consistency during catch-up and you'd rather queries always succeed (the existing pre-26.06.1 behavior). Either choice is defensible; this is a correctness-vs-availability knob.
:::

### What "fully converged" means

The gate is scoped to the **startup catch-up batch only** — not to all pull activity on the node. This distinction matters: in a busy cluster, steady-state ingest constantly puts new files in flight, and a naive "wait for everything to settle" predicate would mean the reader returns 503 every few seconds in normal operation. The gate's job is *"the reader has finished bootstrapping its view of the manifest as of startup,"* not *"no pulls are happening anywhere right now."*

A node is considered ready when **all** of the following are true:

1. The startup catch-up walker has finished its pass over the manifest.
2. No paths the walker tagged are still in flight (`catchup_inflight == 0`). Steady-state pulls from reactive FSM callbacks are deliberately excluded.
3. No catch-up-batch pulls failed after retries (`catchup_failed == 0`).
4. No catch-up-batch pulls were dropped due to queue saturation (`catchup_dropped == 0`).

Failures and drops outside the catch-up window do **not** keep the gate red. They're operational concerns surfaced via puller stats but not correctness blockers — by the time the catch-up batch has settled, the reader has reconciled its view of the manifest as of walker start. Steady-state failures are handled by reactive FSM callbacks (which re-enqueue), the [Phase 5 reconciler](/arc-enterprise/configuration/clustering), and operator alerting via the cumulative `failed` / `dropped` counters.

If a catch-up-batch failure or drop happens, the gate stays red until the node restarts (re-runs catch-up) or a reactive FSM callback successfully re-enqueues the same path. Both `catchup_failed` and `catchup_dropped` are surfaced in the 503 body so operators see exactly what happened.

:::warning Combining with `replication_catchup_enabled=false`
If you set `cluster.replication_catchup_enabled=false` (the emergency off-switch for pathologically large manifests), the catch-up walker never runs and the gate would never clear. Arc detects this combination at startup, logs a `WARN`, and **auto-disables the gate** so the node isn't permanently 503'd. Operators see a clear log line and can fix the configuration at their leisure. Don't enable the gate if you've also disabled the walker.
:::

### Endpoints affected

When the gate is enabled and the node is still catching up, these endpoints return 503:

- `POST /api/v1/query`
- `POST /api/v1/query/arrow`
- `POST /api/v1/query/estimate`
- `GET /api/v1/query/:measurement`
- `GET /api/v1/measurements`

Internal endpoints (cache invalidation, cluster status, replication-control APIs) are deliberately **not** gated — peer nodes need them to fire during catch-up.

### 503 response shape

```json
{
  "success": false,
  "error": "replication_catch_up_in_progress",
  "message": "Reader is still catching up on replicated files. Retry shortly or check /api/v1/cluster for catch-up progress.",
  "catchup_status": {
    "started_at": 1714912800,
    "completed_at": 0,
    "entries_walked": 1287,
    "enqueued": 1287,
    "catchup_inflight": 2,
    "catchup_failed": 0,
    "catchup_dropped": 0,
    "queue_depth": 7,
    "inflight_count": 2,
    "pulled": 1278
  }
}
```

A `Retry-After: 5` header is also set so HTTP-aware load balancers and clients can back off automatically.

`completed_at = 0` means the catch-up walker is still enumerating; once it flips non-zero, watch `queue_depth + inflight_count` go to zero. Non-zero `failed` or `dropped` means the gate will not clear without a node restart or a follow-up FSM callback.

### Observability

- **Cumulative gate fires**: `QueryHandler.QueryGate503Total()` is exposed for Prometheus / metrics scrapes. Alert on a non-zero rate to detect that the gate is firing without inferring from generic HTTP error logs.
- **Sampled log line**: while the gate is active, Arc emits at most one `WARN` log per second with the gate counter and request path. Avoids flooding under sustained catch-up while still surfacing the degraded state.
- **Live status**: the `/api/v1/cluster` endpoint exposes `replication_catchup_status` with the same fields shown in the 503 body, so dashboards can show catch-up progress without waiting for a query to fail.

### Known limitation

There is a sub-millisecond window between the Raft FSM committing a `RegisterFile` entry and the puller's `Enqueue` callback firing. A query landing in that window can observe `ReplicationReady() == true` while a manifest entry from the same Raft commit is not yet in the in-flight set. Closing this gap requires a per-query Raft `LastApplied()` barrier on the query path, which is out of scope for this gate.

The gate's contract is *"every file the puller has observed has been pulled,"* not *"every file the manifest currently contains has been pulled."* In practice this means the gate may unblock a fraction of a second before the very last files committed before the gate-clear are queryable. This is a tracked follow-up.

### Pattern A vs. Pattern B

- **Shared object storage** (Pattern A): the puller is disabled (`replication_enabled = false`), so `query_gate_on_catchup` is effectively a no-op — readers see the bucket directly and don't need to catch up. Safe to leave the flag at any value.
- **Local storage with peer replication** (Pattern B): this is where the gate matters. Enable it on readers whose application cannot tolerate partial results during cold start or after a network partition.

## Deployment Example

A minimal 3-node cluster with one writer and two readers using Docker Compose:

```yaml
# docker-compose.yml
version: "3.8"

services:
  # Shared storage (MinIO as S3-compatible backend)
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    ports:
      - "9001:9001"

  # Writer node (primary)
  arc-writer:
    image: basekick/arc:latest
    environment:
      ARC_LICENSE_KEY: "ARC-XXXX-XXXX-XXXX-XXXX"
      ARC_STORAGE_BACKEND: minio
      ARC_STORAGE_S3_BUCKET: arc-data
      ARC_STORAGE_S3_ENDPOINT: minio:9000
      ARC_STORAGE_S3_ACCESS_KEY: minioadmin
      ARC_STORAGE_S3_SECRET_KEY: minioadmin123
      ARC_STORAGE_S3_USE_SSL: "false"
      ARC_STORAGE_S3_PATH_STYLE: "true"
      ARC_CLUSTER_ENABLED: "true"
      ARC_CLUSTER_NODE_ID: writer-01
      ARC_CLUSTER_ROLE: writer
      ARC_CLUSTER_CLUSTER_NAME: production
      ARC_CLUSTER_COORDINATOR_ADDR: ":9000"
      ARC_CLUSTER_REPLICATION_ENABLED: "true"
      ARC_AUTH_ENABLED: "true"
    ports:
      - "8000:8000"

  # Reader node 1
  arc-reader-1:
    image: basekick/arc:latest
    environment:
      ARC_LICENSE_KEY: "ARC-XXXX-XXXX-XXXX-XXXX"
      ARC_STORAGE_BACKEND: minio
      ARC_STORAGE_S3_BUCKET: arc-data
      ARC_STORAGE_S3_ENDPOINT: minio:9000
      ARC_STORAGE_S3_ACCESS_KEY: minioadmin
      ARC_STORAGE_S3_SECRET_KEY: minioadmin123
      ARC_STORAGE_S3_USE_SSL: "false"
      ARC_STORAGE_S3_PATH_STYLE: "true"
      ARC_CLUSTER_ENABLED: "true"
      ARC_CLUSTER_NODE_ID: reader-01
      ARC_CLUSTER_ROLE: reader
      ARC_CLUSTER_CLUSTER_NAME: production
      ARC_CLUSTER_SEEDS: arc-writer:9000
      ARC_AUTH_ENABLED: "true"
    ports:
      - "8001:8000"

  # Reader node 2
  arc-reader-2:
    image: basekick/arc:latest
    environment:
      ARC_LICENSE_KEY: "ARC-XXXX-XXXX-XXXX-XXXX"
      ARC_STORAGE_BACKEND: minio
      ARC_STORAGE_S3_BUCKET: arc-data
      ARC_STORAGE_S3_ENDPOINT: minio:9000
      ARC_STORAGE_S3_ACCESS_KEY: minioadmin
      ARC_STORAGE_S3_SECRET_KEY: minioadmin123
      ARC_STORAGE_S3_USE_SSL: "false"
      ARC_STORAGE_S3_PATH_STYLE: "true"
      ARC_CLUSTER_ENABLED: "true"
      ARC_CLUSTER_NODE_ID: reader-02
      ARC_CLUSTER_ROLE: reader
      ARC_CLUSTER_CLUSTER_NAME: production
      ARC_CLUSTER_SEEDS: arc-writer:9000
      ARC_AUTH_ENABLED: "true"
    ports:
      - "8002:8000"
```

## Writer Failover

Arc Enterprise provides automatic writer failover for high availability. If the primary writer becomes unhealthy, a standby writer is automatically promoted.

**Key characteristics:**

- **Recovery time**: Less than 30 seconds
- **Health-based detection**: Continuous health monitoring with configurable thresholds
- **Automatic promotion**: Standby writer promoted to primary without manual intervention
- **Cooldown protection**: Prevents rapid failover flapping

When the primary writer fails:

1. Health checks detect the failure
2. The cluster selects the healthiest standby writer
3. The standby is promoted to primary
4. Write traffic is automatically rerouted

:::tip Standby Writers
For high availability, deploy at least two writer nodes. The primary handles all writes while standby writers are ready for immediate promotion.
:::

## API Reference

All cluster endpoints require admin authentication.

### Get Cluster Status

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/cluster
```

**Response:**

```json
{
  "success": true,
  "data": {
    "cluster_name": "production",
    "node_count": 3,
    "healthy_nodes": 3,
    "roles": {
      "writer": 1,
      "reader": 2,
      "compactor": 0
    }
  }
}
```

### List Cluster Nodes

```bash
# All nodes
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/cluster/nodes

# Filter by role
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/cluster/nodes?role=reader"

# Filter by state
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/cluster/nodes?state=healthy"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "writer-01",
      "role": "writer",
      "state": "healthy",
      "address": "10.0.1.10:9000",
      "last_heartbeat": "2026-02-13T10:30:00Z"
    },
    {
      "id": "reader-01",
      "role": "reader",
      "state": "healthy",
      "address": "10.0.1.11:9000",
      "last_heartbeat": "2026-02-13T10:30:01Z"
    }
  ]
}
```

### Get Specific Node

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/cluster/nodes/writer-01
```

### Get Local Node Info

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/cluster/local
```

### Cluster Health Check

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/cluster/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "node_id": "writer-01",
    "role": "writer",
    "cluster_name": "production"
  }
}
```

## Best Practices

1. **Pick a deployment pattern** — Use [shared object storage](/arc-enterprise/deployment-patterns) (S3, MinIO, Azure) for cloud-native deployments, or [local storage with peer replication](/arc-enterprise/deployment-patterns) for bare metal, VMs, and edge. Don't mix the two in the same cluster.

2. **Deploy at least 2 writers** — For automatic failover, run one primary and one standby writer.

3. **Scale readers independently** — Add reader nodes to handle increased query load without affecting write performance.

4. **Use one dedicated compactor** — Run compaction on a single dedicated node to avoid duplicate outputs. Enable `ARC_CLUSTER_FAILOVER_ENABLED=true` for automatic compactor failover.

5. **Configure seed nodes** — Reader and compactor nodes should list writer nodes as seeds for cluster discovery.

6. **Always set a shared secret** — `ARC_CLUSTER_SHARED_SECRET` is required for peer authentication. Arc refuses to start replication without it.

7. **Monitor cluster health** — Use the `/api/v1/cluster/health` endpoint with your monitoring system (Prometheus, Grafana) to detect issues early.

## Next Steps

- [RBAC](/arc-enterprise/rbac) — Secure your cluster with role-based access control
- [Tiered Storage](/arc-enterprise/tiered-storage) — Optimize storage costs with hot/cold tiering
- [Audit Logging](/arc-enterprise/audit-logging) — Track all operations for compliance
