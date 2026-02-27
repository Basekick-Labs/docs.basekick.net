---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Configuration Overview

Arc uses a TOML configuration file (`arc.toml`) with environment variable overrides for flexibility.

## Configuration Files

### Primary: arc.toml

The main configuration file with production-ready defaults:

```toml
# Server Configuration
[server]
port = 8000

# Logging
[log]
level = "info"       # debug, info, warn, error
format = "console"   # json or console

# Database (DuckDB)
[database]
# Auto-detected if not set (recommended)
# max_connections = 28    # 2x CPU cores
# memory_limit = "8GB"    # ~50% system RAM
# thread_count = 14       # CPU cores
enable_wal = false

# Storage Backend
[storage]
backend = "local"           # local, s3, minio, azure, azblob
local_path = "./data/arc"

# Ingestion
[ingest]
max_buffer_size = 50000     # records before flush
max_buffer_age_ms = 5000    # ms before force flush
# flush_workers = 16        # async flush workers (auto-detected)
# flush_queue_size = 64     # pending flush queue (auto-detected)
# shard_count = 32          # buffer shards

# Compaction
[compaction]
enabled = true
hourly_enabled = true
hourly_min_age_hours = 0
hourly_min_files = 5

# Authentication
[auth]
enabled = true

# Delete Operations
[delete]
enabled = true
confirmation_threshold = 10000
max_rows_per_delete = 1000000

# Retention Policies
[retention]
enabled = true

# Continuous Queries
[continuous_query]
enabled = true
```

### Environment Variables

Override any setting via environment variables with the `ARC_` prefix:

```bash
# Server
ARC_SERVER_PORT=8000
ARC_SERVER_TLS_ENABLED=false
ARC_SERVER_TLS_CERT_FILE=/path/to/cert.pem
ARC_SERVER_TLS_KEY_FILE=/path/to/key.pem
ARC_SERVER_MAX_PAYLOAD_SIZE=1GB    # v26.01.1+

# Logging
ARC_LOG_LEVEL=info
ARC_LOG_FORMAT=json

# Database
ARC_DATABASE_MAX_CONNECTIONS=28
ARC_DATABASE_MEMORY_LIMIT=8GB
ARC_DATABASE_THREAD_COUNT=14

# Features
ARC_AUTH_ENABLED=true
ARC_COMPACTION_ENABLED=true
ARC_DELETE_ENABLED=true
ARC_RETENTION_ENABLED=true
ARC_CONTINUOUS_QUERY_ENABLED=true

# Ingestion Concurrency (v26.01.1+)
ARC_INGEST_FLUSH_WORKERS=32
ARC_INGEST_FLUSH_QUEUE_SIZE=200
ARC_INGEST_SHARD_COUNT=64
```

## Configuration Priority

Settings are applied in this order (highest to lowest):

1. **Environment variables** (e.g., `ARC_SERVER_PORT=8000`)
2. **arc.toml file**
3. **Built-in defaults**

## Storage Backends

<Tabs>
  <TabItem value="local" label="Local" default>

**Local Filesystem** - Default, simplest option for single-node deployments.

```toml
[storage]
backend = "local"
local_path = "./data/arc"
```

Environment variables:

```bash
ARC_STORAGE_BACKEND=local
ARC_STORAGE_LOCAL_PATH=./data/arc
```

  </TabItem>
  <TabItem value="s3" label="AWS S3">

**AWS S3** - Recommended for production cloud deployments.

```toml
[storage]
backend = "s3"
s3_bucket = "arc-production"
s3_region = "us-east-1"
# Credentials via env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
# Or use IAM roles (recommended)
```

Environment variables:

```bash
ARC_STORAGE_BACKEND=s3
ARC_STORAGE_S3_BUCKET=arc-data
ARC_STORAGE_S3_REGION=us-east-1
ARC_STORAGE_S3_ENDPOINT=s3.amazonaws.com
ARC_STORAGE_S3_ACCESS_KEY=your_key
ARC_STORAGE_S3_SECRET_KEY=your_secret
ARC_STORAGE_S3_USE_SSL=true
ARC_STORAGE_S3_PATH_STYLE=false
```

