---
sidebar_position: 2
---

# Grafana Integration

Connect Arc to Grafana for real-time monitoring, alerting, and beautiful visualizations using the Arc datasource plugin.

## Overview

The Arc datasource plugin for Grafana provides:
- **Apache Arrow Protocol**: High-performance columnar data transfer
- **Native SQL Support**: Full DuckDB SQL with syntax highlighting
- **Template Variables**: Dynamic dashboards with filters
- **Alerting**: Built-in alert rule support
- **Multi-database**: Query across different Arc databases
- **Real-time Dashboards**: Sub-second query performance

## Installation

### From Grafana Plugin Catalog

1. In Grafana, go to **Configuration** → **Plugins**
2. Search for **Arc**
3. Click **Install**
4. Restart Grafana if prompted

### From Release

```bash
# Download latest release
wget https://github.com/basekick-labs/grafana-arc-datasource/releases/download/v1.0.0/grafana-arc-datasource-1.0.0.zip

# Extract to Grafana plugins directory
unzip grafana-arc-datasource-1.0.0.zip -d /var/lib/grafana/plugins/

# Restart Grafana
systemctl restart grafana-server
```

### From Source

```bash
# Clone repository
git clone https://github.com/basekick-labs/grafana-arc-datasource
cd grafana-arc-datasource

# Install dependencies
npm install

# Build plugin
npm run build

# Build backend
mage -v

# Install to Grafana
cp -r dist /var/lib/grafana/plugins/grafana-arc-datasource
systemctl restart grafana-server
```

## Configuration

### 1. Add Data Source

1. In Grafana, go to **Configuration** → **Data sources**
2. Click **Add data source**
3. Search for and select **Arc**
4. Configure connection settings

### 2. Connection Settings

| Setting | Description | Required | Default |
|---------|-------------|----------|---------|
| **URL** | Arc API endpoint | Yes | `http://localhost:8000` |
| **API Key** | Authentication token | Yes | - |
| **Database** | Default database name | No | `default` |
| **Timeout** | Query timeout in seconds | No | `30` |
| **Use Arrow** | Enable Apache Arrow protocol | No | `true` |

### 3. Example Configuration

```
URL:      http://localhost:8000
API Key:  arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Database: prod
Timeout:  30
```

Click **Save & Test** to verify the connection.

### 4. Get Your API Token

```bash
# Docker - check logs for admin token
docker logs <container-id> 2>&1 | grep "Admin token"

# Or create a new token specifically for Grafana
curl -X POST http://localhost:8000/api/v1/auth/tokens \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "grafana-datasource",
    "description": "Grafana datasource access"
  }'
```

## Creating Queries

### Query Editor

The Arc datasource provides a SQL query editor with:
- Syntax highlighting
- Auto-completion
- Time range macros
- Multi-database support

### Basic Query Example

**CPU Usage:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage,
  host
FROM prod.cpu
WHERE cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

### Time Macros

Grafana provides powerful time macros for dynamic queries:

| Macro | Description | Example |
|-------|-------------|---------|
| `$__timeFilter(columnName)` | Complete time range filter | `WHERE $__timeFilter(time)` |
| `$__timeFrom()` | Start of time range | `time >= $__timeFrom()` |
| `$__timeTo()` | End of time range | `time < $__timeTo()` |
| `$__interval` | Auto-calculated interval | `time_bucket(INTERVAL '$__interval', time)` |

**How macros expand:**

```sql
-- Your query
WHERE $__timeFilter(time)

-- Expands to
WHERE time >= '2025-01-17 10:00:00' AND time < '2025-01-17 11:00:00'
```

### Example Queries

**Memory Usage:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(used_percent) AS memory_used,
  host
FROM prod.mem
WHERE $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

**Network Traffic (bytes to bits):**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(bytes_recv) * 8 AS bits_in,
  AVG(bytes_sent) * 8 AS bits_out,
  host,
  interface
