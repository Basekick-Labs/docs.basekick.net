---
sidebar_position: 2
---

# Native Installation

Install Arc natively for **maximum performance**. Native deployment achieves **2.01M records/sec** (3.5x faster than Docker).

## Prerequisites

- Python 3.11 or higher
- 8GB RAM minimum, 16GB+ recommended
- 20GB disk space for storage
- macOS, Linux, or WSL2

## Quick Start

### One-Command Installation

```bash
# Clone and start Arc
git clone https://github.com/basekick-labs/arc.git
cd arc
./start.sh native
```

This script automatically:
- Detects your CPU cores and configures optimal workers (3x cores)
- Installs and configures MinIO
- Creates Python virtual environment
- Installs all dependencies
- Starts Arc API server

Arc API will be available at `http://localhost:8000`
MinIO Console at `http://localhost:9001`

## Manual Installation

### 1. Install Python Dependencies

```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Arc dependencies
pip install -r requirements.txt
```

### 2. Install MinIO (Optional - For Object Storage)

#### macOS

```bash
# Install via Homebrew
brew install minio/stable/minio minio/stable/mc

# Start MinIO
mkdir -p ~/minio/data
minio server ~/minio/data --console-address ":9001"
```

#### Linux

```bash
# Download and install
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Create data directory
mkdir -p ~/minio/data

# Start MinIO
minio server ~/minio/data --console-address ":9001"
```

#### Configure MinIO

```bash
# Install MinIO client
brew install minio/stable/mc  # macOS
# OR
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc && sudo mv mc /usr/local/bin/

# Configure alias
mc alias set local http://localhost:9000 minioadmin minioadmin123

# Create Arc bucket
mc mb local/arc
```

### 3. Configure Arc

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

**Recommended Settings** (`arc.conf`):

```toml
[server]
host = "0.0.0.0"
port = 8000
workers = 42  # 3x CPU cores for optimal performance (e.g., 14 cores × 3)

[auth]
enabled = true

[query_cache]
enabled = true
ttl_seconds = 60

# Option 1: Local filesystem (fastest)
[storage]
backend = "local"

[storage.local]
base_path = "./data/arc"
database = "default"

# Option 2: MinIO (for distributed deployments)
# [storage]
# backend = "minio"
#
# [storage.minio]
# endpoint = "http://localhost:9000"
# access_key = "minioadmin"
# secret_key = "minioadmin123"
# bucket = "arc"
# database = "default"
# use_ssl = false
```

### 4. Start Arc

```bash
# Activate virtual environment
source venv/bin/activate

# Start with optimal settings
uvicorn api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 42 \
  --loop uvloop \
  --http httptools

# Or use the start script
./start.sh native
```

### 5. Verify Installation

```bash
# Check health
curl http://localhost:8000/health

# Expected response
{
  "status": "healthy",
  "version": "0.1.0",
  "storage": "local"
}
```

## Performance Optimization

### 1. Worker Count

**Best Practice**: Set workers to **3x your CPU cores**

```bash
# Auto-detect and configure
./start.sh native

# Or manually
# For 14-core CPU: 14 × 3 = 42 workers
uvicorn api.main:app --workers 42
```

### 2. Use Performance Libraries

Arc automatically uses these high-performance libraries:

- **uvloop**: 2-4x faster event loop (Cython-based C implementation)
- **httptools**: 40% faster HTTP parser
- **orjson**: 20-50% faster JSON serialization (Rust + SIMD)

Install them explicitly if needed:

```bash
pip install uvloop httptools orjson
```

### 3. Storage Backend Selection

| Backend | Performance | Use Case |
|---------|-------------|----------|
| **Local NVMe** | 2.08M RPS | Maximum performance, single-node |
| **Local SSD** | 2.01M RPS | High performance, single-node |
| **MinIO** | 2.01M RPS | Distributed, multi-tenant |
| **AWS S3** | 1.5M RPS | Cloud, unlimited scale |

**Recommendation**:
- Development: Local filesystem
- Production (single-node): Local NVMe storage
- Production (distributed): MinIO

### 4. Buffer Configuration

Increase buffer sizes for higher throughput:

```toml
[ingestion]
buffer_size = 200000      # Up from 50,000 (4x fewer files)
buffer_age_seconds = 10   # Up from 5 (2x fewer files)
```