:::tip IAM Roles
For EC2/EKS deployments, use IAM roles instead of access keys. Arc automatically uses instance credentials.
:::

  </TabItem>
  <TabItem value="minio" label="MinIO">

**MinIO** - Self-hosted S3-compatible storage.

```toml
[storage]
backend = "minio"
s3_bucket = "arc"
s3_endpoint = "minio:9000"
s3_access_key = "minioadmin"
s3_secret_key = "minioadmin123"
s3_use_ssl = false
s3_path_style = true      # Required for MinIO
```

Environment variables:

```bash
ARC_STORAGE_BACKEND=minio
ARC_STORAGE_S3_ENDPOINT=minio:9000
ARC_STORAGE_S3_BUCKET=arc
ARC_STORAGE_S3_ACCESS_KEY=minioadmin
ARC_STORAGE_S3_SECRET_KEY=minioadmin123
ARC_STORAGE_S3_USE_SSL=false
ARC_STORAGE_S3_PATH_STYLE=true
```

  </TabItem>
  <TabItem value="azure" label="Azure Blob">

**Azure Blob Storage** - For Azure cloud deployments.

:::note Coming in v26.01.1
Azure Blob Storage support will be available in Arc v26.01.1.
:::

```toml
[storage]
backend = "azure"         # or "azblob"
azure_container = "arc-data"
azure_account_name = "your_account"
azure_account_key = "your_key"
# Or use managed identity:
# azure_use_managed_identity = true
```

Environment variables:

```bash
ARC_STORAGE_BACKEND=azure
ARC_STORAGE_AZURE_CONTAINER=arc-data
ARC_STORAGE_AZURE_ACCOUNT_NAME=your_account
ARC_STORAGE_AZURE_ACCOUNT_KEY=your_key
```

:::tip Managed Identity
For Azure VMs/AKS, use managed identity for keyless authentication:
```toml
azure_use_managed_identity = true
```
:::

  </TabItem>
</Tabs>

## Key Configuration Areas

### Server

Basic HTTP server settings:

```toml
[server]
port = 8000    # HTTP/HTTPS port to listen on
```

### TLS/SSL (HTTPS)

Arc supports native HTTPS/TLS without requiring a reverse proxy:

```toml
[server]
port = 443
tls_enabled = true
tls_cert_file = "/etc/letsencrypt/live/example.com/fullchain.pem"
tls_key_file = "/etc/letsencrypt/live/example.com/privkey.pem"
```

Environment variables:

```bash
ARC_SERVER_TLS_ENABLED=true
ARC_SERVER_TLS_CERT_FILE=/path/to/cert.pem
ARC_SERVER_TLS_KEY_FILE=/path/to/key.pem
```

:::tip When to Use Native TLS
- **Native packages** (deb/rpm): Use native TLS for simple deployments
- **Docker/Kubernetes**: Use a reverse proxy (Traefik, nginx, Ingress) for TLS termination
- **Development**: Use self-signed certificates for local HTTPS testing
:::

When TLS is enabled, Arc automatically:
- Adds the `Strict-Transport-Security` (HSTS) header
- Validates certificate and key files on startup

### Max Payload Size

:::note Available in v26.01.1
This configuration option is available starting from Arc v26.01.1.
:::

Configure the maximum request payload size for write endpoints (msgpack, line protocol):

```toml
[server]
# Maximum payload size (applies to both compressed and decompressed)
# Supports units: B, KB, MB, GB
# Default: 1GB
max_payload_size = "1GB"
```

Environment variable:

```bash
ARC_SERVER_MAX_PAYLOAD_SIZE=2GB
```

:::tip Large Bulk Imports
If you're importing large datasets and encounter 413 errors, you can:
1. Increase `max_payload_size` (e.g., `"2GB"`)
2. Batch your imports into smaller chunks (recommended for reliability)
:::

### Database (DuckDB)

DuckDB connection pool and resource settings:

