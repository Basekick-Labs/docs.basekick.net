---
sidebar_position: 1
---

# Docker Installation

Install and run Arc using Docker for quick setup and isolated environments.

## Prerequisites

- Docker 20.10 or higher
- 4GB RAM minimum, 8GB+ recommended

## Quick Start

### Single Command Installation (Recommended)

The simplest way to get started with Arc is using Docker:

```bash
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:25.11.2
```

Arc API will be available at `http://localhost:8000`

**Verify it's running:**

```bash
curl http://localhost:8000/health
```

**Data persistence:**
- `/app/data/arc/` - Parquet files containing your data
- `/app/data/arc.db` - SQLite metadata and authentication tokens

### Get Your Admin Token

When Arc starts for the first time, it automatically creates an admin token and displays it in the logs.

**IMPORTANT: Copy this token immediately - you won't see it again!**

```bash
# Docker - check the logs for your admin token
docker logs <container-id> 2>&1 | grep "Admin token"
```

You should see output like:
```
Admin token: arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save this token! You'll need it for all API requests.

```bash
# Export for convenience
export ARC_TOKEN="your-token-here"
```

## Advanced Configuration

### Environment Variables

You can customize Arc behavior with environment variables:

```bash
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -e LOG_LEVEL=INFO \
  -e ARC_WORKERS=8 \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:25.11.2
```

**Common environment variables:**
- `STORAGE_BACKEND` - Storage type: `local`, `s3`, `minio` (default: `local`)
- `LOG_LEVEL` - Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR` (default: `INFO`)
- `ARC_WORKERS` - Number of worker processes (default: auto-detected)
- `AUTH_ENABLED` - Enable authentication (default: `true`)

## Managing Your Container

### View Logs

```bash
# Follow logs in real-time
docker logs -f <container-id>

# Last 100 lines
docker logs --tail=100 <container-id>

# Find your container ID
docker ps
```

### Restart Container

```bash
docker restart <container-id>
```

### Stop Container

```bash
# Stop the container
docker stop <container-id>

# Remove the container (data is preserved in the volume)
docker rm <container-id>
```

### Update Arc

```bash
# Stop and remove old container
docker stop <container-id>
docker rm <container-id>

# Pull latest version
docker pull ghcr.io/basekick-labs/arc:25.11.2

# Start new container with same volume
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:25.11.2
```

## Storage Backend Options

### Local Filesystem (Default)

```bash
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:25.11.2
```

### AWS S3

```bash
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=s3 \
  -e STORAGE_S3_BUCKET=arc-data \
  -e STORAGE_S3_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=your_key \
  -e AWS_SECRET_ACCESS_KEY=your_secret \
  ghcr.io/basekick-labs/arc:25.11.2
```

### MinIO (Self-Hosted S3)

```bash
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=minio \
  -e MINIO_ENDPOINT=minio:9000 \
  -e MINIO_ACCESS_KEY=minioadmin \
  -e MINIO_SECRET_KEY=minioadmin123 \
  -e MINIO_BUCKET=arc \
  ghcr.io/basekick-labs/arc:25.11.2
```

## Production Deployment

### Always Use Specific Versions

```bash
# Pin to specific version for production
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  --restart unless-stopped \
  ghcr.io/basekick-labs/arc:25.11.2  # ← Pin version
```

### Resource Limits

```bash
docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -v arc-data:/app/data \
  --memory="8g" \
  --cpus="4" \
  --restart unless-stopped \
  ghcr.io/basekick-labs/arc:25.11.2
```

### Health Check Example

```bash
# Check if Arc is healthy
docker ps --filter "name=arc" --filter "health=healthy"
```

## Troubleshooting

### Arc Container Won't Start

```bash
# Check logs
docker logs <container-id>

# Common issues:
# 1. Port 8000 already in use
sudo lsof -i :8000  # Find process using port
docker stop <container-id>

# 2. Check container status
docker ps -a
```

### Permission Errors

```bash
# If you see permission errors with volumes
docker volume ls
docker volume inspect arc-data

# Remove and recreate volume if needed
docker stop <container-id>
docker rm <container-id>
docker volume rm arc-data
# Then restart with docker run command
```

### Out of Memory

```bash
# Check memory usage
docker stats <container-id>

# Restart with memory limit
docker stop <container-id>
docker rm <container-id>

docker run -d \
  -p 8000:8000 \
  -e STORAGE_BACKEND=local \
  -e ARC_WORKERS=4 \
  -v arc-data:/app/data \
  --memory="4g" \
  ghcr.io/basekick-labs/arc:25.11.2
```

### Can't Find Admin Token

```bash
# View all logs to find the admin token
docker logs <container-id> 2>&1 | grep -i "admin"

# Or create a new token manually
docker exec -it <container-id> python3 -c "
from api.auth import AuthManager
auth = AuthManager(db_path='/app/data/arc.db')
token = auth.create_token('my-admin', description='Admin token')
print(f'Admin Token: {token}')
"
```

## Next Steps

- **[Write your first data](/arc/getting-started#write-your-first-data)** - Start sending metrics to Arc
- **[Query your data](/arc/getting-started#query-your-data)** - Learn DuckDB SQL queries
- **[Configure storage backends](/arc/configuration/storage)** - Switch to S3 or MinIO
- **[Integrate with Telegraf](/arc/integrations/telegraf)** - Collect system metrics automatically
