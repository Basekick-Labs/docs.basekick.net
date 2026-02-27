---
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Docker Installation

Install and run Arc using Docker for quick setup and isolated environments.

## Prerequisites

- Docker 20.10 or higher
- 4GB RAM minimum, 8GB+ recommended

## Quick Start

```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:latest
```

Verify it's running:

```bash
curl http://localhost:8000/health
```

## Get Your Admin Token

When Arc starts for the first time, it generates an admin token.

:::warning Save This Token
Copy this token immediately - you won't see it again!
:::

```bash
docker logs arc 2>&1 | grep -i "admin"
```

You should see:

```
======================================================================
  FIRST RUN - INITIAL ADMIN TOKEN GENERATED
======================================================================
  Initial admin API token: arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
======================================================================
```

Save it:

```bash
export ARC_TOKEN="arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Storage Backends

<Tabs>
  <TabItem value="local" label="Local" default>

**Local Filesystem** - Default, data stored in Docker volume.

```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -e ARC_STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:latest
```

**Data locations:**

| Path | Description |
|------|-------------|
| `/app/data/arc/` | Parquet files |
| `/app/data/arc_auth.db` | Auth tokens |

  </TabItem>
  <TabItem value="s3" label="AWS S3">

**AWS S3** - Production cloud storage.

```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -e ARC_STORAGE_BACKEND=s3 \
  -e ARC_STORAGE_S3_BUCKET=arc-data \
  -e ARC_STORAGE_S3_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=your_key \
  -e AWS_SECRET_ACCESS_KEY=your_secret \
  ghcr.io/basekick-labs/arc:latest
```

:::tip IAM Roles
On EC2, use IAM roles instead of access keys for better security.
:::

  </TabItem>
  <TabItem value="minio" label="MinIO">

**MinIO** - Self-hosted S3-compatible storage.

```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -e ARC_STORAGE_BACKEND=minio \
  -e ARC_STORAGE_S3_ENDPOINT=minio:9000 \
  -e ARC_STORAGE_S3_BUCKET=arc \
  -e ARC_STORAGE_S3_ACCESS_KEY=minioadmin \
  -e ARC_STORAGE_S3_SECRET_KEY=minioadmin123 \
  -e ARC_STORAGE_S3_USE_SSL=false \
  ghcr.io/basekick-labs/arc:latest
```

  </TabItem>
  <TabItem value="azure" label="Azure Blob">

**Azure Blob Storage** - For Azure deployments.


```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -e ARC_STORAGE_BACKEND=azure \
  -e ARC_STORAGE_AZURE_CONTAINER=arc-data \
  -e ARC_STORAGE_AZURE_ACCOUNT_NAME=your_account \
  -e ARC_STORAGE_AZURE_ACCOUNT_KEY=your_key \
  ghcr.io/basekick-labs/arc:latest
```

  </TabItem>
</Tabs>

## Configuration

### Environment Variables

Common configuration options:

| Variable | Default | Description |
|----------|---------|-------------|
| `ARC_SERVER_PORT` | `8000` | HTTP port |
| `ARC_STORAGE_BACKEND` | `local` | Storage: `local`, `s3`, `minio`, `azure` |
| `ARC_LOG_LEVEL` | `info` | Logging: `debug`, `info`, `warn`, `error` |
| `ARC_AUTH_ENABLED` | `true` | Enable authentication |
| `ARC_COMPACTION_ENABLED` | `true` | Enable auto-compaction |
| `ARC_WAL_ENABLED` | `false` | Enable WAL for durability |

### Custom Configuration File

Mount a custom `arc.toml`:

```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -v arc-data:/app/data \
  -v /path/to/arc.toml:/app/arc.toml \
  ghcr.io/basekick-labs/arc:latest
```

## Container Management

### View Logs

```bash
docker logs -f arc           # Follow logs
docker logs --tail=100 arc   # Last 100 lines
```

### Start/Stop/Restart

```bash
docker start arc
docker stop arc
docker restart arc
```

### Update Arc

```bash
docker stop arc && docker rm arc
docker pull ghcr.io/basekick-labs/arc:25.12.1
docker run -d \
  --name arc \
  -p 8000:8000 \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:latest
```

## Production Deployment

### Pin Version + Resource Limits

```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -v arc-data:/app/data \
  --memory="8g" \
  --cpus="4" \
  --restart unless-stopped \
  ghcr.io/basekick-labs/arc:latest
```

### Health Check

```bash
docker ps --filter "name=arc" --filter "health=healthy"
```

## Docker Compose

<Tabs>
  <TabItem value="basic" label="Basic" default>

```yaml
version: '3.8'

services:
  arc:
    image: ghcr.io/basekick-labs/arc:25.12.1
    container_name: arc
    ports:
      - "8000:8000"
    environment:
      - ARC_STORAGE_BACKEND=local
      - ARC_AUTH_ENABLED=true
      - ARC_COMPACTION_ENABLED=true
    volumes:
      - arc-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  arc-data:
```

  </TabItem>
  <TabItem value="minio" label="With MinIO">

```yaml
version: '3.8'

services:
  arc:
    image: ghcr.io/basekick-labs/arc:25.12.1
    container_name: arc
    ports:
      - "8000:8000"
    environment:
      - ARC_STORAGE_BACKEND=minio
      - ARC_STORAGE_S3_ENDPOINT=minio:9000
      - ARC_STORAGE_S3_BUCKET=arc
      - ARC_STORAGE_S3_ACCESS_KEY=minioadmin
      - ARC_STORAGE_S3_SECRET_KEY=minioadmin123
      - ARC_STORAGE_S3_USE_SSL=false
    depends_on:
      - minio
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin123
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data

volumes:
  minio-data:
```

  </TabItem>
  <TabItem value="production" label="Production">

```yaml
version: '3.8'

services:
  arc:
    image: ghcr.io/basekick-labs/arc:25.12.1
    container_name: arc
    ports:
      - "8000:8000"
    environment:
      - ARC_STORAGE_BACKEND=local
      - ARC_AUTH_ENABLED=true
      - ARC_COMPACTION_ENABLED=true
      - ARC_WAL_ENABLED=true
      - ARC_WAL_SYNC_MODE=fdatasync
      - ARC_LOG_LEVEL=info
      - ARC_LOG_FORMAT=json
    volumes:
      - arc-data:/app/data
      - arc-wal:/app/data/wal
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: '4'
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  arc-data:
  arc-wal:
```

  </TabItem>
</Tabs>

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs arc

# Check port availability
sudo lsof -i :8000

# Check container status
docker ps -a
```

### Permission Errors

```bash
# Remove and recreate volume
docker stop arc && docker rm arc
docker volume rm arc-data
# Restart with docker run command
```

### Out of Memory

```bash
# Check memory usage
docker stats arc

# Restart with memory limit
docker run -d --name arc --memory="4g" ...
```

### Can't Find Admin Token

```bash
docker logs arc 2>&1 | grep -i "admin"
docker logs arc | head -100
```

## Next Steps

- [Write your first data](/arc/getting-started#write-data)
- [Configure storage backends](/arc/configuration/overview)
- [Deploy on Kubernetes](/arc/installation/kubernetes)