```toml
[database]
# AUTO-DETECTION: If not set, Arc automatically configures:
#   - max_connections: 2x CPU cores (min 4, max 64)
#   - memory_limit: ~50% of system memory
#   - thread_count: Number of CPU cores

# Manual override examples:
max_connections = 28      # Connection pool size
memory_limit = "8GB"      # DuckDB memory limit
thread_count = 14         # Query execution threads
enable_wal = false        # DuckDB WAL (not Arc WAL)
```

### Ingestion

Buffer and concurrency settings for write performance:

```toml
[ingest]
# Maximum records to buffer before flushing to Parquet
max_buffer_size = 50000

# Maximum age (ms) before forcing a flush
max_buffer_age_ms = 5000

# Concurrency settings (auto-detected if not set)
# flush_workers = 16       # async flush workers (2x CPU cores, min 8, max 64)
# flush_queue_size = 64    # pending flush queue (4x workers, min 100)
# shard_count = 32         # buffer shards for lock distribution
```

Data flushes when **either** condition is met:
1. Buffer reaches `max_buffer_size` records
2. Buffer age exceeds `max_buffer_age_ms`

:::tip High Concurrency
For deployments with many concurrent clients (50+), increase `flush_workers` and `flush_queue_size`:
```toml
[ingest]
flush_workers = 32
flush_queue_size = 200
shard_count = 64
```
:::

### Compaction

Automatic file optimization:

```toml
[compaction]
enabled = true
hourly_enabled = true
hourly_min_age_hours = 0    # Files must be this old
hourly_min_files = 5        # Minimum files to trigger
daily_enabled = false       # Daily tier (optional)
daily_min_age_hours = 24
daily_min_files = 3
```

### Authentication

Token-based API authentication:

```toml
[auth]
enabled = true              # Enable/disable auth
db_path = "./data/arc_auth.db"  # Token database
cache_ttl = 30              # Token cache TTL (seconds)
max_cache_size = 1000       # Max cached tokens
```

### Delete Operations

Safe deletion with confirmation:

```toml
[delete]
enabled = true
confirmation_threshold = 10000   # Require confirmation above this
max_rows_per_delete = 1000000    # Hard limit per operation
```

### Retention Policies

Automatic data expiration:

```toml
[retention]
enabled = true
db_path = "./data/arc_retention.db"
```

### Continuous Queries

Scheduled automated queries:

```toml
[continuous_query]
enabled = true
db_path = "./data/arc_cq.db"
```

### Write-Ahead Log (WAL)

Optional durability guarantee:

```toml
[wal]
enabled = false              # Enable for zero data loss
directory = "./data/wal"
sync_mode = "fdatasync"      # none, fdatasync, fsync
max_size_mb = 500
max_age_seconds = 3600
```

### Metrics

Timeseries metrics collection:

```toml
[metrics]
timeseries_retention_minutes = 60
timeseries_interval_seconds = 10
```

## Quick Configuration Examples

<Tabs>
  <TabItem value="dev" label="Development" default>

```toml
[server]
port = 8000

[log]
level = "debug"
format = "console"

[storage]
backend = "local"
local_path = "./dev_data"

[auth]
enabled = false

[compaction]
enabled = false
```

  </TabItem>
  <TabItem value="prod-local" label="Production (Local)">

```toml
[server]
port = 8000

[log]
level = "info"
format = "json"

[database]
max_connections = 32
memory_limit = "16GB"

[storage]
backend = "local"
local_path = "/var/lib/arc/data"

[ingest]
max_buffer_size = 100000
max_buffer_age_ms = 10000

[auth]
enabled = true

[compaction]
enabled = true
hourly_enabled = true
daily_enabled = true

[wal]
enabled = true
sync_mode = "fdatasync"
```

  </TabItem>
  <TabItem value="prod-s3" label="Production (S3)">

