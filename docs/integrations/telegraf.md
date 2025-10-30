---
sidebar_position: 2
---

# Telegraf Integration

Use Telegraf to collect system metrics and send them to Arc as a drop-in InfluxDB replacement.

## Overview

Arc is compatible with InfluxDB Line Protocol, making it a perfect drop-in replacement for Telegraf outputs. Simply point your existing Telegraf configuration to Arc with zero code changes.

**Benefits:**
- No configuration changes needed
- All Telegraf plugins work unchanged
- 8x faster than InfluxDB (2.42M RPS)
- Lower cost with object storage
- Full SQL analytics with DuckDB

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

### 2. Configure Telegraf for Arc

Edit `/etc/telegraf/telegraf.conf`:

```toml
# InfluxDB Output Plugin (Arc compatible)
[[outputs.influxdb]]
  # Arc API endpoint
  urls = ["http://localhost:8000"]

  # Database name (becomes Arc database namespace)
  database = "telegraf"

  # Skip database creation (Arc creates on first write)
  skip_database_creation = true

  # Authentication - use Arc API token as password
  username = ""  # Leave empty
  password = "YOUR_ARC_API_TOKEN"

  # Alternative: Use HTTP headers (recommended)
  [outputs.influxdb.headers]
    Authorization = "Bearer YOUR_ARC_API_TOKEN"

  # Performance settings
  timeout = "5s"
  write_consistency = "any"
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
  -d '{"sql": "SHOW TABLES", "format": "json"}'

# Query CPU data
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"sql": "SELECT * FROM cpu ORDER BY time DESC LIMIT 10", "format": "json"}'
```

## Configuration Examples

### Minimal Configuration

```toml
[agent]
  interval = "10s"
  flush_interval = "10s"

[[outputs.influxdb]]
  urls = ["http://localhost:8000"]
  database = "telegraf"
  skip_database_creation = true
  password = "YOUR_ARC_TOKEN"

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

[[outputs.influxdb]]
  urls = ["http://localhost:8000"]
  database = "metrics"
  skip_database_creation = true

  [outputs.influxdb.headers]
    Authorization = "Bearer YOUR_ARC_TOKEN"

  # Performance tuning
  timeout = "10s"
  write_consistency = "any"
  max_retries = 3
  retry_interval = "1s"

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
[[outputs.influxdb]]
  urls = ["http://arc-prod.example.com:8000"]
  database = "production"

  [outputs.influxdb.headers]
    Authorization = "Bearer PROD_TOKEN"
    x-arc-database = "production"

# Staging metrics → staging database
[[outputs.influxdb]]
  urls = ["http://arc-staging.example.com:8000"]
  database = "staging"

  [outputs.influxdb.headers]
    Authorization = "Bearer STAGING_TOKEN"
    x-arc-database = "staging"
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
SHOW TABLES;
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
FROM cpu
WHERE time > NOW() - INTERVAL 1 HOUR
GROUP BY bucket, host
ORDER BY bucket DESC;

-- Highest CPU usage instances
SELECT
    host,
    cpu,
    MAX(usage_user + usage_system) as max_usage
FROM cpu
WHERE time > NOW() - INTERVAL 24 HOUR
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
FROM mem
WHERE time > NOW() - INTERVAL 7 DAY
GROUP BY hour, host
ORDER BY hour DESC;

-- Hosts with high memory usage
SELECT
    host,
    AVG(used_percent) as avg_usage,
    MAX(used_percent) as max_usage
FROM mem
WHERE time > NOW() - INTERVAL 24 HOUR
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
FROM disk
WHERE time > NOW() - INTERVAL 1 HOUR
GROUP BY host, path
ORDER BY avg_usage DESC;

-- Disk I/O operations
SELECT
    time_bucket(INTERVAL '5 minutes', time) as bucket,
    name,
    SUM(reads) as total_reads,
    SUM(writes) as total_writes
FROM diskio
WHERE time > NOW() - INTERVAL 1 HOUR
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
FROM net
WHERE time > NOW() - INTERVAL 1 HOUR
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
FROM docker_container_cpu
WHERE time > NOW() - INTERVAL 1 HOUR
GROUP BY bucket, container_name
ORDER BY bucket DESC;

-- Container memory usage
SELECT
    container_name,
    AVG(usage) as avg_memory_bytes,
    MAX(usage) as max_memory_bytes
FROM docker_container_mem
WHERE time > NOW() - INTERVAL 24 HOUR
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

### Reduce Flush Interval

```toml
[agent]
  interval = "10s"       # Collect every 10 seconds
  flush_interval = "10s" # Send every 10 seconds
