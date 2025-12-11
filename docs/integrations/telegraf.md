---
sidebar_position: 2
---

# Telegraf Integration

Use Telegraf to collect system metrics and send them directly to Arc using the native Arc output plugin.

## Overview

Arc provides a native Telegraf output plugin that sends metrics in MessagePack columnar format for maximum performance. The plugin supports gzip compression and integrates seamlessly with Arc's multi-database architecture.

**Benefits:**
- Native MessagePack columnar format (9.47M records/sec)
- Built-in gzip compression
- Direct database targeting
- All 300+ Telegraf input plugins supported
- Full SQL analytics with DuckDB

## Prerequisites

- **Telegraf 1.37 or higher** (required for Arc output plugin)
- Arc server running and accessible
- Arc API token

## Quick Start

### 1. Install Telegraf

```bash
# Ubuntu/Debian
wget -qO- https://repos.influxdata.com/influxdb.key | sudo apt-key add -
echo "deb https://repos.influxdata.com/ubuntu focal stable" | sudo tee /etc/apt/sources.list.d/influxdb.list
sudo apt update && sudo apt install telegraf

# macOS
brew install telegraf

# Or download from https://portal.influxdata.com/downloads/
```

Verify you have Telegraf 1.37+:

```bash
telegraf --version
```

### 2. Configure Telegraf for Arc

Edit `/etc/telegraf/telegraf.conf`:

```toml
# Arc Output Plugin
[[outputs.arc]]
  # Arc MessagePack endpoint
  url = "http://localhost:8000/api/v1/write/msgpack"

  # Arc API token
  api_key = "ARC_TOKEN"

  # Enable gzip compression (recommended)
  content_encoding = "gzip"

  # Target database in Arc
  database = "telegraf"
```

### 3. Enable Input Plugins

```toml
# System metrics
[[inputs.cpu]]
  percpu = true
  totalcpu = true
  collect_cpu_time = false
  report_active = false

[[inputs.disk]]
  ignore_fs = ["tmpfs", "devtmpfs", "devfs", "iso9660", "overlay", "aufs", "squashfs"]

[[inputs.mem]]

[[inputs.net]]
  interfaces = ["eth*", "en*"]

[[inputs.processes]]

[[inputs.swap]]

[[inputs.system]]
```

### 4. Start Telegraf

```bash
# Start service
sudo systemctl start telegraf

# Enable on boot
sudo systemctl enable telegraf

# Check status
sudo systemctl status telegraf

# View logs
sudo journalctl -u telegraf -f
```

### 5. Verify Data in Arc

```bash
# Check measurements
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SHOW TABLES FROM telegraf", "format": "json"}'

# Query CPU data
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM telegraf.cpu ORDER BY time DESC LIMIT 10", "format": "json"}'
```

## Configuration Examples

### Minimal Configuration

```toml
[agent]
  interval = "10s"
  flush_interval = "10s"

[[outputs.arc]]
  url = "http://localhost:8000/api/v1/write/msgpack"
  api_key = "YOUR_ARC_TOKEN"
  content_encoding = "gzip"
  database = "telegraf"

[[inputs.cpu]]
[[inputs.mem]]
[[inputs.disk]]
```

### High-Performance Configuration

```toml
[agent]
  interval = "10s"
  flush_interval = "10s"
  metric_batch_size = 5000     # Larger batches for higher throughput
  metric_buffer_limit = 50000  # Buffer more metrics

[[outputs.arc]]
  url = "http://localhost:8000/api/v1/write/msgpack"
  api_key = "YOUR_ARC_TOKEN"
  content_encoding = "gzip"
  database = "metrics"

# Enable all system metrics
[[inputs.cpu]]
  percpu = true
  totalcpu = true

[[inputs.disk]]
[[inputs.mem]]
[[inputs.net]]
[[inputs.processes]]
[[inputs.swap]]
[[inputs.system]]
[[inputs.kernel]]
[[inputs.diskio]]
```

### Multi-Environment Configuration

```toml
# Production metrics → production database
[[outputs.arc]]
  url = "https://arc-prod.example.com/api/v1/write/msgpack"
  api_key = "PROD_TOKEN"
  content_encoding = "gzip"
  database = "production"

# Staging metrics → staging database
[[outputs.arc]]
  url = "https://arc-staging.example.com/api/v1/write/msgpack"
  api_key = "STAGING_TOKEN"
  content_encoding = "gzip"
  database = "staging"
```

