---
sidebar_position: 1
---

# Configuration Overview

Arc uses a centralized `arc.conf` configuration file (TOML format) with environment variable overrides for flexibility.

## Configuration Files

### Primary: arc.conf

The main configuration file with production-ready defaults:

```toml
# Server Configuration
[server]
host = "0.0.0.0"
port = 8000
workers = 8

# Authentication
[auth]
enabled = true
default_token = ""  # Auto-generated if empty

# Query Cache
[query_cache]
enabled = true
ttl_seconds = 60

# Storage Backend
[storage]
backend = "local"  # Options: local, minio, s3, gcs

[storage.local]
base_path = "./data/arc"
database = "default"
```

### Environment Variables

Override any setting via environment variables:

```bash
# Server
ARC_HOST=0.0.0.0
ARC_PORT=8000
ARC_WORKERS=42

# Storage
STORAGE_BACKEND=minio
MINIO_ENDPOINT=localhost:9000
MINIO_BUCKET=arc

# Cache
QUERY_CACHE_ENABLED=true
QUERY_CACHE_TTL=60
```

### Legacy: .env File

Backward compatible with `.env` files, but `arc.conf` is recommended.

## Configuration Priority

Settings are applied in this order (highest to lowest):

1. **Environment variables** (e.g., `ARC_WORKERS=16`)
2. **arc.conf file**
3. **Built-in defaults**

## Key Configuration Areas

### Server

- **Workers**: Set to 3x CPU cores for optimal performance
- **Host/Port**: Network binding configuration
- **Logging**: Log level and output format

[Learn more →](/arc/configuration/server)

### Storage

- **Backend selection**: Local, MinIO, AWS S3, GCS
- **Connection settings**: Endpoints, credentials, buckets
- **Database namespaces**: Multi-tenant organization

[Learn more →](/arc/configuration/storage)

### Authentication

- **API tokens**: Create and manage access tokens
- **Permissions**: Read/write access control
- **Token rotation**: Security best practices

[Learn more →](/arc/configuration/authentication)

### Performance

- **Buffer sizes**: Ingestion throughput tuning
- **Query cache**: Speed up repeated queries
- **Compaction**: Optimize query performance

[Learn more →](/arc/configuration/performance)

### Advanced Features

- **Write-Ahead Log (WAL)**: Zero data loss guarantee
- **Compaction**: Automatic file optimization
- **Monitoring**: Metrics and health checks

## Quick Configuration Examples

### Maximum Performance (Native)

```toml
[server]
workers = 42  # 3x CPU cores (14 cores × 3)

[storage]
backend = "local"

[storage.local]
base_path = "/mnt/nvme/arc-data"  # NVMe storage

[ingestion]
buffer_size = 200000
buffer_age_seconds = 10

[compaction]
enabled = true
schedule = "5 * * * *"
```

### Distributed Deployment

```toml
[server]
workers = 32

[storage]
backend = "minio"

[storage.minio]
endpoint = "http://minio-cluster:9000"
access_key = "minioadmin"
secret_key = "minioadmin123"
bucket = "arc"
use_ssl = false

[compaction]
enabled = true
max_concurrent_jobs = 4
```

### Cloud Deployment (AWS S3)

```toml
[server]
workers = 16

[storage]
backend = "s3"

[storage.s3]
bucket = "arc-production"
region = "us-east-1"
# Uses IAM role or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars

[query_cache]
enabled = true
ttl_seconds = 300

[compaction]
enabled = true
compression = "zstd"
compression_level = 3
```

### High Durability (WAL Enabled)

```toml
[server]
workers = 24

[wal]
enabled = true
sync_mode = "fdatasync"
dir = "./data/wal"
max_size_mb = 500
max_age_seconds = 3600

[storage]
backend = "minio"

[storage.minio]
endpoint = "http://localhost:9000"
bucket = "arc"
```

## Configuration Validation

Arc validates configuration on startup:

```bash
# Test configuration
./start.sh native --validate

# Or manually
python3 -c "from api.config import load_config; load_config()"
```

## Environment-Specific Configurations

### Development

```toml
[server]
workers = 4
port = 8000

[storage]
backend = "local"

[storage.local]
base_path = "./dev_data"

[auth]
enabled = false  # Disable for local development

[query_cache]
enabled = false  # See fresh queries
```

### Staging

```toml
[server]
workers = 16

[storage]
backend = "minio"

[storage.minio]
bucket = "arc-staging"
database = "staging"

[auth]
enabled = true

[compaction]
enabled = true
schedule = "0 */2 * * *"  # Every 2 hours
```

### Production

```toml
[server]
workers = 42

[storage]
backend = "s3"

[storage.s3]
bucket = "arc-production"
region = "us-east-1"
database = "production"

[auth]
enabled = true

[wal]
enabled = true
sync_mode = "fdatasync"

[compaction]
enabled = true
schedule = "5 * * * *"  # Every hour at :05
max_concurrent_jobs = 4

[query_cache]
enabled = true
ttl_seconds = 300
```

## Best Practices

### 1. Use arc.conf for Permanent Settings

Store configuration in `arc.conf` and version control it (without secrets):

```toml
[storage.minio]
endpoint = "http://minio:9000"
bucket = "arc"
# Access keys via environment variables
```

### 2. Use Environment Variables for Secrets

```bash
export MINIO_ACCESS_KEY="your_access_key"
export MINIO_SECRET_KEY="your_secret_key"
export ARC_ADMIN_TOKEN="your_admin_token"
```

### 3. Set Workers Based on Workload

- **Light** (4 workers): Development, testing
- **Medium** (8-16 workers): Small production workloads
- **Heavy** (24-42 workers): High-throughput production

### 4. Enable Features Progressively

Start simple, add features as needed:
1. Basic configuration (storage + auth)
2. Query caching (for repeated queries)
3. Compaction (for query optimization)
4. WAL (for zero data loss)

### 5. Monitor Configuration Impact

Check metrics after configuration changes:

```bash
# Memory usage
curl http://localhost:8000/metrics/memory

# Query performance
curl http://localhost:8000/metrics/query-pool

# Compaction status
curl http://localhost:8000/api/compaction/status
```

## Troubleshooting

### Configuration Not Loading

```bash
# Check syntax
python3 -c "import toml; toml.load('arc.conf')"

# Verify file location
ls -la arc.conf

# Check permissions
chmod 644 arc.conf
```

### Environment Variables Not Working

```bash
# Verify they're set
env | grep ARC_
env | grep STORAGE_
env | grep MINIO_

# Export before starting Arc
export ARC_WORKERS=16
./start.sh native
```

### Performance Issues

```bash
# Check worker count
ps aux | grep uvicorn | wc -l

# Should be 3x CPU cores for optimal performance
nproc  # Get CPU count
```

## Next Steps

- **[Configure storage backends](/arc/configuration/storage)**
- **[Set up authentication](/arc/configuration/authentication)**
- **[Tune performance](/arc/configuration/performance)**
- **[Enable advanced features](/arc/advanced/overview)**
