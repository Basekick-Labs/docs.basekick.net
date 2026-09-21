---
title: "Monitoring & Ops Playbook"
description: "Cluster, replication, tiering, governance and audit signals for Arc Enterprise, on top of the OSS metrics. Per-role expectations, failover signals, and the operational endpoints for inspecting and killing queries."
---

Arc Enterprise exposes everything in the [OSS monitoring playbook](/arc/operations/monitoring/) plus the cluster, replication, governance and query-management signals documented here.

<Callout type="info" title="Read the OSS page first">
Ingest, query, storage, buffer, WAL and compaction metrics are identical in both editions, as are `/health` and `/ready` semantics. This page covers only what Enterprise adds.
</Callout>

## Per-role expectations

A cluster runs three roles, and a metric that is healthy on one is a problem on another. Scrape all of them, but alert per role.

| Metric | Writer | Reader | Compactor |
|---|---|---|---|
| `arc_ingest_records_total` | Rising | **Flat** | **Flat** |
| `arc_query_requests_total` | Low | Rising | **Flat** |
| `arc_compaction_jobs_total` | Flat | Flat | Rising |
| `arc_buffer_records_buffered` | Meaningful | Near zero | Near zero |
| `arc_wal_*` | Meaningful | Recovery only | Near zero |

Ingest arriving at a reader, or queries served by a compactor, usually means a load balancer is routing to the wrong pool. The compactor cannot serve queries locally and forwards them.

## Cluster state

```
arc_cluster_manifest_rejected_paths_total  # counter: manifest entries refused
arc_cluster_auth_rejected_total            # counter: auth FSM commands refused
arc_cluster_rbac_rejected_total            # counter: RBAC FSM commands refused
arc_cluster_rbac_cascade_rejected_total    # counter: cascade limit exceeded
```

<Callout type="warn" title="Rejection counters are security canaries">
```text
increase(arc_cluster_manifest_rejected_paths_total[1h]) > 0
increase(arc_cluster_auth_rejected_total[1h]) > 0
increase(arc_cluster_rbac_rejected_total[1h]) > 0
```

These fire when a node proposes a Raft command the FSM refuses — a malformed path, an invalid auth mutation, an RBAC change that exceeds `cluster.rbac.max_cascade_descendants`. In a healthy cluster they stay at zero forever, so any movement is worth investigating rather than tuning.
</Callout>

The `arc_cluster_auth_apply_*` and `arc_cluster_rbac_apply_*` counters record applied FSM commands (create, update, delete, revoke, rotate, and the RBAC organization/team/role/permission operations). They are **per-node** and every healthy node converges to the same value, because all nodes apply the same Raft log.

<Callout type="idea" title="Divergence between nodes is the signal">
The absolute values matter less than their agreement. A node whose `arc_cluster_*_apply_*` counters lag the others is not applying the log — check it before trusting anything else it reports.

```text
max(arc_cluster_auth_apply_create_total) - min(arc_cluster_auth_apply_create_total) > 0
```
</Callout>

## Replication

```
arc_replication_entries_dropped_total   # counter: sender-side drops
```

```text
rate(arc_replication_entries_dropped_total[5m]) > 0
```

A sender drops entries when the replication buffer overflows — the receiver is not keeping up, or the link is saturated. Tune `cluster.replication_pull_workers` and the fetch/serve timeouts, and check reader health.