```

For real-time monitoring, use smaller intervals (5s). For cost optimization, use larger intervals (60s).

### Use HTTP/2

```toml
[[outputs.influxdb]]
  urls = ["https://arc.example.com"]  # HTTPS enables HTTP/2
  http_proxy_override = "http://localhost:8888"
```

### Enable Compression

```toml
[[outputs.influxdb]]
  content_encoding = "gzip"  # Compress payloads
```

## Troubleshooting

### Telegraf Can't Connect to Arc

```bash
# Test Arc connectivity
curl http://localhost:8000/health

# Test with token
curl -X POST http://localhost:8000/api/v1/write \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "test,host=local value=1"

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
  -d '{"sql": "SELECT COUNT(*) FROM cpu", "format": "json"}'
```

### Authentication Errors

```toml
# Correct: Use headers
[outputs.influxdb.headers]
  Authorization = "Bearer YOUR_TOKEN"

# Wrong: Password without Bearer
password = "YOUR_TOKEN"

# Also correct: Password with Bearer
password = "Bearer YOUR_TOKEN"
```

### Metrics Being Dropped

```bash
# Check Telegraf metrics
curl http://localhost:8086/metrics | grep dropped

# Increase buffer
[agent]
  metric_buffer_limit = 100000  # Increase from default

# Check Arc health
curl http://localhost:8000/health
```

## Migration from InfluxDB

### 1. Update Connection

```toml
# Old InfluxDB configuration
[[outputs.influxdb]]
  urls = ["http://influxdb:8086"]
  database = "telegraf"

# New Arc configuration
[[outputs.influxdb]]
  urls = ["http://arc:8000"]
  database = "telegraf"
  skip_database_creation = true
  [outputs.influxdb.headers]
    Authorization = "Bearer YOUR_ARC_TOKEN"
```

### 2. Keep InfluxDB Queries Working

Arc supports most InfluxDB queries via DuckDB:

```sql
-- InfluxDB
SELECT mean("usage_idle") FROM "cpu" WHERE time > now() - 1h GROUP BY time(5m)

-- Arc (DuckDB SQL)
SELECT
    time_bucket(INTERVAL '5 minutes', time) as time,
    AVG(usage_idle) as mean_usage_idle
FROM cpu
WHERE time > NOW() - INTERVAL 1 HOUR
GROUP BY time
ORDER BY time;
```

### 3. Migrate Historical Data

Use Arc's import tools:

```bash
# Export from InfluxDB
influx -execute "SELECT * FROM cpu" -format csv > cpu.csv

# Import to Arc
python3 import_csv.py --file cpu.csv --measurement cpu
```

## Example Dashboard Integration

### Grafana with Arc

```yaml
# datasource.yml
apiVersion: 1

datasources:
  - name: Arc
    type: postgres  # Use PostgreSQL datasource
    url: arc:8000
    database: telegraf
    user: ""
    jsonData:
      postgresVersion: 1300
      sslmode: disable
    secureJsonData:
      password: "YOUR_ARC_TOKEN"
```

**Note:** Use [Arc Superset dialect](/arc/integrations/superset) for native Arc support.

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

### 3. Use Measurement Prefixes

```toml
[outputs.influxdb]
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
- **[InfluxDB Line Protocol](/arc/api-reference/ingestion#line-protocol)**

## Next Steps

- **[Query Telegraf metrics](/arc/guides/querying)**
- **[Create Superset dashboards](/arc/integrations/superset)**
- **[Set up alerts](/arc/guides/alerting)**
- **[Optimize performance](/arc/configuration/performance)**
