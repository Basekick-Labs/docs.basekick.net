---
title: "Monitoring & Ops Playbook"
description: "What to scrape, which signals actually matter, and which metrics are not yet wired. Prometheus endpoints, health probes, alert rules, and the traps that make a dashboard look healthy when it isn't."
---

Arc exposes operational metrics at `/metrics` in Prometheus text format, plus a set of JSON endpoints and a built-in time-series ring buffer for deployments without a Prometheus.

This page is the operator's reference: what to scrape, what to alert on, and the handful of metrics that are exported but not yet populated — so you do not build a dashboard on a signal that can never move.

<Callout type="warn" title="A few exported metrics are still always zero">
Four metrics are exported with HELP and TYPE strings that no code increments. They scrape as a permanent `0`, which looks identical to "healthy" on a graph. They are listed in [Metrics that are not wired yet](#metrics-that-are-not-wired-yet); everything else on this page is verified to move.
</Callout>

## Endpoints

| Endpoint | Format | Auth |
|---|---|---|
| `GET /metrics` | Prometheus text (default); JSON with `Accept: application/json` | **None** |
| `GET /api/v1/metrics` | JSON snapshot of every counter | **None** |
| `GET /api/v1/metrics/memory` | Go runtime and GC detail | **None** |
| `GET /api/v1/metrics/query-pool` | Query counters | **None** |
| `GET /api/v1/metrics/endpoints` | Counters grouped by subsystem | **None** |
| `GET /api/v1/metrics/timeseries/:type` | Historical ring buffer | **None** |
| `GET /health` | Liveness | **None** |
| `GET /ready` | Readiness | **None** |
| `GET /api/v1/logs` | Buffered application logs | **Admin** |

<Callout type="warn" title="The metrics endpoints are public by design">
`/metrics` and every `/api/v1/metrics*` path bypass authentication even when `auth.enabled = true`, because Prometheus scrapers expect an unauthenticated target. They expose aggregate counters, Go runtime stats, and host architecture — no queries, database or measurement names, file paths, or credentials.

If Arc is reachable beyond your cluster, restrict these paths at your ingress or proxy. `/api/v1/logs` is **not** public — it requires admin auth, because buffered log lines can contain operational detail.
</Callout>

### Scrape configuration

```yaml
scrape_configs:
  - job_name: arc
    metrics_path: /metrics
    static_configs:
      - targets: ['arc:8000']
```

Neither Helm chart ships a `ServiceMonitor` or `prometheus.io/*` annotations, so add scrape configuration yourself. For the Prometheus Operator:

```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8000"
  prometheus.io/path: "/metrics"
```

## The signals that matter

Start with these. Each one is verified to move in response to the condition it describes.

### Ingest throughput and errors

```
arc_ingest_records_total      # counter: records accepted
arc_ingest_bytes_total        # counter: bytes accepted
arc_ingest_batches_total      # counter: write requests turned into batches
arc_ingest_errors_total       # counter: rejected writes
```

```text
# Ingest rate, records/sec
rate(arc_ingest_records_total[5m])

# Ingest error rate
rate(arc_ingest_errors_total[5m])
```

Per-protocol breakdowns exist as `arc_msgpack_*` and `arc_lineprotocol_*` counters.

### Query latency and errors

```text
# p95 latency across all HTTP endpoints
histogram_quantile(0.95, rate(arc_http_latency_seconds_bucket[5m]))

# Error rate across every endpoint, including writes and health checks
rate(arc_http_requests_error_total[5m]) / rate(arc_http_requests_total[5m])
```

There is no `arc_query_latency_*` histogram; query latency is available only as a lifetime average from `GET /api/v1/metrics`. Use the HTTP histogram above for percentiles.

For a query-specific error rate, use the query counters:

```text
rate(arc_query_errors_total[5m]) / rate(arc_query_requests_total[5m])
```

All four query entry points — `/api/v1/query`, `/api/v1/query/msgpack`, `/api/v1/query/:measurement` and `/api/v1/query/arrow` — count requests consistently, so `success + errors` equals `requests`.

<Callout type="info" title="Available since v26.09.2">
Before v26.09.2 the Arrow endpoint counted its failures but not its requests or successes, so this expression could exceed 1 — or divide by zero — on an Arrow-heavy workload, and Arrow throughput was invisible. On an earlier version, use `arc_http_requests_error_total / arc_http_requests_total`, which moves for both query paths at the cost of aggregating every endpoint.
</Callout>

`arc_query_timeouts_total` and `arc_slow_queries_total` are wired on both paths and are safe to alert on. `arc_slow_queries_total` only moves when `query.slow_query_threshold_ms` is set (it defaults to `0`, disabled).

### Storage

```
arc_storage_writes_total       # counter
arc_storage_write_bytes_total  # counter
arc_storage_reads_total        # counter
arc_storage_read_bytes_total   # counter
arc_storage_errors_total       # counter — all backends
```

All four counters are wired on every backend: local filesystem, S3, and Azure.

```text
rate(arc_storage_errors_total[5m]) > 0
```

<Callout type="info" title="Cancelled requests are not counted as storage errors">
`arc_storage_errors_total` deliberately skips failures where the request context was already cancelled or past its deadline, so a client that disconnects mid-read does not register as a storage fault.

One consequence is worth knowing: if a flush's own context expires *while* the backend is still retrying, the failure is attributed to the cancellation and this counter does not move — but `arc_buffer_flush_failures_total` does. When you need the single most reliable "data did not reach storage" signal, use `arc_buffer_flush_failures_total`.
</Callout>

### Buffer and flush health

This is where ingest backpressure shows up: records Arc has accepted but not yet written to storage.

```
arc_buffer_records_buffered       # gauge: records accepted, not yet written
arc_buffer_queue_depth            # gauge: flush tasks waiting for a worker
arc_buffer_flushes_total          # counter: completed flushes
arc_buffer_records_written_total  # counter: records written by flushes
arc_buffer_flush_failures_total   # counter: flushes that did not reach storage
```

`arc_buffer_flush_failures_total` is the most important single alert in an OSS deployment. Every increment means a batch of records did not reach storage and is being held in the WAL for recovery.

```text
# Data is not reaching storage
increase(arc_buffer_flush_failures_total[5m]) > 0

# Backlog is growing: records are arriving faster than they flush
arc_buffer_records_buffered > 500000
```

`arc_buffer_records_buffered` is sampled once per second rather than published on flush, so it reflects the live backlog rather than the post-flush state. A steadily climbing value means storage writes are not keeping up with ingest; a sawtooth that returns to near zero is normal.

<Callout type="info" title="Available since v26.09.2">
These metrics were exported but never populated before v26.09.2, reading a permanent `0`. On an earlier version, infer flush pressure from ingest rate versus `rate(arc_storage_writes_total[5m])` and from flush failures instead.
</Callout>

### WAL

All six WAL metrics are wired. This is the best-instrumented subsystem in Arc.

```
arc_wal_records_preserved_total   # records that fell back to WAL instead of flushing
arc_wal_dropped_entries_total     # WAL buffer full — data loss risk
arc_wal_failed_writes_total       # WAL write I/O failures
arc_wal_oversized_payloads_total  # payload exceeded WAL limits
arc_wal_recovery_total            # recovery runs
arc_wal_recovery_records_total    # records replayed
```

```text
# Data is being dropped before it reaches the WAL
rate(arc_wal_dropped_entries_total[5m]) > 0
```

A rising `arc_wal_records_preserved_total` means flushes are failing or the flush queue is full, and records are surviving only because the WAL is on. If `wal.enabled` is `false`, those records are simply lost.

### Compaction

```
arc_compaction_jobs_total
arc_compaction_jobs_success_total
arc_compaction_jobs_failed_total
arc_compaction_manifests_recovered_total
```

```text
rate(arc_compaction_jobs_failed_total[1h]) > 0
```

Sustained compaction failure degrades query performance as small files accumulate, and on Enterprise it silently blocks tiering — only `_daily.parquet` files migrate to cold storage.

<Callout type="info" title="Compaction volume counters are JSON-only">
`compaction_files_compacted`, `compaction_bytes_read` and `compaction_bytes_written` are populated but are **not** emitted to Prometheus. Read them from `GET /api/v1/metrics` instead.
</Callout>

### Memory and runtime

```
arc_memory_alloc_bytes
arc_memory_heap_alloc_bytes
arc_memory_sys_bytes
arc_goroutines
arc_gc_cycles_total
```

`arc_memory_sys_bytes` is the figure to compare against a container limit. Note that Go returns memory to the OS lazily, so RSS lags real usage.

<Callout type="warn" title="Set database.memory_limit explicitly">
The default is computed from CPU count, not from actual system memory: Arc assumes 2 GB per core and takes half, capped at 32 GB. On a 4-core, 32 GB machine it defaults to 4 GB and leaves most of your RAM unused.

Always set `database.memory_limit` (or `ARC_DATABASE_MEMORY_LIMIT`) to match the machine.
</Callout>

## Health and readiness

The two probes answer different questions and are not interchangeable.

| | `/health` | `/ready` |
|---|---|---|
| Purpose | Liveness | Readiness |
| Returns 503? | **Never** | Yes, in two cases |
| Use for | `livenessProbe` | `readinessProbe`, load balancer |

`/health` **always returns 200**, deliberately, even when storage credentials have expired. The reasoning: restarting a pod does not fix expired credentials, it just loops the node through restarts and hides the problem. The response body still carries the detail:

```json
{
  "status": "ok",
  "storage": { "hot": { "backend": "s3", "credentials": "static", "state": "ok" } },
  "uptime_sec": 3600.5
}
```

Alert on `storage.*.state` from the body, not on the HTTP status.

`/ready` returns 503 in exactly two cases:

1. The node is starting up (before WAL recovery completes) or shutting down.
2. Storage credentials are **expired** *and* `server.storage_credentials_fail_ready` is `true`.

<Callout type="warn" title="Enable storage_credentials_fail_ready on reader pools">
That key defaults to `false`, which means expired credentials have no effect on readiness: the node keeps taking traffic while every storage-backed query fails.

This is not hypothetical. A reader once served a green `/health` for roughly 21 hours while every S3 query failed. Set it to `true` wherever a load balancer should drain a node whose credentials have lapsed.
</Callout>

## Alerts worth paging on

Every rule below uses a metric verified to move. Thresholds are starting points — tune them to your workload.

| Alert | Expression | Why |
|---|---|---|
| Buffer flush failing | `increase(arc_buffer_flush_failures_total[5m]) > 0` | Records are not reaching storage. The highest-value alert in OSS. |
| Ingest errors | `rate(arc_ingest_errors_total[5m]) > 0` | Writes are being rejected. |
| WAL entries dropped | `rate(arc_wal_dropped_entries_total[5m]) > 0` | WAL buffer full; data can be lost. |
| WAL write failures | `rate(arc_wal_failed_writes_total[5m]) > 0` | The durability net itself is failing. |
| Query error rate | `rate(arc_query_errors_total[5m]) / rate(arc_query_requests_total[5m]) > 0.05` | Queries are failing. Covers every query endpoint. |
| Ingest backlog growing | `arc_buffer_records_buffered > 500000` | Storage writes are not keeping up with ingest. |
| Audit events dropped | `increase(arc_audit_events_dropped_total[5m]) > 0` | Audit trail has gaps. Only relevant with `audit_log.enabled`. |
| Query timeouts | `rate(arc_query_timeouts_total[5m]) > 0` | Queries exceeding `query.timeout`. |
| Compaction failing | `rate(arc_compaction_jobs_failed_total[1h]) > 0` | File count grows; tiering stalls. |
| Memory near limit | `arc_memory_sys_bytes > 0.85 * <container limit>` | OOM-kill risk. |
| Node not ready | `probe /ready != 200 for 5m` | Startup stuck or credentials expired. |

## Audit logging

When audit logging is enabled (`audit_log.enabled`), three counters cover it:

```
arc_audit_events_total          # counter: events committed to the audit table
arc_audit_write_errors_total    # counter: events that failed to persist
arc_audit_events_dropped_total  # counter: events discarded before queueing
```

<Callout type="warn" title="Alert on dropped audit events if you run audit for compliance">
```text
increase(arc_audit_events_dropped_total[5m]) > 0
```

Arc queues audit events and writes them in batches. When that queue is full it drops the event and logs a warning — the event never reaches the writer, which is why it is counted separately from write errors.

The queue is a fixed 1000 events with no configuration key, so a sustained non-zero value means events are arriving faster than they can be written and needs investigation rather than tuning. Write errors are counted **by batch**: a failed transaction loses every event in it.
</Callout>

<Callout type="info" title="Available since v26.09.2">
Both audit counters existed but were never populated before v26.09.2, and `arc_audit_events_dropped_total` did not exist at all. On an earlier version, alert on the `Audit event channel full` log line instead.
</Callout>

## Metrics that are not wired yet

These are exported with HELP and TYPE strings but **never incremented**. They read `0` forever — do not build panels or alerts on them. Tracked collectively under [arc#802](https://github.com/Basekick-Labs/arc/issues/802).

| Metric | Use instead | Tracking |
|---|---|---|
| `arc_db_connections_open` | No equivalent today | [arc#809](https://github.com/Basekick-Labs/arc/issues/809) |
| `arc_db_connections_in_use` | No equivalent today | [arc#809](https://github.com/Basekick-Labs/arc/issues/809) |
| `arc_db_queries_total` | `arc_query_requests_total` | [arc#809](https://github.com/Basekick-Labs/arc/issues/809) |
| `arc_replication_sequence_gaps_total` | `arc_replication_entries_dropped_total` covers sender-side drops only | [arc#810](https://github.com/Basekick-Labs/arc/issues/810) |
| `arc_decomp_buffer_discards_total` | No equivalent today | [arc#817](https://github.com/Basekick-Labs/arc/issues/817) |

One metric is wired everywhere but has a deliberate exclusion:

| Metric | Nuance |
|---|---|
| `arc_storage_errors_total` | Counted on every backend, but not when the request context was already cancelled or expired — so a client disconnect is not reported as a storage fault. A flush whose context expires during a backend retry therefore does not increment it, while `arc_buffer_flush_failures_total` does. |

## Without Prometheus

For air-gapped or edge deployments, Arc keeps its own in-memory history — no external system required.

```bash
curl 'http://arc:8000/api/v1/metrics/timeseries/application?duration_minutes=30'
```

Valid types are **`system`**, **`application`**, and **`api`** only; anything else returns 400 with the valid list. `duration_minutes` accepts 1–1440 and defaults to 30.

Retention is governed by `metrics.timeseries_retention_minutes` (default 30) and `metrics.timeseries_interval_seconds` (default 5), giving 360 sample points.

<Callout type="warn" title="These are raw counters, not rates">
Each sample holds cumulative counter values; compute deltas yourself. The `*_latency_avg_us` fields are **lifetime** averages rather than windowed, so they flatten over time and will not reveal a latency spike.
</Callout>

## Operational traps

Things that make a dashboard look healthy when it is not.

**A query for a measurement that does not exist is not an error.** It returns HTTP 200 with `success: true` and zero rows, because Arc resolves measurements as a path glob at read time. No error counter moves. A dashboard that silently goes empty may be a typo in a measurement name, not an outage.

**`/api/v1/metrics/query-pool` has two similar error fields.** `query_errors` is the API-level count (real); `query_errors_total` maps to a DuckDB connection-level counter that is never incremented. Pick the wrong one and the panel reads zero forever. The endpoint's `connections_*` and `queries_total` fields are also still zero ([arc#809](https://github.com/Basekick-Labs/arc/issues/809)) — prefer `/metrics` over this endpoint.

**`/api/v1/metrics/endpoints` has no per-route breakdown** despite the name. It groups counters by subsystem.

**Daily compaction and retention share a cron slot.** Both default to `0 3 * * *`, so they contend for I/O at 03:00. Stagger one if that window is tight.

**HTTP write timeout is silently raised at startup.** If `query.timeout` (default 300s) exceeds `server.write_timeout` (default 30s), Arc raises `write_timeout` to match and logs a warning — so the effective value is not the configured one. Setting `query.timeout = 0` disables that sync and leaves long queries to be cut off at 30s.

**WAL is off by default in the binary.** `wal.enabled` defaults to `false` for backwards compatibility, and a crash without it loses everything buffered since the last flush. Every shipped Docker Compose file and both Helm charts now enable it, but a hand-written config or manifest must set `ARC_WAL_ENABLED=true` explicitly. Confirm with `arc_wal_recovery_total` — a node that has never recovered and never written a WAL file is a node running without one.

**Raise `server.shutdown_timeout` if your storage is slow.** It bounds the whole graceful shutdown: when it expires, a buffer flush that has not finished is abandoned. Match it to `terminationGracePeriodSeconds` in Kubernetes rather than leaving both at 30s if flushes to your object store can take longer.

## Probe configuration

What the Helm charts ship:

```yaml
startupProbe:
  httpGet: { path: /health, port: http }
  periodSeconds: 10
  failureThreshold: 30      # 5 minutes for WAL recovery

livenessProbe:
  httpGet: { path: /health, port: http }
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet: { path: /ready, port: http }
  initialDelaySeconds: 5
  periodSeconds: 5
```

The `startupProbe` matters: WAL replay happens before the HTTP listener binds, so without a startup gate a slow recovery looks like a liveness failure and the pod crash-loops.

<Callout type="warn" title="The raw manifests in deploy/kubernetes/ have no startupProbe">
They configure only liveness and readiness. Prefer the Helm charts, or add a `startupProbe` before running a node with a large WAL.
</Callout>

## Related

- [Backup & Restore](/arc/operations/backup-restore/)
- [Telemetry](/arc/operations/telemetry/)
- [Profiling](/arc/operations/profiling/)
- [Data model](/arc/guides/data-model/)