FROM prod.net
WHERE $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host, interface
ORDER BY time ASC
```

**Disk I/O:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(read_bytes) AS disk_read,
  AVG(write_bytes) AS disk_write,
  host
FROM prod.diskio
WHERE $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

## Template Variables

Create dynamic dashboards with variables that filter your data.

### Creating Variables

1. Go to **Dashboard settings** → **Variables**
2. Click **Add variable**
3. Configure variable settings

### Variable Examples

**Host Variable:**
```sql
SELECT DISTINCT host FROM prod.cpu ORDER BY host
```

**Interface Variable:**
```sql
SELECT DISTINCT interface FROM prod.net ORDER BY interface
```

**Database Variable:**
```sql
SELECT DISTINCT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
ORDER BY schema_name
```

### Using Variables in Queries

Reference variables with `$variable` syntax:

```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage
FROM $database.cpu
WHERE host = '$server'
  AND cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time)
ORDER BY time ASC
```

### Multi-Select Variables

Enable **Multi-value** in variable settings, then use `IN`:

```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage,
  host
FROM prod.cpu
WHERE host IN ($hosts)  -- Multi-select variable
  AND cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

## Alerting

The Arc datasource fully supports Grafana alerting.

### Creating Alert Rules

1. Open a panel with an Arc query
2. Go to **Alert** tab
3. Click **Create alert rule from this panel**
4. Configure alert conditions

### Example Alert Query

**High CPU Usage (> 80%):**
```sql
SELECT
  time,
  100 - usage_idle AS cpu_usage,
  host
FROM prod.cpu
WHERE cpu = 'cpu-total'
  AND time >= NOW() - INTERVAL '5 minutes'
ORDER BY time ASC
```

**Alert Condition:**
- `WHEN avg() OF query(A, 5m, now) IS ABOVE 80`

### Example Alert: Memory Usage

**Query:**
```sql
SELECT
  time,
  used_percent AS memory_used,
  host
FROM prod.mem
WHERE time >= NOW() - INTERVAL '5 minutes'
ORDER BY time ASC
```

**Alert Condition:**
- `WHEN avg() OF query(A, 5m, now) IS ABOVE 90`

### Alert Notifications

Configure notification channels:
1. Go to **Alerting** → **Contact points**
2. Add notification channel (Email, Slack, PagerDuty, etc.)
3. Link alert rules to notification channels

## Dashboard Examples

### System Monitoring Dashboard

Create a comprehensive system monitoring dashboard:

**Panels:**

1. **CPU Usage by Host** (Time series)
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(100 - usage_idle) AS cpu_usage,
  host
FROM prod.cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

2. **Memory Usage** (Time series)
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(used_percent) AS memory_used,
  host
FROM prod.mem
WHERE $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

3. **Disk Usage** (Gauge)
```sql
SELECT
  host,
  AVG(used_percent) AS disk_used
FROM prod.disk
WHERE $__timeFilter(time)
GROUP BY host
```

4. **Network Traffic** (Graph)
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  SUM(bytes_recv) * 8 / 1000000 AS mbps_in,
  SUM(bytes_sent) * 8 / 1000000 AS mbps_out,
  host
FROM prod.net
WHERE $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

5. **Top Hosts by CPU** (Bar gauge)
```sql
SELECT
  host,
  AVG(100 - usage_idle) AS avg_cpu
FROM prod.cpu
WHERE cpu = 'cpu-total'
  AND time >= NOW() - INTERVAL '1 hour'
GROUP BY host
ORDER BY avg_cpu DESC
LIMIT 10
```

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  System Overview - Last 24 Hours                │
│  [Host: All ▼] [Refresh: 30s ▼]                │
├───────────────────────┬─────────────────────────┤
│                       │                         │
│  CPU Usage            │  Memory Usage           │
│  (Time Series)        │  (Time Series)          │
│                       │                         │
├───────────────────────┼─────────────────────────┤
│                       │                         │
│  Network Traffic      │  Disk I/O               │
│  (Graph)              │  (Graph)                │
│                       │                         │
├───────────────────────┴─────────────────────────┤
│  Top 10 Hosts by CPU Usage (Bar Gauge)          │
└─────────────────────────────────────────────────┘
```

## Advanced Queries

### Window Functions

**Moving Average:**
```sql
SELECT
  time,
  usage_idle,
  host,
  AVG(usage_idle) OVER (
    PARTITION BY host
    ORDER BY time
    ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
  ) as moving_avg
FROM prod.cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
ORDER BY time ASC
```

### Percentiles

**CPU Usage Percentiles:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  host,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY usage_idle) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY usage_idle) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY usage_idle) as p99
FROM prod.cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
GROUP BY time_bucket(INTERVAL '$__interval', time), host
ORDER BY time ASC
```