## Available Input Plugins

### System Metrics

```toml
# CPU usage by core
[[inputs.cpu]]
  percpu = true
  totalcpu = true

# Memory usage
[[inputs.mem]]

# Disk usage and I/O
[[inputs.disk]]
[[inputs.diskio]]

# Network statistics
[[inputs.net]]

# Process information
[[inputs.processes]]

# System load
[[inputs.system]]

# Kernel statistics
[[inputs.kernel]]

# Swap usage
[[inputs.swap]]
```

### Docker Monitoring

```toml
[[inputs.docker]]
  endpoint = "unix:///var/run/docker.sock"
  gather_services = false
  container_names = []
  timeout = "5s"
  perdevice = true
  total = true
```

### PostgreSQL Monitoring

```toml
[[inputs.postgresql]]
  address = "postgres://user:pass@localhost/dbname?sslmode=disable"
  databases = ["mydb"]
```

### Redis Monitoring

```toml
[[inputs.redis]]
  servers = ["tcp://localhost:6379"]
```

### NGINX Monitoring

```toml
[[inputs.nginx]]
  urls = ["http://localhost/nginx_status"]
```

### HTTP Response Time

```toml
[[inputs.http_response]]
  urls = [
    "https://example.com",
    "https://api.example.com/health"
  ]
  method = "GET"
  response_timeout = "5s"
  follow_redirects = true
```

### Custom Exec Plugin

```toml
[[inputs.exec]]
  commands = ["/usr/local/bin/custom_metrics.sh"]
  timeout = "5s"
  data_format = "influx"
```

## Querying Telegraf Data in Arc

### View Available Measurements

```sql
SHOW TABLES FROM telegraf;
```

**Common measurements from Telegraf:**
- `cpu` - CPU usage per core
- `mem` - Memory statistics
- `disk` - Disk usage
- `diskio` - Disk I/O stats
- `net` - Network statistics
- `processes` - Process counts
- `system` - System load
- `docker` - Container metrics

### CPU Usage Analysis

```sql
-- Average CPU usage by host (last hour)
SELECT
    time_bucket(INTERVAL '5 minutes', time) as bucket,
    host,
    AVG(usage_user + usage_system) as avg_usage
FROM telegraf.cpu
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket, host
ORDER BY bucket DESC;

-- Highest CPU usage instances
SELECT
    host,
    cpu,
    MAX(usage_user + usage_system) as max_usage
FROM telegraf.cpu
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY host, cpu
ORDER BY max_usage DESC
LIMIT 10;
```

### Memory Analysis

```sql
-- Memory usage trend
SELECT
    time_bucket(INTERVAL '1 hour', time) as hour,
    host,
    AVG(used_percent) as avg_mem_usage
FROM telegraf.mem
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY hour, host
ORDER BY hour DESC;

-- Hosts with high memory usage
SELECT
    host,
    AVG(used_percent) as avg_usage,
    MAX(used_percent) as max_usage
FROM telegraf.mem
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY host
HAVING AVG(used_percent) > 80
ORDER BY avg_usage DESC;
```

### Disk Analysis

```sql
-- Disk usage by mount point
SELECT
    host,
    path,
    AVG(used_percent) as avg_usage
FROM telegraf.disk
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY host, path
ORDER BY avg_usage DESC;

-- Disk I/O operations
SELECT
    time_bucket(INTERVAL '5 minutes', time) as bucket,
    name,
    SUM(reads) as total_reads,
    SUM(writes) as total_writes
FROM telegraf.diskio
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket, name
ORDER BY bucket DESC;
```

### Network Analysis

```sql
-- Network throughput
SELECT
    time_bucket(INTERVAL '5 minutes', time) as bucket,
    interface,
    SUM(bytes_sent) / (5 * 60) as bytes_sent_per_sec,
    SUM(bytes_recv) / (5 * 60) as bytes_recv_per_sec
FROM telegraf.net
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket, interface
ORDER BY bucket DESC;
```

### Docker Container Monitoring

