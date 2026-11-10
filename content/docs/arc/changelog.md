---
title: "Changelog"
description: "Release history for Arc: features, fixes, and behaviour changes per version, from the current release back through the 26.x series, with upgrade notes where they apply."
---

Release history for Arc.

## 26.09.4

Released: November 2026

Patch release on 26.09.3. Compaction no longer deletes rows that differ only in their field values, the Linux packages run on older glibc again, the RPMs are signed, continuous queries are enabled in the packaged configuration, and a crafted zstd request can no longer crash Arc.

### Breaking changes

- **A re-sent point no longer replaces the old one** -- Compaction now removes a row only when another row is identical in every column (time, every tag and every field). A point re-sent with the same tags and time and a new value is stored alongside the old one, and queries count both. Exact duplicates, such as a retried write, are still collapsed.
- **Continuous queries turn on after an upgrade** -- The packages replace `/etc/arc/arc.toml`, which now sets `[continuous_query] enabled = true`. To keep them off, set it back to `false` or set `ARC_CONTINUOUS_QUERY_ENABLED=false`.
- **Linux needs glibc 2.34 or newer** -- Ubuntu 20.04 and RHEL 8 are not supported. 26.09.3 needed 2.38, so no system that ran 26.09.3 loses support.

### Bug fixes

- **Compaction deleted rows that differed only in field values** -- Up to 26.09.3, compaction kept one row per (tags, time) and deleted the rest, dropping corrections, partial writes and re-run continuous-query windows. Rows that 26.09.3 already deleted cannot be recovered by this release. In a cluster, upgrade the compactor node, and the writers too when `cluster.failover_enabled` is on.
- **Linux packages failed on Debian 12, Ubuntu 22.04, RHEL 9 and Amazon Linux 2023** -- The binaries are now built on Ubuntu 22.04 with libstdc++ linked in, and need only glibc 2.34 or newer. Supported: Ubuntu 22.04+, Debian 12+, RHEL/Rocky/Alma 9+, Amazon Linux 2023 and Fedora 35+, on amd64 and arm64.
- **Continuous queries disabled in packaged configuration** -- The `arc.toml` shipped in the `.deb`, RPM, Arch package and Docker image set `enabled = false`, so every continuous-query API call answered 404 on a fresh install.

### Packaging

- **Signed RPMs** -- The `arc` and `arc-fips` RPMs are signed with the Basekick Labs package key (fingerprint `3E39 9CF8 F5D2 EF9A A9A5 36EF 7629 7AF0 8CBA B6FE`), so Fedora 45's rpm 6.1 accepts them. Import `RPM-GPG-KEY-basekick` from the release once with `rpm --import`.

### Security

