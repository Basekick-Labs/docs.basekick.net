---
sidebar_position: 1
---

# Docker Installation

Install and run Arc using Docker for quick setup and isolated environments.

## Prerequisites

- Docker 20.10 or higher
- Docker Compose 2.0 or higher
- 4GB RAM minimum, 8GB+ recommended
- 10GB disk space for storage

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/basekick-labs/arc.git
cd arc
```

### 2. Start Arc with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# Expected output:
# NAME                COMMAND                  SERVICE             STATUS              PORTS
# arc-api            "uvicorn api.main:ap…"   arc-api             running             0.0.0.0:8000->8000/tcp
# minio              "/usr/bin/docker-ent…"   minio               running             0.0.0.0:9000-9001->9000-9001/tcp
```

### 3. Verify Installation

```bash
# Check Arc health
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","version":"0.1.0","storage":"minio"}
```

### 4. Access Services

- **Arc API**: http://localhost:8000
- **Arc API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## Services Overview

The `docker-compose.yml` includes:

### Arc API (arc-api)
- Port: 8000
- Main API server with FastAPI
- Auto-configures storage backend
- Includes health checks

### MinIO (minio)
- Port: 9000 (API), 9001 (Console)
- S3-compatible object storage
- Default credentials: minioadmin/minioadmin
- Persistent volume: `./minio_data`

### MinIO Init (minio-init)
- One-time container
- Creates Arc bucket automatically
- Exits after initialization

## Configuration

### Environment Variables

Create a `.env` file to customize settings:

```bash
# Server Configuration
ARC_HOST=0.0.0.0
ARC_PORT=8000
ARC_WORKERS=8

# Storage Configuration
STORAGE_BACKEND=minio
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=arc
MINIO_DATABASE=default

# Authentication
AUTH_ENABLED=true

# Query Cache
QUERY_CACHE_ENABLED=true
QUERY_CACHE_TTL=60

# Logging
LOG_LEVEL=INFO
```

### Custom Docker Compose

You can override settings in `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  arc-api:
    environment:
      - ARC_WORKERS=16
      - LOG_LEVEL=DEBUG
    ports:
      - "8080:8000"  # Custom port mapping
```

## Managing Services

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f arc-api

# Last 100 lines
docker-compose logs --tail=100 arc-api
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart arc-api
```

### Stop Services

```bash
# Stop (keeps containers)
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove everything including volumes
docker-compose down -v
```

### Update Arc

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```

## Performance Considerations

Docker deployment achieves **~570K records/sec** write throughput. For maximum performance (2.01M RPS), use [native deployment](/arc/installation/native).

### Optimize Docker Performance

1. **Increase Worker Count**:
   ```bash
   ARC_WORKERS=16  # Set to 2-3x your CPU cores
   ```

2. **Allocate More Resources** (Docker Desktop):
   - Settings → Resources
   - CPUs: 4+
   - Memory: 8GB+

3. **Use Volume Mounts for Data**:
   ```yaml
   services:
     arc-api:
       volumes:
         - ./data:/data  # Faster than named volumes
   ```

4. **Disable Unnecessary Services**:
   ```bash
   # If using AWS S3 instead of MinIO
   docker-compose up -d arc-api
   ```

## Storage Backend Options

### Local Filesystem (Fastest in Docker)

```yaml
services:
  arc-api:
    environment:
      - STORAGE_BACKEND=local
      - STORAGE_LOCAL_BASE_PATH=/data/arc
    volumes:
      - ./arc_data:/data/arc
```

### AWS S3

```yaml
services:
  arc-api:
    environment:
      - STORAGE_BACKEND=s3
      - STORAGE_S3_BUCKET=arc-data
      - STORAGE_S3_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=your_key
      - AWS_SECRET_ACCESS_KEY=your_secret
```

### Google Cloud Storage

```yaml
services:
  arc-api:
    environment:
      - STORAGE_BACKEND=gcs
      - STORAGE_GCS_BUCKET=arc-data
      - STORAGE_GCS_PROJECT_ID=my-project
      - GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcp-key.json
    volumes:
      - ./gcp-key.json:/secrets/gcp-key.json:ro
```

## Production Deployment

### Use Specific Versions

```yaml
services:
  arc-api:
    image: ghcr.io/basekick-labs/arc:v0.1.0  # Pin version
```

### Health Checks

Health checks are included by default:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Resource Limits

```yaml
services:
  arc-api:
    deploy:
      resources:
        limits:
          cpus: '8'
          memory: 16G
        reservations:
          cpus: '4'
          memory: 8G
```

### Restart Policy

```yaml
services:
  arc-api:
    restart: unless-stopped
```

## Troubleshooting

### Arc API Won't Start

```bash
# Check logs
docker-compose logs arc-api

# Common issues:
# 1. Port 8000 already in use
docker-compose down
sudo lsof -i :8000  # Find process using port

# 2. MinIO not ready
docker-compose ps minio
docker-compose restart arc-api  # Restart after MinIO is ready
```

### MinIO Connection Issues

```bash
# Verify MinIO is running
docker-compose ps minio

# Check MinIO logs
docker-compose logs minio

# Test MinIO connection
docker exec arc-api curl -f http://minio:9000/minio/health/live
```

### Permission Errors

```bash
# Fix volume permissions
sudo chown -R $USER:$USER minio_data/
chmod -R 755 minio_data/
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Reduce workers
docker-compose down
# Edit docker-compose.yml: ARC_WORKERS=4
docker-compose up -d
```

## Next Steps

- **[Create your first API token](/arc/configuration/authentication)**
- **[Configure storage backends](/arc/configuration/storage)**
- **[Start writing data](/arc/getting-started#write-your-first-data)**
- **[Set up monitoring](/arc/operations/monitoring)**