```sql
-- Container CPU usage
SELECT
    time_bucket(INTERVAL '5 minutes', time) as bucket,
    container_name,
    AVG(usage_percent) as avg_cpu
FROM telegraf.docker_container_cpu
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket, container_name
ORDER BY bucket DESC;

-- Container memory usage
SELECT
    container_name,
    AVG(usage) as avg_memory_bytes,
    MAX(usage) as max_memory_bytes
FROM telegraf.docker_container_mem
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY container_name
ORDER BY avg_memory_bytes DESC;
```

## Performance Tuning

### Optimize Batch Size

```toml
[agent]
  metric_batch_size = 5000     # Send 5000 metrics per request
  metric_buffer_limit = 50000  # Buffer 50k metrics before dropping
```

**Guidelines:**
- **Low volume** (&lt;1000 metrics/sec): batch_size = 1000
- **Medium volume** (1000-10000/sec): batch_size = 5000
- **High volume** (&gt;10000/sec): batch_size = 10000

### Collection Intervals

```toml
[agent]
  interval = "10s"       # Collect every 10 seconds
  flush_interval = "10s" # Send every 10 seconds
```

For real-time monitoring, use smaller intervals (5s). For cost optimization, use larger intervals (60s).

### Enable Compression

Always use gzip compression for better network efficiency:

```toml
[[outputs.arc]]
  content_encoding = "gzip"  # Compress payloads
```

## Troubleshooting

### Telegraf Can't Connect to Arc

```bash
# Test Arc connectivity
curl http://localhost:8000/health

# Test with token
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT 1", "format": "json"}'

# Check Telegraf logs
sudo journalctl -u telegraf -f | grep -i error
```

### No Data Appearing

```bash
# Verify Telegraf is running
sudo systemctl status telegraf

# Check Telegraf config syntax
telegraf --config /etc/telegraf/telegraf.conf --test

# Check Arc received data
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM telegraf.cpu", "format": "json"}'
```

### Authentication Errors

Ensure your API key is correct in the configuration:

```toml
[[outputs.arc]]
  api_key = "YOUR_ARC_TOKEN"  # Must be a valid Arc API token
```

### Metrics Being Dropped

```bash
# Increase buffer
[agent]
  metric_buffer_limit = 100000  # Increase from default

# Check Arc health
curl http://localhost:8000/health
```

### Version Check

The Arc output plugin requires Telegraf 1.37+:

```bash
telegraf --version
# Telegraf 1.37.0 (or higher required)
```

## Dashboard Integration

### Grafana with Arc

Use the [Arc Grafana datasource plugin](/arc/integrations/grafana) for native integration:

```
1. Install the Arc datasource from Grafana marketplace
2. Configure connection to your Arc instance
3. Use DuckDB SQL in your dashboard panels
```

See [Grafana Integration](/arc/integrations/grafana) for detailed setup instructions.

## Best Practices

### 1. Use Tags Efficiently

```toml
[global_tags]
  environment = "production"
  datacenter = "us-east-1"
  region = "us-east"
```

Tags enable powerful GROUP BY queries but increase cardinality.

### 2. Filter Unnecessary Metrics

```toml
[[inputs.cpu]]
  percpu = false  # Aggregate across CPUs
  totalcpu = true

[[inputs.disk]]
  ignore_fs = ["tmpfs", "devtmpfs"]  # Skip temporary filesystems
```

### 3. Use Measurement Filters

```toml
[[outputs.arc]]
  namepass = ["cpu*", "mem*", "disk*"]  # Only send specific metrics
  # OR
  namedrop = ["docker_*"]  # Exclude Docker metrics
```

### 4. Set Reasonable Collection Intervals

```toml
[[inputs.cpu]]
  interval = "10s"  # Fast-changing metrics

[[inputs.disk]]
  interval = "60s"  # Slow-changing metrics
```

## Resources

- **[Telegraf Documentation](https://docs.influxdata.com/telegraf/)**
- **[Telegraf Plugins](https://docs.influxdata.com/telegraf/latest/plugins/)**
- **[Arc Query Guide](/arc/guides/querying)**
- **[Arc Grafana Integration](/arc/integrations/grafana)**

## Next Steps

- **[Query Telegraf metrics](/arc/guides/querying)**
- **[Create Grafana dashboards](/arc/integrations/grafana)**
- **[Set up alerts](/arc/guides/alerting)**
- **[Optimize performance](/arc/configuration/performance)**
