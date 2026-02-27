---
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import LatestVersion from '@site/src/components/LatestVersion';

# Native Installation

Install Arc directly on Linux using native packages (.deb, .rpm) or build from source.

:::tip Latest Version
Current release: **<LatestVersion repo="basekick-labs/arc" format="tag" />**
:::

## Prerequisites

- Linux (x86_64 or ARM64)
- 4GB RAM minimum, 8GB+ recommended
- systemd (for service management)

## Quick Install

The following commands automatically fetch and install the latest Arc release.

<Tabs>
  <TabItem value="debian" label="Debian/Ubuntu" default>

**x86_64 (AMD/Intel):**

```bash
LATEST_VERSION=$(curl -s https://api.github.com/repos/basekick-labs/arc/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/arc/releases/download/v${LATEST_VERSION}/arc_${LATEST_VERSION}_amd64.deb
sudo dpkg -i arc_${LATEST_VERSION}_amd64.deb
sudo systemctl enable arc && sudo systemctl start arc
curl http://localhost:8000/health
```

**ARM64:**

```bash
LATEST_VERSION=$(curl -s https://api.github.com/repos/basekick-labs/arc/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/arc/releases/download/v${LATEST_VERSION}/arc_${LATEST_VERSION}_arm64.deb
sudo dpkg -i arc_${LATEST_VERSION}_arm64.deb
sudo systemctl enable arc && sudo systemctl start arc
```

  </TabItem>
  <TabItem value="rhel" label="RHEL/Fedora">

**x86_64 (AMD/Intel):**

```bash
LATEST_VERSION=$(curl -s https://api.github.com/repos/basekick-labs/arc/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/arc/releases/download/v${LATEST_VERSION}/arc-${LATEST_VERSION}-1.x86_64.rpm
sudo rpm -i arc-${LATEST_VERSION}-1.x86_64.rpm
sudo systemctl enable arc && sudo systemctl start arc
curl http://localhost:8000/health
```

**ARM64:**

```bash
LATEST_VERSION=$(curl -s https://api.github.com/repos/basekick-labs/arc/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/arc/releases/download/v${LATEST_VERSION}/arc-${LATEST_VERSION}-1.aarch64.rpm
sudo rpm -i arc-${LATEST_VERSION}-1.aarch64.rpm
sudo systemctl enable arc && sudo systemctl start arc
```

  </TabItem>
  <TabItem value="source" label="Build from Source">

Prerequisites: Go 1.25+, Git, Make

```bash
# Clone and build
git clone https://github.com/basekick-labs/arc.git
cd arc
make build

# Run
./arc
```

Development commands:

```bash
make deps           # Install dependencies
make build          # Build binary
make run            # Run without building
make test           # Run tests
make test-coverage  # Run tests with coverage
make bench          # Run benchmarks
make lint           # Run linter
make clean          # Clean build artifacts
```

  </TabItem>
</Tabs>

## Get Your Admin Token

When Arc starts for the first time, it generates an admin token.

:::warning Save This Token
Copy this token immediately - you won't see it again!
:::

```bash
sudo journalctl -u arc | grep -i "admin"
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

**Local Filesystem** - Default, data stored on disk.

Edit `/etc/arc/arc.toml`:

```toml
[storage]
backend = "local"
local_path = "/var/lib/arc/data"
```

Or via environment:

```bash
ARC_STORAGE_BACKEND=local
ARC_STORAGE_LOCAL_PATH=/var/lib/arc/data
```

  </TabItem>
  <TabItem value="s3" label="AWS S3">

**AWS S3** - Production cloud storage.

Edit `/etc/arc/arc.toml`:

```toml
[storage]
backend = "s3"
s3_bucket = "arc-production"
s3_region = "us-east-1"
# Use IAM roles or environment variables for credentials
```

Environment variables:

```bash
ARC_STORAGE_BACKEND=s3
ARC_STORAGE_S3_BUCKET=arc-data
ARC_STORAGE_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

:::tip IAM Roles
On EC2, use IAM instance profiles for automatic credential management.
:::

  </TabItem>
  <TabItem value="minio" label="MinIO">

**MinIO** - Self-hosted S3-compatible storage.

Edit `/etc/arc/arc.toml`:

