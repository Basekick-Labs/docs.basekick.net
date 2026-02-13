---
sidebar_position: 1
---

# Docker

Deploy Memtrace using Docker by building from source.

## Build from Source

Clone the repository and build the Docker image:

```bash
git clone https://github.com/basekick-labs/arc-memory.git
cd arc-memory
docker build -t memtrace:latest .
```

## Quick Start

Run with environment variables:

```bash
docker run -p 9100:9100 \
  -e MEMTRACE_ARC_URL=http://host.docker.internal:8000 \
  -e MEMTRACE_ARC_API_KEY=your_arc_api_key \
  -v ./data:/app/data \
  memtrace:latest
```

On first run, Memtrace prints your admin API key. **Save it — it's shown only once.**

```
FIRST RUN: Save your admin API key (shown only once)
API Key: mtk_...
```

## Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  memtrace:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "9100:9100"
    environment:
      MEMTRACE_ARC_URL: http://arc:8000
      MEMTRACE_ARC_API_KEY: your_arc_api_key
      MEMTRACE_LOG_LEVEL: info
      MEMTRACE_LOG_FORMAT: json
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  arc:
    image: ghcr.io/basekick-labs/arc:latest
    ports:
      - "8000:8000"
    volumes:
      - ./arc-data:/data
    restart: unless-stopped
```

Run with:

```bash
docker-compose up -d
```

## Environment Variables

All configuration values can be set via environment variables. See the [Configuration](./configuration.md) reference for the complete list.

### Common Variables

```bash
# Server
MEMTRACE_SERVER_HOST=0.0.0.0
MEMTRACE_SERVER_PORT=9100

# Arc Connection
MEMTRACE_ARC_URL=http://localhost:8000
MEMTRACE_ARC_API_KEY=your_arc_key
MEMTRACE_ARC_DATABASE=memory
MEMTRACE_ARC_MEASUREMENT=events

# Auth
MEMTRACE_AUTH_ENABLED=true
MEMTRACE_AUTH_DB_PATH=./data/memtrace.db

# Logging
MEMTRACE_LOG_LEVEL=info
MEMTRACE_LOG_FORMAT=json

# Deduplication
MEMTRACE_DEDUP_ENABLED=true
MEMTRACE_DEDUP_WINDOW_HOURS=24
```

## Volume Mounts

Mount a volume to persist data:

```bash
-v ./data:/app/data
```

The SQLite database (auth keys, metadata) is stored at `/app/data/memtrace.db` by default.

## Custom Configuration File

You can also mount a custom TOML configuration file:

```bash
docker run -p 9100:9100 \
  -v ./memtrace.toml:/etc/memtrace/memtrace.toml \
  -v ./data:/app/data \
  memtrace:latest
```

See [Configuration](./configuration.md) for the TOML file format.

## Health Check

Verify the container is running:

```bash
curl http://localhost:9100/health
```

Response:

```json
{"status": "ok", "service": "memtrace", "uptime": "2h30m15s"}
```

Check Arc connectivity:

```bash
curl http://localhost:9100/ready
```

Response:

```json
{"status": "ready", "arc": "connected"}
```