### Cross-Database Queries

**Production vs Staging Comparison:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) as time,
  AVG(p.usage_idle) as prod_cpu_idle,
  AVG(s.usage_idle) as staging_cpu_idle
FROM prod.cpu p
JOIN staging.cpu s ON p.time = s.time AND p.host = s.host
WHERE p.cpu = 'cpu-total'
  AND s.cpu = 'cpu-total'
  AND $__timeFilter(p.time)
GROUP BY time_bucket(INTERVAL '$__interval', time)
ORDER BY time ASC
```

## Performance Optimization

### 1. Use Apache Arrow

Arrow protocol is enabled by default and provides significantly faster data transfer:

- **7.36x faster** than JSON for large result sets
- Zero-copy deserialization
- Columnar format perfect for time-series

### 2. Optimize Time Ranges

- Use Grafana's time picker to limit data scanned
- Add time filters with `$__timeFilter()`
- Avoid querying months of data for real-time dashboards

### 3. Leverage time_bucket()

Grafana automatically adjusts `$__interval` based on dashboard width:

```sql
-- Good: Automatic interval adjustment
time_bucket(INTERVAL '$__interval', time)

-- Bad: Fixed interval (too many points)
time_bucket(INTERVAL '1 second', time)
```

### 4. Use LIMIT for Exploration

```sql
SELECT * FROM prod.cpu
WHERE $__timeFilter(time)
LIMIT 1000  -- Limit result size
```

### 5. Enable Query Caching

In Grafana's data source settings:
- Enable **Cache timeout**: 60 seconds
- Repeated queries return instantly from cache

## Troubleshooting

### Plugin Not Appearing

```bash
# Check plugin directory permissions
ls -la /var/lib/grafana/plugins/grafana-arc-datasource

# Verify plugin.json exists
cat /var/lib/grafana/plugins/grafana-arc-datasource/plugin.json

# Check Grafana logs
tail -f /var/log/grafana/grafana.log

# Restart Grafana
systemctl restart grafana-server
```

### Connection Failed

```bash
# Verify Arc is running
curl http://localhost:8000/health

# Test API token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/v1/auth/verify

# Check network connectivity
ping localhost
```

### Query Errors

**"Table not found":**
```sql
-- List available tables
SHOW TABLES FROM prod;

-- Verify database exists
SHOW DATABASES;
```

**"Column not found":**
```sql
-- Describe table schema
DESCRIBE prod.cpu;
```

### Slow Queries

```bash
# Check Arc query performance
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "EXPLAIN SELECT * FROM prod.cpu WHERE time > NOW() - INTERVAL '\''1 hour'\''",
    "format": "json"
  }'

# Trigger compaction
curl -X POST http://localhost:8000/api/v1/compaction/trigger \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### Backend Plugin Issues

```bash
# Ensure backend binary is compiled
cd /path/to/grafana-arc-datasource
mage -v

# Check binary permissions
chmod +x dist/gpx_arc-datasource_*

# Verify Go version
go version  # Should be 1.21+
```

## Performance Tips

1. **Use Arrow Protocol**: Enabled by default, provides 7x faster data transfer
2. **Optimize Time Ranges**: Smaller ranges = faster queries
3. **Leverage time_bucket()**: Use `$__interval` for automatic aggregation
4. **Add Indexes**: Arc automatically indexes time columns
5. **Enable Caching**: Configure query caching in datasource settings
6. **Limit Result Size**: Use `LIMIT` for exploratory queries
7. **Use Variables**: Filter data with template variables instead of loading everything

## Resources

- **[Grafana Arc Datasource GitHub](https://github.com/basekick-labs/grafana-arc-datasource)**
- **[Grafana Documentation](https://grafana.com/docs/grafana/latest/)**
- **[Arc Query API](/arc/api-reference/overview#querying)**
- **[DuckDB SQL Reference](https://duckdb.org/docs/sql/introduction)**

## Next Steps

- **[Query API Reference](/arc/api-reference/overview)**
- **[Telegraf Integration](/arc/integrations/telegraf)** - Collect system metrics
- **[Apache Superset Integration](/arc/integrations/superset)** - BI dashboards
- **[Example Dashboards](https://github.com/basekick-labs/grafana-arc-datasource/tree/main/examples)**