```toml
[storage]
backend = "minio"
s3_bucket = "arc"
s3_endpoint = "minio.local:9000"
s3_access_key = "minioadmin"
s3_secret_key = "minioadmin123"
s3_use_ssl = false
s3_path_style = true
```

  </TabItem>
  <TabItem value="azure" label="Azure Blob">

**Azure Blob Storage** - For Azure deployments.


Edit `/etc/arc/arc.toml`:

```toml
[storage]
backend = "azure"
azure_container = "arc-data"
azure_account_name = "your_account"
azure_account_key = "your_key"
```

  </TabItem>
</Tabs>

## Service Management

### Start/Stop/Restart

```bash
sudo systemctl start arc      # Start
sudo systemctl stop arc       # Stop
sudo systemctl restart arc    # Restart
sudo systemctl status arc     # Status
```

### View Logs

```bash
sudo journalctl -u arc -f            # Follow logs
sudo journalctl -u arc -n 100        # Last 100 lines
sudo journalctl -u arc --since "1 hour ago"
```

### Enable/Disable Auto-Start

```bash
sudo systemctl enable arc     # Enable on boot
sudo systemctl disable arc    # Disable on boot
```

## Configuration

Configuration file: `/etc/arc/arc.toml`

```bash
sudo nano /etc/arc/arc.toml
sudo systemctl restart arc
```

### Common Options

```toml
[server]
port = 8000

[storage]
backend = "local"
local_path = "/var/lib/arc/data"

[auth]
enabled = true

[compaction]
enabled = true
hourly_enabled = true
daily_enabled = true

[wal]
enabled = false  # Enable for zero data loss
sync_mode = "fdatasync"

[log]
level = "info"
format = "json"
```

See [Configuration Overview](/arc/configuration/overview) for all options.

## Data Directory

| Installation Type | Default Data Directory |
|-------------------|------------------------|
| Package install   | `/var/lib/arc/data`    |
| Source build      | `./data/arc`           |

## Updating Arc

<Tabs>
  <TabItem value="debian" label="Debian/Ubuntu" default>

```bash
# Automatic update to latest version
LATEST_VERSION=$(curl -s https://api.github.com/repos/basekick-labs/arc/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/arc/releases/download/v${LATEST_VERSION}/arc_${LATEST_VERSION}_amd64.deb
sudo dpkg -i arc_${LATEST_VERSION}_amd64.deb
sudo systemctl restart arc
```

  </TabItem>
  <TabItem value="rhel" label="RHEL/Fedora">

```bash
# Automatic update to latest version
LATEST_VERSION=$(curl -s https://api.github.com/repos/basekick-labs/arc/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/arc/releases/download/v${LATEST_VERSION}/arc-${LATEST_VERSION}-1.x86_64.rpm
sudo rpm -U arc-${LATEST_VERSION}-1.x86_64.rpm
sudo systemctl restart arc
```

  </TabItem>
  <TabItem value="source" label="Source">

```bash
cd arc
git pull
make build
# Restart Arc manually
```

  </TabItem>
</Tabs>

## Uninstalling

<Tabs>
  <TabItem value="debian" label="Debian/Ubuntu" default>

```bash
sudo systemctl stop arc
sudo dpkg -r arc

# Optional: Remove data
sudo rm -rf /var/lib/arc /etc/arc
```

  </TabItem>
  <TabItem value="rhel" label="RHEL/Fedora">

```bash
sudo systemctl stop arc
sudo rpm -e arc

# Optional: Remove data
sudo rm -rf /var/lib/arc /etc/arc
```

  </TabItem>
</Tabs>

## Troubleshooting

### Arc Won't Start

```bash
# Check logs
sudo journalctl -u arc -n 50

# Check port availability
sudo lsof -i :8000
```

### Permission Errors

```bash
sudo mkdir -p /var/lib/arc/data
sudo chown -R arc:arc /var/lib/arc
```

### Memory Issues

Override in `/etc/arc/arc.toml`:

```toml
[database]
memory_limit = "4GB"
max_connections = 16
thread_count = 8
```

## Next Steps

- [Write your first data](/arc/getting-started#write-data)
- [Configure storage backends](/arc/configuration/overview)
- [Deploy on Kubernetes](/arc/installation/kubernetes)
- [Set up compaction](/arc/advanced/compaction)
