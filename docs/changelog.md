---
sidebar_position: 13
---

# Changelog

Release history for Arc.

## 26.03.1

Released: March 2026

Major quality release with backup/restore, 14 bug fixes, security hardening, and Go 1.26 upgrade.

### New Features

#### Backup & Restore API

Full backup and restore system via REST API. Backups capture parquet data files, SQLite metadata (auth, audit, MQTT config), and the `arc.toml` configuration file. Async operations with real-time progress tracking and selective restore.

Documentation: [Backup & Restore](/arc/operations/backup-restore)

### Bug Fixes

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

### New Features

#### MQTT Integration

Native MQTT subscriber with API-driven subscription management. Connect to IoT devices, industrial sensors, and message brokers without middleware.

- Dynamic subscription management via REST API (create, update, delete, start/stop)
- Multiple simultaneous brokers with topic wildcards
- Auto-detection of JSON and MessagePack message formats
- ~6M records/sec with MessagePack columnar format
- TLS/SSL support with encrypted credentials at rest (AES-256-GCM)
- QoS 0, 1, and 2

Documentation: [MQTT Integration](/arc/integrations/mqtt)

#### TLE (Satellite Orbital Data) Ingestion

Native support for ingesting satellite orbital data in the standard Two-Line Element format used by Space-Track.org, CelesTrak, and ground station pipelines.

- **Streaming ingestion** (`POST /api/v1/write/tle`) for continuous feeds and cron jobs
- **Bulk import** (`POST /api/v1/import/tle`) for historical backfill
- Pure Go parser with both 2-line and 3-line format support
- Derived orbital metrics (semi-major axis, period, apogee, perigee, orbit classification)
- ~3.5M records/sec via typed columnar fast path

Documentation: [TLE Integration](/arc/integrations/tle)

#### Bulk Import Endpoints

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

Documentation: [CSV Import](/arc/data-import/csv) | [Parquet Import](/arc/data-import/parquet) | [Line Protocol Import](/arc/data-import/line-protocol)

### Breaking Changes

None

---

## 26.01.2

Released: January 2026

Bugfix release addressing Azure Blob Storage backend issues and authentication configuration.

### Bug Fixes

#### Azure Blob Storage Backend

- **Fix queries failing with Azure backend** - Queries were incorrectly using local filesystem paths (`./data/...`) instead of Azure blob paths (`azure://...`) when using Azure Blob Storage as the storage backend.
- **Fix compaction subprocess Azure authentication** - Compaction subprocess was failing with "DefaultAzureCredential: failed to acquire token" because credentials weren't being passed to the subprocess. Now passes `AZURE_STORAGE_KEY` via environment variable.

#### Configuration

- **Authentication enabled by default** - `auth.enabled` is now `true` by default in arc.toml for improved security out of the box.

### Upgrade Notes

If you were relying on authentication being disabled by default, you'll need to explicitly set `auth.enabled = false` in your arc.toml.

---

## 26.01.1

Released: January 2026

### New Features

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

Documentation: [Python SDK](/arc/sdks/python)

#### Azure Blob Storage Backend

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

#### Native TLS/SSL Support

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

#### Configurable Ingestion Concurrency

Ingestion concurrency settings are now configurable for high-concurrency deployments.

**Configuration:**
```toml
[ingest]
flush_workers = 32        # Async flush worker pool size
flush_queue_size = 200    # Pending flush queue capacity
shard_count = 64          # Buffer shards for lock distribution
```

Defaults scale dynamically with CPU cores.

#### Data-Time Partitioning

Parquet files are now organized by the data's timestamp instead of ingestion time, enabling proper backfill of historical data.

**Key features:**
- Historical data lands in correct time-based partitions
- Batches spanning multiple hours are automatically split into separate files
- Data is sorted by timestamp within each Parquet file
- Enables accurate partition pruning for time-range queries

Documentation: [Data-Time Partitioning](/arc/advanced/data-time-partitioning)