<Callout type="info" title="arc_replication_sequence_gaps_total was removed in v26.09.2">
This metric was exported but nothing detected gaps, so it read `0` regardless of whether entries went missing. It was removed rather than implemented, because the condition it claimed to measure cannot occur silently: the receiver checks checkpoint sequence equality and a cumulative payload hash, so a gap drops the connection instead of passing unnoticed. The counter could only ever report `0`, which reads as "no gaps" and is indistinguishable from "not measured". See [arc#810](https://github.com/Basekick-Labs/arc/issues/810).

Detect replication problems from `arc_replication_entries_dropped_total`, reader catch-up state in `GET /api/v1/cluster`, and 503s from readers with `cluster.query_gate_on_catchup` enabled.

Replication **lag** is the signal that is genuinely missing today — no lag metric is exported yet. Tracked in [arc#819](https://github.com/Basekick-Labs/arc/issues/819).
</Callout>

### Readers serving stale results

`cluster.query_gate_on_catchup` defaults to **`false`**. With it off, a reader that has not finished pulling replicated files answers queries anyway, silently returning **incomplete results**. With it on, the reader returns 503 until it has caught up.

<Callout type="warn" title="Enable the catch-up gate on any reader that serves correctness-sensitive queries">
Silent under-reporting is worse than a retryable error for most workloads. With the gate enabled, alert on readers stuck in 503:

```text
probe_success{job="arc-reader",path="/ready"} == 0 for 10m
```

Check catch-up progress at `GET /api/v1/cluster`.
</Callout>

## Query governance

```
arc_governance_rate_limited_total     # counter: queries rejected by rate limit
arc_governance_quota_exhausted_total  # counter: queries rejected by quota
arc_governance_queries_capped_total   # counter: results truncated at the row cap
arc_governance_policies_active        # gauge: policies currently loaded
```

```text
# Users are hitting limits
rate(arc_governance_rate_limited_total[5m]) > 0
rate(arc_governance_quota_exhausted_total[5m]) > 0
```

`arc_governance_queries_capped_total` is the subtle one: those queries **succeeded**, but returned truncated results. A client that does not check the `rows_capped` response field will silently under-report. Watch it when onboarding a new tenant, where an unexpectedly low cap looks like missing data rather than an error.

## Query management

Requires an Enterprise license with the `query_management` feature and `query_management.enabled = true`.

```
arc_query_mgmt_active_queries   # gauge: queries currently running
arc_query_mgmt_cancelled_total  # counter: queries killed via the API
arc_query_mgmt_history_size     # gauge: entries in the completed-query ring
```

<Callout type="warn" title="The two gauges only update when the list API is polled">
`arc_query_mgmt_active_queries` and `arc_query_mgmt_history_size` are refreshed as a side effect of `GET /api/v1/queries/active` and `/history`. There is no background sampler, so if nothing polls those endpoints the values are stale or zero regardless of what is actually running.

**Do not treat `arc_query_mgmt_active_queries` as a concurrency gauge in Prometheus.** Either poll the list endpoint on the same interval as your scrape, or use it only for ad-hoc inspection.
</Callout>

### Inspecting and killing queries

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/queries/active` | Running queries; SQL truncated to 200 chars |
| `GET /api/v1/queries/history` | Completed queries; `?limit=` default 50, max 1000 |
| `GET /api/v1/queries/:id` | One query, full SQL |
| `DELETE /api/v1/queries/:id` | Cancel a running query |

All require **admin auth** plus the license feature. `DELETE` returns 409 if the query has already finished, 404 if the ID is unknown.

```bash
curl -H "Authorization: Bearer $ARC_TOKEN" https://arc:8000/api/v1/queries/active
curl -X DELETE -H "Authorization: Bearer $ARC_TOKEN" https://arc:8000/api/v1/queries/abc123def456
```

## Tiering

Tiering moves aged files from hot to cold storage. There are no dedicated Prometheus counters; observe it through `/health`, the migration history in the metadata database, and storage-level counters.

<Callout type="error" title="Only daily-compacted files ever migrate to cold storage">
Tiering skips any file whose name does not end in `_daily.parquet`. Raw ingest files and hourly-compacted output stay on hot storage **indefinitely**.

If daily compaction is disabled, or never reaches its file threshold for a low-volume measurement, that measurement's data never tiers — and nothing reports it. You pay hot-storage prices forever with no error.

```text
# Daily compaction must actually be running
increase(arc_compaction_jobs_success_total[24h]) == 0
```

Also confirm the cold tier appears in `/health` under `storage`, alongside `hot`.
</Callout>

Cold-tier defaults are **S3 Glacier** and **Azure Archive**. Retrieval from those is measured in hours, not milliseconds — a query touching cold data is not slow, it is waiting on a restore. Size `tiered_storage.default_hot_max_age_days` (default 30) against your actual query patterns, not just storage cost.

## Audit logging

Enterprise deployments are the ones most likely to run `audit_log.enabled`. The counters are documented on the [OSS page](/arc/operations/monitoring/#audit-logging); the operational point bears repeating here:

```text
increase(arc_audit_events_dropped_total[5m]) > 0
```

Arc drops audit events when its fixed 1000-event queue is full. For a compliance deployment, a gap in the audit trail is a reportable event, so treat any non-zero value as an incident rather than a tuning signal.

## Cluster endpoints

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /api/v1/cluster` | Standard | Coordinator status, leader, catch-up progress, license tier |
| `GET /api/v1/cluster/nodes` | Standard | All nodes; `?role=` and `?state=` filters |
| `GET /api/v1/cluster/nodes/:id` | Standard | One node |
| `GET /api/v1/cluster/local` | Standard | This node's identity and role |
| `GET /api/v1/cluster/health` | Standard | Cluster-wide health |
| `GET /api/v1/cluster/files` | **Admin** | File manifest (exposes schema and paths) |
| `DELETE /api/v1/cluster/nodes/:id` | **Admin** | Remove a node — destructive |

Valid `?role=` values are `writer`, `reader`, `compactor`, `standalone`; valid `?state=` values are `healthy`, `unhealthy`, `dead`, `unknown`, `joining`, `leaving`. An invalid value returns 400 listing the valid set.

## Failover

`cluster.failover_enabled` defaults to `false` in the binary, though the Enterprise Helm chart sets it to `true`. When enabled, a writer that stops heartbeating is replaced after `cluster.failover_timeout` (default 30s), with a `cluster.failover_cooldown` (default 60s) before another can occur.

Watch for failover through node state transitions at `GET /api/v1/cluster/nodes`, and alert on a writer sitting in `unhealthy` or `dead`:

```text
probe_success{job="arc-writer",path="/ready"} == 0 for 2m
```

<Callout type="warn" title="Neither Helm chart ships a PodDisruptionBudget">
A three-writer cluster maintains Raft quorum with two nodes. Without a PDB, a node drain or a cluster upgrade can evict two writers at once and **stall the Raft log**.

Add a PDB with `minAvailable: 2` for the writer StatefulSet before running a node drain in production. The chart also rejects `writer.replicas: 2` outright, because a two-node Raft group has no failure tolerance.
</Callout>

## Deployment notes

**Coordinated restarts for wire-format changes.** Some releases change the coordinator or replication handshake. A rolling restart then leaves cross-version nodes marking each other unhealthy, which can trigger an unwanted failover. Check the release notes; when flagged, stop all nodes, upgrade every binary, then restart.

**Enable `server.storage_credentials_fail_ready` on reader pools.** It defaults to `false`, so expired storage credentials do not affect readiness and a reader keeps taking traffic while every query fails. See the [OSS page](/arc/operations/monitoring/#health-and-readiness).

**Match `server.shutdown_timeout` to your grace period.** It bounds the whole graceful shutdown; when it expires an unfinished buffer flush is abandoned. Writers with large buffers and slow object storage need more than the 30-second default, and `terminationGracePeriodSeconds` should match.

## Related

- [OSS Monitoring & Ops Playbook](/arc/operations/monitoring/)
- [Automated scheduling](/arc-enterprise/operations/automated-scheduling/)
- [Telemetry](/arc-enterprise/operations/telemetry/)
- [Profiling](/arc-enterprise/operations/profiling/)