```toml
[server]
port = 8000

[log]
level = "info"
format = "json"

[storage]
backend = "s3"
s3_bucket = "arc-production"
s3_region = "us-east-1"
# Use IAM roles for credentials

[auth]
enabled = true

[compaction]
enabled = true
hourly_enabled = true
```

  </TabItem>
  <TabItem value="prod-tls" label="Production (TLS)">

```toml
[server]
port = 443
tls_enabled = true
tls_cert_file = "/etc/letsencrypt/live/example.com/fullchain.pem"
tls_key_file = "/etc/letsencrypt/live/example.com/privkey.pem"

[log]
level = "info"
format = "json"

[storage]
backend = "local"
local_path = "/var/lib/arc/data"

[auth]
enabled = true

[compaction]
enabled = true
hourly_enabled = true
```

  </TabItem>
  <TabItem value="high-durability" label="High Durability">

```toml
[server]
port = 8000

[storage]
backend = "minio"
s3_bucket = "arc"
s3_endpoint = "minio:9000"

[wal]
enabled = true
sync_mode = "fdatasync"
directory = "/var/lib/arc/wal"
max_size_mb = 1000
max_age_seconds = 3600

[compaction]
enabled = true
```

  </TabItem>
  <TabItem value="high-concurrency" label="High Concurrency">

```toml
# Optimized for 50+ concurrent clients (e.g., many Telegraf agents)
[server]
port = 8000

[log]
level = "info"
format = "json"

[database]
max_connections = 64
memory_limit = "16GB"

[storage]
backend = "local"
local_path = "/var/lib/arc/data"

[ingest]
max_buffer_size = 100000
max_buffer_age_ms = 10000
# Scale concurrency for many clients
flush_workers = 32        # More workers for parallel I/O
flush_queue_size = 200    # Larger queue for burst handling
shard_count = 64          # More shards to reduce lock contention

[auth]
enabled = true

[compaction]
enabled = true
hourly_enabled = true
```

  </TabItem>
</Tabs>

## Best Practices

### 1. Use arc.toml for Permanent Settings

Store configuration in `arc.toml` and version control it (without secrets):

```toml
[storage]
backend = "s3"
s3_bucket = "arc"
s3_region = "us-east-1"
# Credentials via environment variables
```

### 2. Use Environment Variables for Secrets

```bash
export ARC_STORAGE_S3_ACCESS_KEY="your_access_key"
export ARC_STORAGE_S3_SECRET_KEY="your_secret_key"
```

### 3. Let Arc Auto-Detect Resources

Arc automatically detects optimal DuckDB settings based on your system. Only override if you have specific requirements:

```toml
[database]
# Leave commented for auto-detection
# max_connections = 28
# memory_limit = "8GB"
# thread_count = 14
```

### 4. Enable Features Progressively

Start simple, add features as needed:
1. Basic configuration (storage + auth)
2. Compaction (for query optimization)
3. Retention policies (for data management)
4. WAL (for zero data loss guarantee)

### 5. Monitor Configuration Impact

Check metrics after configuration changes:

```bash
# Memory usage
curl http://localhost:8000/api/v1/metrics/memory

# Query performance
curl http://localhost:8000/api/v1/metrics/query-pool

# Compaction status
curl http://localhost:8000/api/v1/compaction/status
```

## Troubleshooting

### Configuration Not Loading

```bash
# Verify TOML syntax (use any TOML validator)
# Check file exists in expected location
ls -la arc.toml

# Arc looks for arc.toml in:
# 1. Current directory
# 2. /etc/arc/arc.toml (native install)
```

### Environment Variables Not Working

```bash
# Verify they're set
env | grep ARC_

# Use correct prefix and format
export ARC_SERVER_PORT=8000     # Correct
export SERVER_PORT=8000         # Wrong - missing ARC_ prefix
```

### Resource Issues

```bash
# Check current settings via metrics
curl http://localhost:8000/api/v1/metrics/memory

# Adjust in arc.toml:
[database]
memory_limit = "4GB"
max_connections = 16
```

## Next Steps

- **[Authentication](/arc/configuration/authentication)** - Token management
- **[Advanced Features](/arc/advanced/compaction)** - Compaction and WAL