*Contributed by [@schotime](https://github.com/schotime)*

#### Compaction API Triggers

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

#### Configurable Max Payload Size

The maximum request payload size is now configurable, with the default increased from 100MB to 1GB.

```toml
[server]
max_payload_size = "2GB"
```

Supports human-readable units: B, KB, MB, GB.

#### Database Management API

New REST API endpoints for managing databases programmatically.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/databases` | List all databases |
| `POST` | `/api/v1/databases` | Create a new database |
| `GET` | `/api/v1/databases/:name` | Get database info |
| `GET` | `/api/v1/databases/:name/measurements` | List measurements |
| `DELETE` | `/api/v1/databases/:name` | Delete a database |

#### DuckDB S3 Query Support

Arc now configures the DuckDB httpfs extension automatically, enabling direct queries against Parquet files stored in S3.

### Improvements

#### Ingestion Pipeline
- **Zstd compression support** - 9.57M rec/sec with only 5% overhead vs uncompressed. Auto-detected via magic bytes.
- **O(n log n) column sorting** - Replaced O(n²) bubble sort with `sort.Slice()` for schema inference.
- **Single-pass timestamp normalization** - Reduced from 2-3 passes to single pass.
- **Result:** 7% throughput improvement (9.47M → 10.1M rec/s), 63% p50 latency reduction, 84% p99 latency reduction.

#### Authentication Performance
- **Token lookup index** - O(1) token lookup instead of O(n) full table scan.
- **Atomic cache counters** - Eliminated lock contention on cache hit/miss tracking.
- **Auth metrics integration** - Prometheus metrics for authentication requests and cache performance.

#### Query Performance
- **Arrow IPC throughput boost** - 5.2M rows/sec (80% improvement from 2.88M rows/sec).
- **SQL transform caching** - 60-second TTL cache for SQL-to-storage-path transformations (49-104x speedup on cache hits).
- **Partition path caching** - 60-second TTL cache saving 50-100ms per recurring query.
- **Glob result caching** - 30-second TTL cache saving 5-10ms per query for large partition sets.

#### Storage Roundtrip Optimizations
- Fixed N+1 query pattern in database listing (90% reduction for 20 databases).
- Optimized database existence checks via direct marker file lookup.
- Batch row counting in delete handler.

### Bug Fixes

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

### Breaking Changes

None

### Upgrade Notes

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

### Migration Highlights

This release marks the complete migration from Python to Go, delivering:

#### Performance Improvements
- **9.47M records/sec** MessagePack ingestion (125% faster than Python's 4.21M)
- **1.92M records/sec** Line Protocol ingestion (76% faster than Python's 1.09M)
- **2.88M rows/sec** Arrow query throughput

#### Reliability
- **Memory stable** - No memory leaks (Python leaked 372MB per 500 queries)
- **Single binary** - No Python dependencies, pip, or virtual environments
- **Type-safe** - Strong typing catches bugs at compile time

#### Full Feature Parity
- Authentication (user/password)
- Automatic Compaction (Parquet optimization)
- Write-Ahead Log (WAL for durability)
- Retention Policies (automatic data expiration)
- Continuous Queries (real-time aggregations)
- Delete API (selective data removal)
- S3/MinIO storage backend
- Arrow IPC query responses

### Breaking Changes

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

#### High-Performance Ingestion
- **6.57M records/sec unified** - Ingest metrics, logs, traces, and events simultaneously through one endpoint
- **MessagePack columnar protocol** - Zero-copy ingestion optimized for throughput
- **InfluxDB Line Protocol** - 240K records/sec for Telegraf compatibility and easy migration

#### Query and Analytics
- **DuckDB SQL engine** - Full analytical SQL with window functions, CTEs, joins, and aggregations
- **Cross-database queries** - Join metrics, logs, and traces in a single SQL query
- **Query caching** - Configurable result caching for repeated analytical queries
- **Apache Arrow format** - Zero-copy columnar data transfer for Pandas/Polars pipelines

#### Storage and Scalability
- **Columnar Parquet storage** - 3-5x compression ratios, optimized for analytical queries
- **Flexible backends** - Local filesystem, MinIO, AWS S3/R2, Google Cloud Storage, or any S3-compatible storage
- **Multi-database architecture** - Organize data by environment, tenant, or application with database namespaces
- **Automatic compaction** - Merges small files into optimized 512MB files for 10-50x faster queries

#### Data Management
- **Retention policies** - Time-based data lifecycle management with automatic cleanup
- **Continuous queries** - Downsampling and materialized views for long-term data aggregation
- **GDPR-compliant deletion** - Precise deletion with zero overhead on writes/queries
- **Write-Ahead Log (WAL)** - Optional durability feature for zero data loss

#### Integrations and Tools
- **VSCode Extension** - Full-featured database manager with query editor, notebooks, CSV import, and alerting
- **Apache Superset** - Native dialect for BI dashboards and visualizations
- **Grafana** - Native Data Source
- **Prometheus** - Ingest via Telegraf bridge
- **OpenTelemetry** - Ingest via OTEL Collector

#### Operations and Monitoring
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