- **Crafted zstd request crash** -- A crafted zstd request body could crash Arc through `klauspost/compress` ([GHSA-fpmh-frq8-7rj8](https://github.com/advisories/GHSA-fpmh-frq8-7rj8)). Fixed by `klauspost/compress` 1.20.4.
- **Go 1.26.10 and dependency updates** -- Fixes in `net/http`, `net/textproto`, `crypto/tls`, `crypto/x509` and `html/template`, plus `golang.org/x/net` 0.60.0 and `andybalholm/brotli` 1.2.7.

Full release notes: [RELEASE_NOTES_2026.09.4.md](https://github.com/Basekick-Labs/arc/blob/v26.09.4/RELEASE_NOTES_2026.09.4.md)

---

## 26.09.3

Released: October 2026

Correctness and security release: four security advisories in RBAC and query authorization, fixes for several paths where acknowledged writes could be lost or duplicated in the WAL and ingest flush, and container-aware DuckDB memory and thread defaults. Several behaviour changes need review before upgrading.

### Breaking changes

- **RBAC enforcement now takes effect (Enterprise)** -- A token with team memberships is now restricted to its grants, a write-only or permissionless token can no longer list databases or measurements, a token scoped to specific databases receives `403` from `GET /api/v1/databases`, and a leading-wildcard grant pattern such as `*suffix` now matches. Review grants before upgrading.
- **Compaction and retention read endpoints require admin** -- `GET /api/v1/compaction/{status,stats,candidates,jobs,history}` and `GET /api/v1/retention{,/:id,/:id/executions}` no longer accept a non-admin token.
- **DuckDB memory and thread defaults** -- `database.memory_limit` now defaults to empty and `database.thread_count` to `0`, leaving DuckDB's own cgroup-aware values (80% of detected memory). Without a container memory limit this can raise DuckDB's limit; set `database.memory_limit` explicitly if you relied on the old cap.
- **Sample `arc.toml` no longer ships MinIO cold-tier values** -- If you enabled the cold tier and relied on the shipped MinIO values, uncomment that block as a set. An empty environment variable does not blank a key the config file sets.
- **Continuous query validation** -- `PUT /api/v1/continuous_queries` now requires a complete definition, `database` and both measurement names are validated on create and update, and a stored definition that fails validation reports a failed run, readable through `GET /api/v1/continuous_queries/:id/executions`.

### New features

#### Per-peer replication lag gauges (Enterprise)

The writer exposes `arc_replication_lag_entries` and `arc_replication_lag_seconds` per connected WAL replication reader, labelled by `peer`. Pair a `seconds` alert with `arc_replication_lag_entries >= <cluster.replication_buffer_size>` or `rate(arc_replication_entries_dropped_total[5m]) > 0`.

Documentation: [Clustering](/arc-enterprise/configuration/clustering/)

#### Backup and ingest visibility

Backup manifests name up to 32 skipped files in `skipped_sample` and count overlong keys in `skipped_overlong_keys`, and the new `arc_backup_skipped_files` gauge reports the latest backup's skipped count. Deferred flushes are reported by `arc_ingest_flush_deferred_total` and `arc_buffer_deferred_buffers`.

Documentation: [Backup and restore](/arc/operations/backup-restore/)

### Bug fixes

- **WAL purge no longer deletes undurable data** -- Rotated WAL files carrying tracked entries are reclaimed only below a flush floor instead of by age; watch `pending_unflushed` in the WAL stats.
- **WAL recovery no longer replays flushed data** -- Checkpoints written after each Parquet flush stop permanent duplicates for measurements without tags, and replay is now idempotent.
- **Acknowledged writes no longer lost under flush backpressure or shutdown** -- A full flush queue retains the batch and drains it as workers free up, the flush timeout starts when a worker picks the task up, and `Close` flushes queued work instead of discarding it.
- **`key=value` directories no longer overwrite column values** -- Every Parquet read now disables Hive partition inference; the release notes include a check for affected deployments.
- **Container-aware compaction threads** -- `compaction.threads` now derives from the container's CPU quota instead of the host core count.
- **Cluster tier metadata follows each node's disk (Enterprise)** -- Replicated and removed files are recorded in the node's tier metadata, and a background tier scan runs at startup, so reads no longer silently omit local data.
- **Cluster replication fixes (Enterprise)** -- Snapshot rejoins remove deleted replicas, compaction batches apply atomically to the Raft manifest, graceful shutdown registers final Parquet files, and a stale peer no longer blocks replication or deletes the local copy.
- **Query rewriting** -- Comma cross-joins (`FROM a, b`) now resolve every measurement, and multi-line SQL with a newline before a table function's parenthesis works.
- **Input validation** -- `POST /api/v1/delete` WHERE fragments go through the shared table-position guard, and edge-sync spoke IDs and sync-path segments containing DuckDB glob metacharacters or `=` are rejected.
- **Other fixes** -- Line-protocol WAL entries carry their database, audit events no longer alias request buffers, compaction dedup row counts are now correct, and an overlong source key no longer fails every backup.

### Security

- **RBAC restrictions were unreachable (GHSA-mcqm-h7hj-99fg) (Enterprise)** -- RBAC denials now stand, enforcement no longer depends on the license, and the database listing routes now require authorization.
- **Query authorization gaps (GHSA-qcf2-6hm7-62c5, GHSA-9rgq-j585-5fhq, GHSA-h3rq-5r29-2wrh)** -- `GET /api/v1/query/:measurement` authorizes every table reference in the assembled statement including its `where` fragment, the replacement-scan guard now covers the relation-introducing keywords DuckDB has beyond `FROM` and `JOIN`, and RBAC extraction now agrees with the query rewriter.

Full release notes: [RELEASE_NOTES_2026.09.3.md](https://github.com/Basekick-Labs/arc/blob/v26.09.3/RELEASE_NOTES_2026.09.3.md)

---

## 26.09.2

Released: October 2026

Correctness and hardening release: experimental file-level time pruning, a write-pool readiness check, per-database compaction exclusion and a stable field schema per measurement, plus security fixes on the read-SQL path and a large set of cluster, retention, backup and Iceberg fixes. Clustered deployments need a coordinated restart to upgrade.

### Breaking changes

- **Coordinated restart for clusters (Enterprise)** -- The coordinator and replicate-sync handshake wire formats changed: stop all cluster nodes, upgrade the binary on every node, then restart all nodes. A rolling restart causes cross-version nodes to mark each other unhealthy and can trigger an automatic writer failover.
- **Retention with an S3 prefix will delete a backlog** -- With `storage.s3_prefix` set, retention has deleted nothing since v26.03.2, so the first run of each policy after upgrading removes everything already past its cutoff. Check each policy first with `POST /api/v1/retention/:id/execute` and `{"dry_run": true}`.
- **Invalid `storage.s3_prefix` stops startup** -- A prefix containing `..`, a space or any character outside `[A-Za-z0-9/._-]` previously fell back to the bucket root and now refuses to boot.
- **Stricter cluster startup checks (Enterprise)** -- A clustered node with an unrecognised `cluster.role` exits (accepted: `standalone`, `writer`, `reader`, `compactor`), as does a node with `cluster.raft_bootstrap=true` on a role that does not accept writes.
- **Helm chart: MinIO replaced by SeaweedFS** -- The `minio:` values block is renamed `seaweedfs:` and the schema rejects any `minio.*` key. Data on an existing bundled-MinIO volume is not migrated; sync the bucket first or point `storage.shared.external=true` at the old store.
- **Malformed names are refused** -- Retention policies with an empty or separator-containing database or measurement are rejected, `PUT /api/v1/retention/:id` without `database` returns 400, MQTT subscriptions with an unusable database or topic-mapping target fail at startup, and edge-sync spoke IDs containing `:` or `..`, longer than 128 bytes, or with leading or trailing whitespace are refused.
- **Shutdown exit code** -- A shutdown that cannot flush every buffer now exits with code 1 and logs `Retaining WAL files`; the data stays in the WAL and replays on the next start.
- **Query time zone pinned to UTC** -- On non-UTC hosts, naive timestamp literals are now UTC and continuous queries with daily or weekly buckets align to UTC midnight.
- **Removed metrics and keys** -- `arc_replication_sequence_gaps_total`, `arc_decomp_buffer_discards_total`, `arc_db_queries_total` and `arc_db_query_errors_total` are removed. The cold-tier keys `tiered_storage.cold.s3_storage_class`, `tiered_storage.cold.azure_access_tier` and `tiered_storage.cold.retrieval_mode` never did anything and are gone; configs that set them still load.

### New features

#### File-level time pruning (experimental)

`query.file_time_pruning` (default `false`) and `query.file_time_pruning_margin_seconds` (default `300`) let Arc drop files in the current, not-yet-compacted hour whose flush timestamp proves they cannot hold rows in range. Local storage backend only. Measured 340ms to 29ms over a 7,893-file live hour.

Documentation: [Configuration](/arc/configuration/overview/)

#### Write-pool readiness check

`GET /ready/write` returns 200 on a node that accepts ingest and 503 otherwise, so a load balancer's write pool can avoid nodes that would only proxy writes onward. `/ready` is unchanged.

#### Exclude databases from scheduled compaction

`compaction.exclude_databases` (or `ARC_COMPACTION_EXCLUDE_DATABASES`) lists databases that scheduled cycles skip; `POST /api/v1/compaction/trigger?database=X` bypasses the list. The compaction cycle deadline is now configurable with `compaction.cycle_timeout` (default `30m`).

Documentation: [Compaction](/arc/advanced/compaction/)

#### Stable field schema

Each measurement now has a registered field schema stored at `_schema/{database}/{measurement}.parquet`, so a field missing from the files in a time range binds as a typed NULL instead of raising a Binder Error. `GET /api/v1/databases/{db}/measurements/{m}/schema` returns the fields; `query.stable_schema = false` restores the previous behaviour.

Documentation: [Stable field schema](/arc/guides/field-schema/)

#### Cluster membership and role controls (Enterprise)

New admin endpoints: `DELETE /api/v1/cluster/files` (removes a manifest entry, requires `confirm=true`), `POST /api/v1/cluster/voters/converge`, `POST /api/v1/cluster/compactor/assign` and `POST /api/v1/cluster/writers/{id}/demote`. `GET /api/v1/cluster` now reports `raft.membership` and `active_compactor`, and the Helm chart now deploys three writers by default.

### Security

- **Read-SQL gate and validator hardening** -- Closes read-path bypasses on RBAC-enabled multi-tenant deployments, which should upgrade; RBAC table-reference deduplication now preserves case, and `PREPARE` and `EXECUTE` are rejected.
- **Authenticated coordinator handshake (Enterprise)** -- Every field of every handshake message is covered by its HMAC in both directions, with replay protection; replicate-sync also authenticates `SupportsBinaryEntries`.
- **Expired API tokens rejected on cache hits** -- A token that expired while cached no longer authorizes requests until the cache entry ages out.
- **Dependency bumps** -- Apache Thrift 0.23.0 to 0.24.0 and gRPC-Go 1.83.1 to 1.83.2.

### Bug fixes

- **Graceful shutdown could delete an unflushed WAL** -- The purge now runs after the buffer flush and only when it succeeded; `server.shutdown_timeout` is now honoured instead of a hardcoded 30 seconds.
- **Primary writer election (Enterprise)** -- Clusters with `cluster.failover_enabled=true` on local storage never elected a primary, so retention and continuous queries never ran; Arc now elects a primary on any local-storage cluster with Raft.
- **Raft voting and compactor lease (Enterprise)** -- Readers and compactors join as non-voters, the compactor lease moves to a healthy dedicated compactor, and the Helm chart's compactor pod now joins the cluster.
- **Tiering** -- On shared-storage and replicating per-node clusters, migration now runs only on the primary writer while every node syncs cold metadata, tiered files leave the cluster manifest, and a measurement whose files had all moved to cold no longer returns nothing to a query without a time range.
- **Truncated results are signalled** -- JSON responses carry `truncated` and `truncation_reason`, a cut-short Arrow IPC stream fails to decode, and a governance row cap (Enterprise) is marked with `rows_capped`, `row_cap` or the `Arc-Rows-Capped` trailer.
- **Query governance on every endpoint (Enterprise)** -- Limits now apply to `GET /api/v1/query/:measurement`, `POST /api/v1/query/arrow` and `POST /api/v1/query/estimate`, not only `POST /api/v1/query`.
- **Streaming panics** -- A panic while streaming a response no longer crashes the server or leaks a database connection.
- **Partition pruning** -- DuckDB-native `INTERVAL 300 SECOND` syntax now prunes, pruning works again with `storage.s3_prefix` set, and tiered queries prune per tier.
- **Backup and restore** -- A restore that could not restore every data file now ends `failed`, a restore no longer serves compacted rows twice, and live SQLite databases are snapshotted and restored on the next start.
- **Iceberg export** -- Fixes for deleted rows after a partial delete, compacted files registered next to their sources, and snapshot expiry reported as failure; the exporter no longer deletes Arc's data files.
- **Metrics** -- Buffer, audit, MQTT and DuckDB pool metrics are now populated, including the new `arc_audit_events_dropped_total`, and `POST /api/v1/query/arrow` counts its requests.
- **WAL and ingest** -- Oversized ingest requests are split across WAL entries instead of bypassing the WAL, and the OSS Helm chart now enables the WAL.
- **JSON DECIMAL values** -- `POST /api/v1/query` returns DECIMAL results as numbers rather than quoted strings.

### Upgrade notes

- **WAL crash-recovery replay is at-least-once** -- Not new, but now documented: after a hard crash, already-flushed WAL entries are re-ingested; tagged duplicates are removed at the next compaction, tagless ones persist.

Full release notes: [RELEASE_NOTES_2026.09.2.md](https://github.com/Basekick-Labs/arc/blob/v26.09.2/RELEASE_NOTES_2026.09.2.md)

---

## 26.09.1

Released: August 2026

Adds opt-in Apache Iceberg export, manual edge-to-cloud sync, and faster msgpack ingest, along with WAL recovery fixes, storage credential refresh for S3 and Azure, and a set of security hardening changes.

### Breaking changes

- **Coordinated restart for clusters (Enterprise)** -- the Raft transport now requires an authenticated handshake, so a node on this version will not form consensus with an older one; stop all cluster nodes, upgrade every binary, then restart all nodes.
- **Insertion order no longer preserved by default** -- `database.preserve_insertion_order` now defaults to `false`, so queries without an explicit `ORDER BY` may return rows in any order; add `ORDER BY time` or set the key to `true` for the old behaviour.
- **Builds without `duckdb_arrow` refuse to start** -- shipped artifacts already set the tag; only a bare `go build ./cmd/arc` is affected.
- **Removed fields** -- `target_size_mb` is gone from the `tiers[]` entries of `GET /api/v1/compaction/stats`, and MQTT subscriptions no longer accept or return `reconnect_min_seconds`.

### New features

#### Apache Iceberg export

Arc can publish its existing Parquet files as Iceberg tables by reference, with no data copied or rewritten, so Spark, Trino, DuckDB, Snowflake and PyIceberg can query them directly. Enable with `iceberg.enabled = true`; it requires a local storage backend and Arc refuses to start with both Iceberg export and cold-tier tiering enabled.

Documentation: [Apache Iceberg](/arc/integrations/apache-iceberg/)

#### Edge-to-cloud sync (manual)

Ships immutable Parquet files from an edge spoke to a central hub, either over the network (`edge_sync`, `edge_sync.spoke`) or as signed air-gap bundles on removable media (`edge_sync.spoke.bundle`, `edge_sync.import`). The hub verifies each file's SHA256 before committing it; every step is operator-triggered in this release and all of it is off by default.

Documentation: [Edge sync](/arc/advanced/edge-sync/)

#### Faster msgpack ingest

Parquet dictionary encoding at ingest is now off by default (`ingest.use_dictionary = false`), and msgpack columnar payloads decode directly into typed column arrays. Sustained ingest on the IOT benchmark moved from 20.6M to 34.0M records/sec, with no wire-format change.

#### Compaction resource bounds and batch size

New `compaction.memory_limit` and `compaction.threads` bound each compaction subprocess; by default memory derives as `database.memory_limit / max_concurrent` and threads as half the CPU cores. `compaction.max_files_per_batch` (default 30, valid range 2 to 500) makes the batch size configurable.

Documentation: [Compaction](/arc/advanced/compaction/)

#### Compressed query responses and stable msgpack endpoint

`/api/v1/query` and `/api/v1/query/msgpack` compress responses when the client sends `Accept-Encoding` (zstd or gzip). `/api/v1/query/arrow` adds opt-in `x-arc-arrow-dictionary` and `x-arc-arrow-compression` request headers; without them responses are byte-identical to before. `/api/v1/query/msgpack` also graduates out of experimental, with decimal columns sent as numbers and a frozen `types` vocabulary.

#### Storage credential state in `/health`

`/health` now reports a `storage` field with credential state per tier, and `server.storage_credentials_fail_ready = true` (default `false`) makes `/ready` return 503 while any tier's credentials are `expired`.

Documentation: [Monitoring](/arc/operations/monitoring/)

#### Arch Linux package

Each release now ships a pacman package (`.pkg.tar.zst`) for `x86_64` and `aarch64`, alongside the existing `.deb` and `.rpm`.

### Bug fixes

- **WAL recovery** -- startup recovery no longer cleans up the active WAL file, and replayed data now gets the same timestamp normalisation and UTF-8 sanitisation as live ingest; recommended for anyone running `wal.enabled = true`.
- **S3 and Azure query credentials** -- Arc now refreshes S3 credentials (IRSA, EC2 instance roles, EKS Pod Identity) and Azure managed-identity tokens itself, so queries no longer fail about an hour after startup.
- **Outer joins** -- `LEFT`, `RIGHT`, `FULL OUTER` and other join modifiers were rewritten to inner joins and silently dropped rows; the operator is now kept verbatim.
- **Quoted identifiers** -- `SELECT * FROM "my-db".cpu` now resolves to the right storage path instead of returning zero rows.
- **Continuous query duplicates** -- CQs that select no `time` column now stamp the window start, and a new optional `tag_columns` field lets compaction collapse duplicate windows.
- **License-server outages (Enterprise)** -- boot retries with backoff and falls back to a cached signed license instead of crash-looping; `license.file_path` adds offline license files.
- **Compaction** -- partitions without a `time` column are skipped, a single-file remainder is folded into the last batch, and subprocesses no longer drop `storage.s3_prefix`.
- **Backup and restore** -- concurrent requests now return `409 Conflict`, and backup streams files through a temp file instead of loading them into memory.
- **Ingest and WAL sync** -- columns that are entirely null in a batch are no longer dropped, and `wal.sync_mode = fdatasync` now performs a real `fdatasync` on Linux.
- **API status codes** -- RBAC and MQTT endpoints return `400` or `409` for client errors instead of `500`.

### Security

- **Replacement-scan RBAC bypass** -- a single-quoted string in table position is now rejected, closing a cross-database read on RBAC-enabled instances.
- **Partition-pruner amplification** -- path generation is capped, the start date is floored at the epoch, and generation is cancelled on client disconnect.
- **Authenticated Raft transport (Enterprise)** -- Raft peer connections now use a mutual HMAC handshake with `cluster.shared_secret`.
- **Forwarding headers in clusters** -- client-supplied forwarding and identity headers are stripped when a clustered node forwards a request, and a spoofed `X-Arc-Forwarded-By` now returns `508 Loop Detected`.
- **Secret statements** -- `CREATE SECRET` and `DROP SECRET` are rejected in user SQL.

### Dependencies

- **DuckDB 1.5.1 to 1.5.5** -- Parquet decompression hardening and a `TemporaryMemoryManager` deadlock fix.
- **gRPC-Go to v1.83.1** -- moves past GHSA-hrxh-6v49-42gf; the vulnerable paths were not reachable in Arc.

Full release notes: [RELEASE_NOTES_2026.09.1.md](https://github.com/Basekick-Labs/arc/blob/v26.09.1/RELEASE_NOTES_2026.09.1.md)

---

## 26.06.3

Released: July 2026

Patch release with a database-routing fix for heavy concurrent ingest and a Homebrew tap for macOS. No breaking API changes and no schema migrations.

### New features

#### Homebrew tap for macOS

Arc ships a native Apple Silicon macOS binary (`arc-darwin-arm64`), cosign-signed like the other release binaries, and installs with `brew install basekick-labs/tap/arc`. The formula installs the standard (non-FIPS) build.

### Bug fixes

- **Database routing under heavy concurrent writes** -- Under sustained concurrent ingest, a write could occasionally be stored under a different database, its name shortened to the length of the intended one. Arc now copies the database and measurement names at the request boundary. It affected the MessagePack, line-protocol, TLE and bulk-import write paths; reads and queries were never affected. Rows stored under an unexpected database by an earlier version are intact Parquet and can be re-ingested.

Full release notes: [RELEASE_NOTES_2026.06.3.md](https://github.com/Basekick-Labs/arc/blob/v26.06.3/RELEASE_NOTES_2026.06.3.md)

---

## 26.06.2

Released: June 2026

Patch release with bug fixes and hardening: no breaking API changes and no schema migrations. It tightens authorization on query and database-management endpoints, completes the CVE-2026-47735 fix, adds signed release artifacts and an optional FIPS 140-3 build, and fixes CSV/Parquet imports and several compaction wedges.

### Upgrade notes

- **Clustering requires a shared secret (Enterprise)** -- A node with `cluster.enabled = true` and no `cluster.shared_secret` now refuses to start; set `ARC_CLUSTER_SHARED_SECRET` before upgrading, and upgrade all cluster nodes in one window, since join, leave and heartbeat HMAC validation fails across versions during the roll.
- **Query routes require `read` permission** -- `/api/v1/query`, `/query/msgpack`, `/query/estimate`, `/measurements`, `/query/:measurement` and the Arrow IPC endpoint no longer accept write-only tokens.
- **Database management requires admin** -- `POST /api/v1/databases` and `DELETE /api/v1/databases/:name` now require an admin token; auto-create-on-write is unaffected.
- **CSV/Parquet import behaviour** -- Parquet `DECIMAL` columns are imported as `DOUBLE`, and malformed files now fail with a `400` instead of partially succeeding.
- **FIPS cutover** -- Tokens created by a non-FIPS build are bcrypt hashes that the FIPS build refuses to verify; rotate existing API tokens when moving to `arc-fips`.

### Supply-chain hardening

- **Signed release artifacts** -- Every release now ships SPDX and CycloneDX SBOMs, a Trivy report for the container image, cosign signatures for binaries and images, and SLSA Level 3 provenance for the release binaries.
- **FIPS 140-3 build variant** -- The optional `arc-fips` build is the same source and version compiled against the CMVP-certified Go Cryptographic Module v1.0.0 in FIPS-only mode; Arc itself is not a CMVP-listed module. See [FIPS](/arc/configuration/fips/).

### Security

- **`GET /api/v1/logs` requires an admin token** -- It was reachable without a token when authentication was enabled; the JSON metrics endpoints under `/api/v1/metrics` remain public by design.
- **Filesystem-I/O functions blocked in user SQL** -- The validator now rejects `parquet_scan()`, `glob`, `read_csv`, `read_json*` and related path-taking table functions in any query position, completing the CVE-2026-47735 fix.
- **RBAC on estimate and measurements** -- `POST /api/v1/query/estimate` and `GET /api/v1/measurements` now enforce table-level RBAC read checks, and multi-statement queries are rejected on all query endpoints.
- **S3 credentials no longer readable via SQL** -- S3 credentials move from global DuckDB settings to scope-bound secrets (`arc_s3_primary`, `arc_s3_cold`); S3 and Azure gain AWS/Azure credential-chain support when no static key is configured.
- **Auth database permissions** -- The token/RBAC SQLite database and its `-wal`/`-shm` files are now locked to `0600`.
- **RBAC-only tokens** -- `POST /api/v1/auth/tokens` with `"permissions": []` now creates a token with no platform permissions instead of defaulting to `read,write`.

### Bug fixes

- **Primary S3 via credential chain** -- Query reads on S3/MinIO primary storage with no static keys (for example IRSA on EKS) now authenticate instead of failing.
- **Compaction wedges** -- Mixed-type `time` columns and wide, many-file dedup partitions no longer block compaction; a `time` column sent as a string or containing nulls is now rejected at ingest.
- **CSV and Parquet imports** -- `POST /api/v1/import/csv` and `/api/v1/import/parquet` now parse in-process and work against the shipped DuckDB version; fractional epoch time columns are accepted.
- **Pre-1970 timestamps** -- Pre-epoch rows now partition into the hour that contains them.
- **WAL reliability** -- Header reads use `io.ReadFull`, and write failures trigger rotation and increment `arc_wal_failed_writes_total`.
- **Tiered storage (Enterprise)** -- Policy lookups cache not-found results, and `tier_migrations` history is cleaned up after `[tiered_storage].migration_history_retention_days` (default 90).

### Performance

- **Compaction cleanup and ingest flush** -- Compaction cleanup uses S3 and Azure batch-delete APIs (up to 1000x fewer DELETE calls on S3, 256x on Azure), and ingest flush replaces its time sort with a radix sort.

Full release notes: [RELEASE_NOTES_2026.06.2.md](https://github.com/Basekick-Labs/arc/blob/v26.06.2/RELEASE_NOTES_2026.06.2.md)

---

## 26.06.1

Released: May 2026

Security-focused release that sandboxes DuckDB file access, moves pprof off the public API port, and adds HMAC authentication to cluster-internal traffic. It also adds Enterprise token and RBAC replication, shared-storage multi-writer clusters, and a set of query, memory, and S3 fixes.

### Breaking changes

- **pprof moved off the API port** -- `/debug/pprof/*` now returns 404 on the API port; set `ARC_DEBUG_PPROF=1` and reach it on `127.0.0.1:6060` (override with `ARC_DEBUG_PPROF_ADDR`; a non-loopback bind also needs `ARC_DEBUG_PPROF_ALLOW_NON_LOOPBACK=1`). `/metrics` is unchanged.
- **Cluster HMAC wire format changed (Enterprise)** -- Leader-forward, peer-fetch, and join HMACs switch to a NUL-delimited format, so 26.05.x and 26.06.1 nodes cannot validate each other; the recommended procedure is to stop all nodes, upgrade every binary, and restart.
- **`cluster.shared_secret` required for WAL replication (Enterprise)** -- Writers refuse replication handshakes when the secret is empty, and rolling upgrades are not supported for this change; stage the same secret on every node before a full cluster restart.
- **Pre-26.06.1 API tokens stay node-local (Enterprise)** -- Tokens created before the upgrade remain valid only on the node that created them; re-issue them through the replicated path.
- **Pre-26.06.1 RBAC child rows can be cascade-deleted (Enterprise)** -- Teams, roles, measurement permissions, and token memberships under an organization realigned by the upgrade seed are deleted on the leader; a startup `Warn` lists the counts to re-issue.
- **Import uploads moved** -- Multipart uploads now land in `${database.temp_directory}/arc-uploads` instead of `os.TempDir()`.

Documentation: [Upgrading pre-26.06.1 API tokens](/arc-enterprise/operations/legacy-token-upgrade/)

### New features

#### Docker Hub images

Release images are now published to Docker Hub as `basekicklabs/arc` alongside GitHub Container Registry, multi-arch for `linux/amd64` and `linux/arm64`.

#### Server bind address

New `server.host` setting (env `ARC_SERVER_HOST`) restricts the HTTP listener to a specific address. The default empty value keeps the previous dual-stack wildcard bind.

#### Columnar MessagePack query endpoint (experimental)

`POST /api/v1/query/msgpack` returns query results as columnar MessagePack. It requires the `duckdb_arrow` build tag, buffers the full result in memory, and may change or be removed.

#### Token and RBAC replication (Enterprise)

API token and RBAC writes now go through Raft, so creates and revocations apply on every node instead of only the node that received them. `cluster.rbac.max_cascade_descendants` (default 50000) refuses oversized organization or team deletes with HTTP 409.

Documentation: [RBAC](/arc-enterprise/security/rbac/)

#### Shared-storage multi-writer (Enterprise)

`cluster.shared_storage_mode = true` lets multiple writer nodes accept writes against one S3, Azure Blob, or MinIO backend. Singleton tasks gate on the Raft leader, and `/ready` returns 503 during startup and graceful shutdown.

#### Query gating during replication catch-up (Enterprise)

`cluster.query_gate_on_catchup` (default `false`) makes read endpoints return 503 with `Retry-After: 5` until a reader's startup catch-up has finished.

Documentation: [Clustering](/arc-enterprise/configuration/clustering/)

### Performance

- **Line Protocol parsing** -- The tokenizer uses sub-slice indexing, measured at +12.9% end-to-end ingest throughput.

### Bug fixes

- **`FROM` inside function calls** -- `EXTRACT(YEAR FROM time)`, `SUBSTRING`, `TRIM`, and `OVERLAY` no longer have the column rewritten as a measurement.
- **Orphaned DuckDB spill files** -- New `database.temp_directory` (default `./.tmp`) pins DuckDB's spill location, and leftover `duckdb_temp_storage_*.tmp` files are removed at startup.
- **Memory growth** -- Partition pruner caches are swept every 30 seconds, and S3 retention/delete runs now release native memory after the cache is cleared.
- **Client disconnects** -- Streaming queries stop when the client disconnects, counted by `arc_query_client_disconnects_total`.
- **Arrow IPC timing** -- `/api/v1/query/arrow` sends an `Arc-Execution-Time-Ms` response trailer.
- **S3 compatibility** -- `s3_endpoint` values with an `http(s)://` prefix now work with DuckDB, and DELETE rewrites succeed on plain-HTTP S3 such as MinIO.
- **MQTT disabled responses** -- With MQTT disabled, the stats and subscription endpoints return 503 instead of panicking or returning 404, and `/api/v1/mqtt/health` returns 200 with `"status": "disabled"`.
- **Inter-node TLS (Enterprise)** -- Cache-invalidate fan-out and leader forwarding now use HTTPS when `server.tls_enabled` is true.

### Security

- **DuckDB I/O sandbox** -- Closes arbitrary local file reads by any authenticated caller through DuckDB I/O functions such as `read_csv_auto` and `read_text`; at startup Arc sets `allowed_directories` to its own storage, temp, and upload paths and disables external access.
- **Absolute storage paths** -- `storage.local_path`, `database.temp_directory`, and `compaction.temp_directory` are resolved to absolute paths for the sandbox allowlist; the defaults keep working and the resolved paths appear in the startup log.
- **Anchored public-prefix matching** -- The auth middleware now normalises the request path and requires an exact or true-subdirectory match for public prefixes.
- **Cache-invalidate endpoint authenticated (Enterprise)** -- `/api/v1/internal/cache/invalidate` now requires HMAC-SHA256 keyed by `cluster.shared_secret` instead of a static header, and is not registered when the secret is unset.
- **Cluster manifest path validation (Enterprise)** -- The Raft FSM rejects manifest paths with URL schemes, absolute paths, `..` segments, NUL bytes, or more than 4096 bytes.
- **Replication stream authenticated (Enterprise)** -- WAL replication adds a handshake HMAC, per-entry MAC tags, and periodic full-HMAC checkpoints. Two pre-existing handshake and idle-disconnect bugs were fixed alongside, making WAL replication work end-to-end.

Documentation: [Cluster security](/arc-enterprise/security/cluster-security/)

Full release notes: [RELEASE_NOTES_2026.06.1.md](https://github.com/Basekick-Labs/arc/blob/v26.06.1/RELEASE_NOTES_2026.06.1.md)

---

## 26.05.1

Released: May 2026

Cluster-focused release: Arc Enterprise gains peer file replication for local-storage clusters, a dedicated compactor role with failover, cluster TLS and shared-secret joins, and a Helm chart. Ingestion and query paths were hardened, and write endpoints now enforce write-tier auth.

### Upgrade notes

- **Write endpoints require write-tier auth** -- Ingestion endpoints now use `auth.RequireWrite`, so a read-only token can no longer write; bulk-import endpoints and the line-protocol global flush endpoint require `auth.RequireAdmin`.
- **Stricter query API validation** -- The query API now also rejects `ATTACH/DETACH/COPY/EXPORT DATABASE/IMPORT DATABASE/PRAGMA/SET/RESET/LOAD/INSTALL/CALL`, direct `read_parquet(` calls in user SQL, and `x-arc-database` header values outside `[a-zA-Z_][a-zA-Z0-9_-]*`.
- **`?p=` authentication deprecated** -- Token authentication via the `?p=` query parameter (InfluxDB 1.x compatibility) still works but logs a one-time warning; migrate clients to the `Authorization: Bearer <token>` header.
- **Directory permissions** -- New sensitive-data directories are created `0700`, but existing directories keep their current permissions; run `chmod 700` on your data directory if desired.

### New features

#### Peer file replication (Enterprise)

Cluster nodes replicate Parquet files from peers to their own local storage, with SHA-256 verification against a Raft-backed manifest, startup catch-up, and resumable transfers, so clusters can run without shared object storage. Reader nodes also apply replicated WAL entries to their in-memory buffer, making unflushed writer data queryable on readers. Replication is off by default; enable with `replication_enabled` (requires `shared_secret`).

Documentation: [Clustering](/arc-enterprise/configuration/clustering/)

#### Dedicated compactor role with automatic failover (Enterprise)

Set `ARC_CLUSTER_ROLE=compactor` on one node so compaction runs on exactly one node in a cluster. With `cluster.failover_enabled=true`, the Raft leader reassigns the compactor after ~30s of unresponsiveness. Nodes that miss 3 consecutive heartbeats (~15s) are marked unhealthy.

#### Cluster TLS and shared secret authentication (Enterprise)

`cluster.shared_secret` adds HMAC-SHA256-signed join requests, and `cluster.tls_enabled` wraps all inter-node TCP connections, including Raft, in TLS, with optional mutual TLS via `cluster.tls_ca_file`. Both are opt-in.

#### Kubernetes deployment (Enterprise)

A Helm chart ships in `helm/arc-enterprise/`, covering shared object storage and local storage with peer replication through a single `storage.mode` value. When `cluster.node_id` is unset, Arc uses the hostname as the node ID so StatefulSet pods keep their identity across reschedules, and `DELETE /api/v1/cluster/nodes/:id` removes a dead node from Raft.

#### Manifest-vs-storage reconciliation (Enterprise)

A periodic reconciler detects orphan manifest entries and orphan storage files. It is off by default (`reconciliation.enabled`) and dry-run until `manifest_only_dry_run=false`; status is available at `GET /api/v1/reconciliation/status`.

### Bug fixes

- **Writer-only schedulers in clusters (Enterprise)** -- Retention and CQ schedulers no longer skip every tick when `cluster.failover_enabled=false`; retention, CQs and `POST /api/v1/delete` now run only on the primary writer, with deletions propagated through the Raft manifest.
- **Memory after delete and retention** -- Delete and retention now clear DuckDB's caches after running, so memory returns to baseline instead of growing by GBs per run.
- **Low-volume flush starvation** -- Low-volume measurements now flush within `max_buffer_age_ms` even alongside high-throughput measurements.
- **Partial query failures surfaced** -- A failed partition now fails the request with HTTP 500 instead of returning partial results, and truncated streams are recorded as errors.
- **Ingest concurrency** -- Fixed a shutdown panic in `ArrowBuffer.Close()` and schema-evolution corruption under concurrent writes; sustained schema churn now returns HTTP 503 on LP and TLE.
- **WAL filename collision** -- WAL filenames now use nanosecond precision so two rotations in the same second no longer corrupt the WAL.
- **CQ scheduling and query registry** -- Continuous queries created via the API are scheduled without a restart, and the query registry now records row counts, failures and timeouts for Arrow-path queries.
- **Ingest observability** -- New counters `arc_buffer_flush_failures_total`, `total_wal_errors`, `total_wal_dropped` and `total_schema_churn_exceeded`; WAL backpressure is no longer reported as success.

### Security

- **Decompression bombs** -- Gzip bodies on the Line Protocol and TLE handlers and zstd bodies on all three write handlers are now capped at 100 MB during decoding, and the shared decompression helper applies the same cap to uncompressed bodies. The Line Protocol and TLE endpoints now also accept `Content-Encoding: zstd`.

### Dependencies

- **DuckDB 1.4.4 → 1.5.1**
- **AWS SDK v2** -- DNS timeout errors are retried automatically, improving S3 reliability

Full release notes: [RELEASE_NOTES_2026.05.1.md](https://github.com/Basekick-Labs/arc/blob/v26.05.1/RELEASE_NOTES_2026.05.1.md)

---

## 26.04.1

Released: April 2026

Major performance release with DuckDB native Arrow query path (+59% JSON, +157% Arrow IPC throughput), automatic compaction deduplication, native Decimal128 type support, and 10 bug fixes.

### New features

#### Native Decimal128 type support

Per-measurement configuration for exact decimal precision — financial data, scientific measurements, and cryptocurrency prices are stored as native Parquet DECIMAL type instead of float64. Supports float64, int64, and string input with up to 38 significant digits. DuckDB reads DECIMAL natively with no query changes.

Documentation: [Decimal Precision](/arc/guides/decimal-precision/)

#### DuckDB native Arrow query path

Query results bypass `database/sql` row-by-row scanning entirely using DuckDB's native Arrow API. JSON queries are 59% faster (2.28M rows/sec), Arrow IPC queries are 157% faster (6.29M rows/sec).

#### Automatic compaction deduplication

Compaction now automatically deduplicates rows with identical tag values and timestamps (last-write-wins). Tag columns are auto-detected from Parquet metadata — zero configuration required.

#### WAL dropped entries metric

WAL buffer drops exposed as Prometheus counter (`arc_wal_dropped_entries_total`). Buffer size now configurable via `ARC_WAL_BUFFER_SIZE`.

#### Slow query logging

Configurable slow query detection with WARN-level logging and Prometheus counter (`arc_slow_queries_total`). Covers all query paths.

#### S3 path prefix support

`ARC_STORAGE_S3_PREFIX` enables shared-bucket multi-tenant deployments with path-based isolation.

### Performance

- **Typed JSON streaming** -- 2.3x faster serialization, constant memory usage regardless of result set size
- **Basekick-Labs/msgpack v6** -- 8.6% higher sustained throughput, 13% flatter degradation curve under GC pressure
- **Bulk UTF-8 pre-validation** -- Single-pass payload validation on Line Protocol path (58-84 GB/s on arm64)

### Bug fixes

- **CQ scheduler reload on update** -- Updated continuous query definitions now take effect immediately without restart
- **Atomic CQ execution recording** -- SQLite transaction wraps execution recording and time window update
- **Database delete batch fallback** -- Falls back to individual file deletion when S3/Azure batch delete fails
- **S3 delete file rewrite streaming** -- Streams temp file to S3 instead of loading into memory (prevents OOM)
- **CQ scheduler graceful shutdown** -- Cancels in-flight queries on stop instead of waiting for 10-minute timeout
- **Compactor subprocess signal handling** -- Responds to SIGTERM/SIGINT for prompt cancellation
- **Streaming backup restore** -- Streams Parquet files through temp file instead of loading into memory
- **Local storage optimizations** -- WriteReader directory cache, context-aware file listing, batch delete error reporting
- **Token expiration display fix** -- Non-expiring tokens correctly display as "Never expires" instead of "Expired"

### Security

- **Admin authorization on mutating endpoints** -- `RequireAdmin` middleware on CQ, delete, retention, compaction, and scheduler endpoints
- **Hardened delete WHERE clause** -- Expanded forbidden keyword list blocks `UNION`, `SELECT`, `CREATE`, `COPY`, `ATTACH`, `LOAD`, `PRAGMA`, `CALL`, `SET`
- **Temp directory permissions** -- Changed from `0755` to `0700` (owner-only)

### Dependencies

- **DuckDB 1.4.3 → 1.4.4** -- Parquet UTF-8 tolerance, Arrow string view pushdown fix, `mode()` use-after-free fix, secret secure clear
- **gRPC 1.79.1 → 1.79.3** -- Authorization bypass fix for malformed `:path` headers
- **Arrow Go v18.4.1 → v18.5.2** -- Large string Parquet writes fix, decompression regression fix, reduced GC pressure

---

## 26.03.1

Released: March 2026

Major quality release with backup/restore, 14 bug fixes, security hardening, and Go 1.26 upgrade.

### New features

#### Backup & restore API

Full backup and restore system via REST API. Backups capture parquet data files, SQLite metadata (auth, audit, MQTT config), and the `arc.toml` configuration file. Async operations with real-time progress tracking and selective restore.

Documentation: [Backup & Restore](/arc/operations/backup-restore/)

### Bug fixes

- **Null handling in LP ingestion** -- Missing fields were stored as `0` instead of `NULL`. Introduced `TypedColumnBatch` with validity bitmaps throughout the ingestion pipeline.
- **Stale cache after compaction** -- Queries failed with 404 after compaction deleted old S3 parquet files. Added post-compaction cache invalidation for DuckDB caches and partition pruner. Extended to enterprise clustering with cross-node broadcast.
- **Descriptive query error messages** -- All query endpoints now return actual DuckDB errors instead of generic "Query execution failed".
- **time_bucket / date_trunc bucketing** -- GROUP BY queries returned one row per second instead of proper buckets. Fixed DuckDB float division (`/`) to integer division (`//`).
- **WAL recovery after flush failure** -- Recovery replayed already-flushed data causing duplication. Added `PurgeOlderThan` before recovery to limit replay window.
- **Self-adjusting flush timer** -- Replaced fixed-period ticker with adaptive timer. Worst-case flush delay drops from ~1.5x to ~1.0x of `max_buffer_age_ms`.
- **MQTT CleanSession default** -- Changed from `true` to `false` to preserve at-least-once delivery across reconnects.
- **Delete API partial failure** -- Now returns HTTP 207 with `failed_files` list instead of `success: true` when some files fail.
- **Replication observability** -- Added Prometheus metrics for dropped entries and sequence gaps.
- **Orphaned hot file cleanup** -- Reconciliation pass after tiering migration detects and removes orphaned hot copies.
- **Compaction manifest cleanup** -- Fixed three related bugs that could leave orphaned input files alongside compacted output.
- **Unified cache_httpfs TTLs** -- Metadata/file handle TTLs now match `s3_cache_ttl_seconds`. Glob TTL fixed at 10s.

### Security

- **Database name validation** -- Added `isValidDatabaseName()` to LP write, CSV/Parquet import, and MsgPack handlers to prevent path traversal.
- **Backup restore permissions** -- Files now written with `0600` instead of `0644`.

### Performance

- **Pooled gzip** -- CSV, Parquet, and TLE import endpoints now use pooled klauspost gzip (3-5x faster decompression).
- **Single-pass LP unescape** -- Byte scanner replaces three sequential `ReplaceAll` calls in the ingestion hot path.
- **Single-pass SQL regex** -- 7 separate regex passes consolidated into one alternation pattern.

### Infrastructure

- **Go 1.26** -- 10-40% GC overhead reduction (Green Tea GC), 30% faster cgo calls (DuckDB/SQLite), 2x faster `io.ReadAll`.

---

## 26.02.1

Released: February 2026

Major feature release adding MQTT integration, TLE satellite data ingestion, and bulk import endpoints for CSV, Parquet, and Line Protocol files.

### New features

#### MQTT integration

Native MQTT subscriber with API-driven subscription management. Connect to IoT devices, industrial sensors, and message brokers without middleware.

- Dynamic subscription management via REST API (create, update, delete, start/stop)
- Multiple simultaneous brokers with topic wildcards
- Auto-detection of JSON and MessagePack message formats
- ~6M records/sec with MessagePack columnar format
- TLS/SSL support with encrypted credentials at rest (AES-256-GCM)
- QoS 0, 1, and 2

Documentation: [MQTT Integration](/arc/integrations/mqtt/)

#### TLE (satellite orbital data) ingestion

Native support for ingesting satellite orbital data in the standard Two-Line Element format used by Space-Track.org, CelesTrak, and ground station pipelines.

- **Streaming ingestion** (`POST /api/v1/write/tle`) for continuous feeds and cron jobs
- **Bulk import** (`POST /api/v1/import/tle`) for historical backfill
- Pure Go parser with both 2-line and 3-line format support
- Derived orbital metrics (semi-major axis, period, apogee, perigee, orbit classification)
- ~3.5M records/sec via typed columnar fast path

Documentation: [TLE Integration](/arc/integrations/tle/)

#### Bulk import endpoints

New REST API endpoints for importing data from files:

| Endpoint | Format | Description |
|----------|--------|-------------|
| `POST /api/v1/import/csv` | CSV | Import CSV/TSV files with configurable delimiter, time column, and skip rows |
| `POST /api/v1/import/parquet` | Parquet | Import Parquet files directly (DuckDB native read) |
| `POST /api/v1/import/lp` | Line Protocol | Import InfluxDB LP exports with precision support |

All import endpoints support:
- Gzip auto-detection via magic bytes
- RBAC write permission checks
- 500 MB size limit
- Hourly data partitioning

Documentation: [CSV Import](/arc/data-import/csv/) | [Parquet Import](/arc/data-import/parquet/) | [Line Protocol Import](/arc/data-import/line-protocol/)

### Breaking changes

None

---

## 26.01.2

Released: January 2026

Bugfix release addressing Azure Blob Storage backend issues and authentication configuration.

### Bug fixes

#### Azure Blob Storage backend

- **Fix queries failing with Azure backend** - Queries were incorrectly using local filesystem paths (`./data/...`) instead of Azure blob paths (`azure://...`) when using Azure Blob Storage as the storage backend.
- **Fix compaction subprocess Azure authentication** - Compaction subprocess was failing with "DefaultAzureCredential: failed to acquire token" because credentials weren't being passed to the subprocess. Now passes `AZURE_STORAGE_KEY` via environment variable.

#### Configuration

- **Authentication enabled by default** - `auth.enabled` is now `true` by default in arc.toml for improved security out of the box.

### Upgrade notes

If you were relying on authentication being disabled by default, you'll need to explicitly set `auth.enabled = false` in your arc.toml.

---

## 26.01.1

Released: January 2026

### New features

#### Official Python SDK

The official Python SDK for Arc is now available on PyPI as `arc-tsdb-client`.

```bash
pip install arc-tsdb-client

# With DataFrame support
pip install arc-tsdb-client[pandas]   # pandas
pip install arc-tsdb-client[polars]   # polars
pip install arc-tsdb-client[all]      # all optional dependencies
```

**Key features:**
- High-performance MessagePack columnar ingestion (10M+ records/sec)
- Query support with JSON, Arrow IPC, pandas, polars, and PyArrow responses
- Full async API with httpx
- Buffered writes with automatic batching (size and time thresholds)
- Complete management API (retention policies, continuous queries, delete operations, authentication)

Documentation: [Python SDK](/arc/sdks/python/)

#### Azure Blob Storage backend

Arc now supports Azure Blob Storage as a storage backend, enabling deployment on Microsoft Azure infrastructure.

**Configuration:**
```toml
[storage]
backend = "azure"
azure_container = "arc-data"
azure_account_name = "mystorageaccount"
azure_use_managed_identity = true
```

**Authentication options:**
- Connection string
- Account key
- SAS token
- Managed Identity (recommended for Azure deployments)

#### Native TLS/SSL support

Arc now supports native HTTPS/TLS without requiring a reverse proxy.

**Configuration:**
```toml
[server]
port = 443
tls_enabled = true
tls_cert_file = "/etc/letsencrypt/live/example.com/fullchain.pem"
tls_key_file = "/etc/letsencrypt/live/example.com/privkey.pem"
```

**Environment variables:** `ARC_SERVER_TLS_ENABLED`, `ARC_SERVER_TLS_CERT_FILE`, `ARC_SERVER_TLS_KEY_FILE`

#### Configurable ingestion concurrency

Ingestion concurrency settings are now configurable for high-concurrency deployments.

**Configuration:**
```toml
[ingest]
flush_workers = 32        # Async flush worker pool size
flush_queue_size = 200    # Pending flush queue capacity
shard_count = 64          # Buffer shards for lock distribution
```

Defaults scale dynamically with CPU cores.

#### Data-time partitioning

Parquet files are now organized by the data's timestamp instead of ingestion time, enabling proper backfill of historical data.

**Key features:**
- Historical data lands in correct time-based partitions
- Batches spanning multiple hours are automatically split into separate files
- Data is sorted by timestamp within each Parquet file
- Enables accurate partition pruning for time-range queries

Documentation: [Data-Time Partitioning](/arc/advanced/data-time-partitioning/)

*Contributed by [@schotime](https://github.com/schotime)*

#### Compaction API triggers

Hourly and daily compaction can now be triggered manually via API.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/compaction/hourly` | Trigger hourly compaction |
| `POST` | `/api/v1/compaction/daily` | Trigger daily compaction |

**Configuration:**
```toml
[compaction]
hourly_schedule = "0 * * * *"   # Every hour
daily_schedule = "0 2 * * *"    # Daily at 2 AM
```

*Contributed by [@schotime](https://github.com/schotime)*

#### Configurable max payload size

The maximum request payload size is now configurable, with the default increased from 100MB to 1GB.

```toml
[server]
max_payload_size = "2GB"
```

Supports human-readable units: B, KB, MB, GB.

#### Database management API

New REST API endpoints for managing databases programmatically.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/databases` | List all databases |
| `POST` | `/api/v1/databases` | Create a new database |
| `GET` | `/api/v1/databases/:name` | Get database info |
| `GET` | `/api/v1/databases/:name/measurements` | List measurements |
| `DELETE` | `/api/v1/databases/:name` | Delete a database |

#### DuckDB S3 query support

Arc now configures the DuckDB httpfs extension automatically, enabling direct queries against Parquet files stored in S3.

### Improvements

#### Ingestion pipeline
- **Zstd compression support** - 9.57M rec/sec with only 5% overhead vs uncompressed. Auto-detected via magic bytes.
- **O(n log n) column sorting** - Replaced O(n²) bubble sort with `sort.Slice()` for schema inference.
- **Single-pass timestamp normalization** - Reduced from 2-3 passes to single pass.
- **Result:** 7% throughput improvement (9.47M → 10.1M rec/s), 63% p50 latency reduction, 84% p99 latency reduction.

#### Authentication performance
- **Token lookup index** - O(1) token lookup instead of O(n) full table scan.
- **Atomic cache counters** - Eliminated lock contention on cache hit/miss tracking.
- **Auth metrics integration** - Prometheus metrics for authentication requests and cache performance.

#### Query performance
- **Arrow IPC throughput boost** - 5.2M rows/sec (80% improvement from 2.88M rows/sec).
- **SQL transform caching** - 60-second TTL cache for SQL-to-storage-path transformations (49-104x speedup on cache hits).
- **Partition path caching** - 60-second TTL cache saving 50-100ms per recurring query.
- **Glob result caching** - 30-second TTL cache saving 5-10ms per query for large partition sets.

#### Storage roundtrip optimizations
- Fixed N+1 query pattern in database listing (90% reduction for 20 databases).
- Optimized database existence checks via direct marker file lookup.
- Batch row counting in delete handler.

### Bug fixes

- Fixed DuckDB S3 credentials not persisting across connection pool
- Fixed compaction subprocess failing with large file counts
- **Fixed CTE (Common Table Expressions) support** - CTE names are now properly recognized as virtual table references
- **Fixed JOIN clause table resolution** - `JOIN database.table` syntax now correctly converts to storage paths
- **Fixed string literal corruption in queries** - String literals containing SQL keywords are no longer incorrectly rewritten
- **Fixed SQL comment handling** - Comments containing table references are no longer incorrectly converted
- **Added LATERAL JOIN support** - All LATERAL join variants now work correctly
- **Fixed UTC consistency in path generation** - Storage paths now consistently use UTC time

### Performance

Tested at **10.1M records/second** with:
- p50 latency: 3.09ms
- p95 latency: 5.16ms
- p99 latency: 6.73ms
- p999 latency: 9.29ms

### Breaking changes

None

### Upgrade notes

1. **S3 credentials** - For S3 storage backend, credentials are now also passed to DuckDB for httpfs queries. Ensure AWS credentials are configured.

2. **Azure backend** - New storage backend option. No changes required for existing deployments.

3. **Token prefix migration** - Existing API tokens are automatically migrated on startup. No action required.

### Contributors

- [@schotime](https://github.com/schotime) (Adam Schroder) - Data-time partitioning, compaction API triggers, UTC fixes

### Dependencies

- Added `github.com/Azure/azure-sdk-for-go/sdk/storage/azblob` for Azure Blob Storage
- Added `github.com/Azure/azure-sdk-for-go/sdk/azidentity` for Azure authentication

---

## 25.12.1

Released: December 2025

**Major Release: Complete rewrite from Python to Go**

### Migration highlights

This release marks the complete migration from Python to Go, delivering:

#### Performance improvements
- **9.47M records/sec** MessagePack ingestion (125% faster than Python's 4.21M)
- **1.92M records/sec** Line Protocol ingestion (76% faster than Python's 1.09M)
- **2.88M rows/sec** Arrow query throughput

#### Reliability
- **Memory stable** - No memory leaks (Python leaked 372MB per 500 queries)
- **Single binary** - No Python dependencies, pip, or virtual environments
- **Type-safe** - Strong typing catches bugs at compile time

#### Full feature parity
- Authentication (user/password)
- Automatic Compaction (Parquet optimization)
- Write-Ahead Log (WAL for durability)
- Retention Policies (automatic data expiration)
- Continuous Queries (real-time aggregations)
- Delete API (selective data removal)
- S3/MinIO storage backend
- Arrow IPC query responses

### Breaking changes

- **Python version** - The Python implementation is preserved in the `python-legacy` branch
- **Configuration** - TOML config format (unchanged, but verify your arc.toml)

### Upgrading from Python

1. Stop existing Arc service
2. Backup your data directory
3. Install the new Go binary (same config format)
4. Start Arc - data is automatically migrated

---

## 25.11.1

Released: November 2025

**Initial public release**

One database for metrics, logs, traces, and events. Query all your observability data with SQL. Built on DuckDB + Parquet.

### Features

#### High-performance ingestion
- **6.57M records/sec unified** - Ingest metrics, logs, traces, and events simultaneously through one endpoint
- **MessagePack columnar protocol** - Zero-copy ingestion optimized for throughput
- **InfluxDB Line Protocol** - 240K records/sec for Telegraf compatibility and easy migration

#### Query and analytics
- **DuckDB SQL engine** - Full analytical SQL with window functions, CTEs, joins, and aggregations
- **Cross-database queries** - Join metrics, logs, and traces in a single SQL query
- **Query caching** - Configurable result caching for repeated analytical queries
- **Apache Arrow format** - Zero-copy columnar data transfer for Pandas/Polars pipelines

#### Storage and scalability
- **Columnar Parquet storage** - 3-5x compression ratios, optimized for analytical queries
- **Flexible backends** - Local filesystem, MinIO, AWS S3/R2, or any S3-compatible storage
- **Multi-database architecture** - Organize data by environment, tenant, or application with database namespaces
- **Automatic compaction** - Merges small files into optimized 512MB files for 10-50x faster queries

#### Data management
- **Retention policies** - Time-based data lifecycle management with automatic cleanup
- **Continuous queries** - Downsampling and materialized views for long-term data aggregation
- **GDPR-compliant deletion** - Precise deletion with zero overhead on writes/queries
- **Write-Ahead Log (WAL)** - Optional durability feature for zero data loss

#### Integrations and tools
- **VSCode Extension** - Full-featured database manager with query editor, notebooks, CSV import, and alerting
- **Apache Superset** - Native dialect for BI dashboards and visualizations
- **Grafana** - Native Data Source
- **Prometheus** - Ingest via Telegraf bridge
- **OpenTelemetry** - Ingest via OTEL Collector

#### Operations and monitoring
- **Health checks** - `/health` and `/ready` endpoints for orchestration
- **Prometheus metrics** - Export operational metrics for monitoring
- **Authentication** - Token-based API authentication with cache for performance
- **Production ready** - Docker, native deployment, and systemd service management

### Performance

**Unified Ingestion Benchmark** (Apple M3 Max, 14 cores):
- Metrics: 2.91M/sec
- Logs: 1.55M/sec
- Traces: 1.50M/sec
- Events: 1.54M/sec
- **Total: 6.57M records/sec** (all data types simultaneously)

**ClickBench Results** (AWS c6a.4xlarge, 100M rows):
- Cold run: 120.25s
- Warm run: 35.70s
- 12.4x faster than TimescaleDB
- 1.2x faster than QuestDB (Combined and Cold Run)
