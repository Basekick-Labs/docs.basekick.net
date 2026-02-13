---
sidebar_position: 2
---

# Self-Hosted

Install and run Memtrace on your own infrastructure.

## Prerequisites

- Go 1.21+
- A running [Arc](https://github.com/basekick-labs/arc) instance (port 8000)

## Build from Source

```bash
git clone https://github.com/basekick-labs/arc-memory.git
cd arc-memory
make build
```

The binary will be in `./memtrace`.

## Configuration

Create a configuration file:

```bash
cp memtrace.toml memtrace.local.toml
```

Edit `memtrace.local.toml` with your Arc URL and credentials. See the [Configuration](./configuration.md) reference for all available options.

Minimal configuration:

```toml
[arc]
url = "http://localhost:8000"
api_key = "your_arc_api_key"
database = "memory"
measurement = "events"

[auth]
enabled = true
db_path = "./data/memtrace.db"
```

## Run

```bash
./memtrace
```

Or specify a custom config file:

```bash
./memtrace -config /path/to/memtrace.toml
```

On first run, Memtrace prints your admin API key. **Save it — it's shown only once.**

```
FIRST RUN: Save your admin API key (shown only once)
API Key: mtk_...
```

## Systemd Service

Create `/etc/systemd/system/memtrace.service`:

```ini
[Unit]
Description=Memtrace Memory Layer for AI Agents
After=network.target

[Service]
Type=simple
User=memtrace
Group=memtrace
WorkingDirectory=/opt/memtrace
ExecStart=/usr/local/bin/memtrace -config /etc/memtrace/memtrace.toml
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable memtrace
sudo systemctl start memtrace
sudo systemctl status memtrace
```

## System Requirements

### Minimum

- 1 CPU core
- 512 MB RAM
- 1 GB disk space

### Recommended

- 2+ CPU cores
- 2 GB RAM
- 10 GB disk space (for SQLite metadata/auth database)

Memtrace is stateless for memory data (stored in Arc), but maintains SQLite databases for auth, agents, and sessions.

## Ports

- **9100**: HTTP API (default)

Configure via `server.port` in the config file or `MEMTRACE_SERVER_PORT` environment variable.

## Verify Installation

Check health:

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

## Next Steps

- Read the [Configuration](./configuration.md) reference
- Explore the [API Reference](/api-reference/overview)
- Try the [Quick Start](/getting-started/quickstart) guide