**Impact**:
- Throughput: +15-20%
- Memory usage: +300MB per worker
- Query freshness: 5s → 10s delay

### 5. System Tuning

#### Linux

```bash
# Increase open file limits
sudo nano /etc/security/limits.conf
# Add:
* soft nofile 65536
* hard nofile 65536

# Increase network buffers
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728

# TCP tuning
sudo sysctl -w net.ipv4.tcp_rmem="4096 87380 134217728"
sudo sysctl -w net.ipv4.tcp_wmem="4096 65536 134217728"
```

#### macOS

```bash
# Increase open file limits
sudo launchctl limit maxfiles 65536 200000
ulimit -n 65536
```

## Production Deployment

### systemd Service (Linux)

Create `/etc/systemd/system/arc-api.service`:

```ini
[Unit]
Description=Arc Time-Series Database API
After=network.target

[Service]
Type=simple
User=arc
Group=arc
WorkingDirectory=/opt/arc
Environment="PATH=/opt/arc/venv/bin"
ExecStart=/opt/arc/venv/bin/uvicorn api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 42 \
  --loop uvloop \
  --http httptools
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arc-api

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
# Create arc user
sudo useradd -r -s /bin/false arc
sudo chown -R arc:arc /opt/arc

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable arc-api
sudo systemctl start arc-api

# Check status
sudo systemctl status arc-api

# View logs
sudo journalctl -u arc-api -f
```

### Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'arc-api',
    script: 'venv/bin/uvicorn',
    args: 'api.main:app --host 0.0.0.0 --port 8000 --workers 42',
    cwd: '/opt/arc',
    interpreter: 'none',
    watch: false,
    max_memory_restart: '4G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# Start Arc
pm2 start ecosystem.config.js

# Save configuration
pm2 save
pm2 startup
```

### Supervisor

Create `/etc/supervisor/conf.d/arc-api.conf`:

```ini
[program:arc-api]
command=/opt/arc/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 42
directory=/opt/arc
user=arc
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/arc/api.log
environment=PATH="/opt/arc/venv/bin"
```

Start:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start arc-api
```

## Remote Deployment

Deploy Arc to a remote server:

```bash
# Docker deployment
./deploy.sh -h your-server.com -u ubuntu -m docker

# Native deployment (recommended)
./deploy.sh -h your-server.com -u ubuntu -m native
```

The deployment script:
- Copies files via rsync
- Installs dependencies
- Configures systemd service
- Starts Arc automatically

## Storage Options

### Local Filesystem

```toml
[storage]
backend = "local"

[storage.local]
base_path = "/mnt/nvme/arc-data"  # Use NVMe for best performance
database = "default"
```

### MinIO

```toml
[storage]
backend = "minio"

[storage.minio]
endpoint = "http://localhost:9000"
access_key = "minioadmin"
secret_key = "minioadmin123"
bucket = "arc"
database = "default"
use_ssl = false
```

### AWS S3

```toml
[storage]
backend = "s3"

[storage.s3]
bucket = "arc-data"
region = "us-east-1"
access_key = "YOUR_ACCESS_KEY"
secret_key = "YOUR_SECRET_KEY"
database = "default"
```

### Google Cloud Storage

```toml
[storage]
backend = "gcs"

[storage.gcs]
bucket = "arc-data"
project_id = "my-project"
credentials_file = "/path/to/service-account.json"
database = "default"
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill process
kill -9 <PID>
```

### Python Version Issues

```bash
# Install Python 3.11
sudo apt install python3.11 python3.11-venv  # Ubuntu/Debian
brew install python@3.11                      # macOS

# Verify version
python3.11 --version
```

### MinIO Connection Failed

```bash
# Check MinIO is running
ps aux | grep minio

# Test connection
curl http://localhost:9000/minio/health/live

# Restart MinIO
killall minio
minio server ~/minio/data --console-address ":9001"
```

### Import Errors

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

### Performance Issues

```bash
# Check worker count (should be 3x CPU cores)
ps aux | grep uvicorn | wc -l

# Monitor resources
htop

# Check logs
tail -f logs/arc-api.log
```

## Next Steps

- **[Configure authentication](/configuration/authentication)**
- **[Set up monitoring](/operations/monitoring)**
- **[Enable WAL for durability](/advanced/wal)**
- **[Configure compaction](/advanced/compaction)**
- **[Integrate with Telegraf](/integrations/telegraf)**
