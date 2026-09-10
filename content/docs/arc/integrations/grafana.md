---
title: "Grafana Integration"
description: "Connect Grafana to Arc with the Arc data source plugin: install the plugin, add the connection and its token, and build dashboard panels from SQL against your measurements."
---

Connect Arc to Grafana for real-time monitoring, alerting, and beautiful visualizations using the Arc datasource plugin.

## Overview

The Arc datasource plugin for Grafana provides:
- **Apache Arrow Protocol**: High-performance columnar data transfer
- **Native SQL Support**: Full analytical SQL with syntax highlighting
- **Template Variables**: Dynamic dashboards with filters
- **Alerting**: Built-in alert rule support
- **Multi-database**: Query across different Arc databases
- **Real-time Dashboards**: Sub-second query performance

## Installation

### From Grafana plugin catalog

1. In Grafana, go to **Configuration** → **Plugins**
2. Search for **Arc**
3. Click **Install**
4. Restart Grafana if prompted

### From release

```bash
# Resolve the latest release tag, then download the matching plugin archive
LATEST=$(curl -s https://api.github.com/repos/basekick-labs/grafana-arc-datasource/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/grafana-arc-datasource/releases/download/v${LATEST}/basekick-arc-datasource-${LATEST}.zip

# Extract to Grafana plugins directory
unzip basekick-arc-datasource-${LATEST}.zip -d /var/lib/grafana/plugins/

# Restart Grafana
systemctl restart grafana-server
```

### From source

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
cp -r dist /var/lib/grafana/plugins/basekick-arc-datasource
systemctl restart grafana-server
```

## Configuration

### 1. Add data source

1. In Grafana, go to **Configuration** → **Data sources**
2. Click **Add data source**
3. Search for and select **Arc**
4. Configure connection settings

### 2. Connection settings

| Setting | Description | Required | Default |
|---------|-------------|----------|---------|
| **URL** | Arc API endpoint | Yes | `http://localhost:8000` |
| **API Key** | Authentication token | Yes | - |
| **Database** | Default database name | No | `default` |
| **Timeout** | Query timeout in seconds | No | `30` |
| **Protocol** | Wire format: `Arrow`, `MessagePack`, or `JSON` | No | `Arrow` |
| **Max Concurrency** | Parallel chunks when a query is split (max `32`) | No | `4` |
| **Max Response MB** | Per-response body cap, in MiB (max `8192`) | No | `1024` |
| **Allow Private IPs** | Permit an Arc URL that resolves to a private or loopback address | No | `false` |
| **Allow Database Override** | Permit a panel to target a different database than the datasource default | No | `false` |

**Arrow** is the fastest and is recommended; **MessagePack** is stable as of
Arc 26.09.1; **JSON** is a compatibility fallback. (Datasources saved by
older plugin versions used a **Use Arrow** switch, which the Protocol
selector supersedes — the saved choice is preserved.)

<Callout type="warn" title="Arc on a private network">
**Allow Private IPs** is off by default: the plugin refuses datasource URLs
that resolve to private or loopback addresses, so that users who can create
datasources cannot point Grafana at internal services. Turn it on when Arc
runs on an internal network or in Docker (`http://arc:8000`), or every query
fails with `destination address is not permitted`. A `localhost` URL is
always allowed, so local development never needs this.
</Callout>

<Callout type="warn" title="Database override and token scope">
**Allow Database Override** lets a dashboard editor query databases other
than the configured default. Enable it only when the API key's scope already
matches what those editors are allowed to see — otherwise the datasource
becomes a way to read databases through a token they do not hold.
</Callout>

### 3. Example configuration

```text
URL:      http://localhost:8000
API Key:  arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Database: prod
Timeout:  30
```

Click **Save & Test** to verify the connection.

### 4. Get your API token

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

## Creating queries

### Query editor

The Arc datasource provides a SQL query editor with:
- Syntax highlighting
- Auto-completion
- Time range macros
- Multi-database support

Each panel also carries:

| Option | Description | Default |
|--------|-------------|---------|
| **Format** | `Time series` or `Table` | `Time series` |
| **Database** | Query a different database than the datasource default (requires **Allow Database Override**) | datasource default |
| **Splitting** | Break a long time range into chunks queried in parallel: `Auto`, `Off`, or `1 hour`-`7 days` | `Auto` |

Splitting speeds up wide time ranges. `Auto` does not split ranges shorter
than three hours. The plugin also turns splitting off by itself wherever it
would change results — queries with `LIMIT`, `UNION`, an aggregation without
`$__timeGroup`, or timezone-aware bucketing (`$__timezone`, or `$__timeGroup`
on a non-UTC dashboard), since chunk boundaries are computed in UTC and would
cut a local day in two.

### Basic query example

**CPU Usage:**
```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage,
  host
FROM prod.cpu
WHERE cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
ORDER BY time ASC
```

### Time macros

Grafana provides powerful time macros for dynamic queries:

| Macro | Description | Example |
|-------|-------------|---------|
| `$__timeFilter(columnName)` | Complete time range filter | `WHERE $__timeFilter(time)` |
| `$__timeFrom()` | Start of time range | `time >= $__timeFrom()` |
| `$__timeTo()` | End of time range | `time < $__timeTo()` |
| `$__interval` | Bucket size chosen from the selected time range | `$__timeGroup(time, '$__interval')` |
| `$__timeGroup(columnName, interval)` | Time bucket, aligned to the dashboard's timezone | `$__timeGroup(time, '1d') AS time` |
| `$__timezone` | The dashboard's timezone, as a quoted IANA name | `timezone($__timezone, time)` |

**How macros expand:**

```sql
-- Your query
WHERE $__timeFilter(time)

-- Expands to (the range is always sent in UTC)
WHERE time >= '2025-01-17T10:00:00Z' AND time < '2025-01-17T11:00:00Z'
```

`$__timeGroup` accepts `1s`, `5s`, `10s`, `30s`, `1m`, `5m`, `10m`, `15m`,
`30m`, `1h`, `6h`, `12h`, `1d` and `1w`, in short or long form (`'10m'` or
`'10 minutes'`). `1w` is a **calendar** week and starts on Monday. An
unrecognised interval is left unexpanded, so Arc returns a clear error rather
than silently bucketing differently.

### Timezone-aware bucketing

Arc stores and returns timestamps in UTC, and Grafana renders them in the
dashboard's timezone. Anything that groups by **day or larger** has to bucket
in that timezone too — otherwise a "day" starts at 00:00 UTC, which in UTC-6
is 18:00 the previous evening, and every bar mixes two local calendar days.

`$__timeGroup` handles this for you:

```sql
SELECT
  $__timeGroup(time, '1d') AS time,
  COUNT(DISTINCT host) AS active_hosts
FROM prod.cpu
WHERE $__timeFilter(time)
GROUP BY 1
ORDER BY 1
```

Only whole calendar units are timezone-aware: `1h`, `1d` and `1w` truncate in
the dashboard's timezone, which stays correct across DST transitions (a local
day is not always 24 hours). Every other interval — including `6h` and `12h`,
which are not whole calendar units — buckets on fixed epoch arithmetic in UTC.

Because the macro follows the dashboard's own setting, including **Browser
Time**, a shared dashboard is correct for every viewer without hardcoding a
zone. It applies to template-variable queries too. An unrecognised timezone
falls back to UTC.

<Callout type="warn" title="Alert rules always bucket in UTC">
Grafana evaluates alert and recording rules on the server, without a
dashboard, so no timezone is sent and bucketing falls back to UTC. A panel
and an alert built on the same query can therefore group differently. Pin the
zone explicitly in alert queries — `timezone('America/Costa_Rica', ...)` —
where the boundary matters.
</Callout>

For expressions `$__timeGroup` does not cover, `$__timezone` expands to the
zone as a quoted IANA name:

```sql
SELECT timezone($__timezone, date_trunc('month', timezone($__timezone, time))) AS time
```

<Callout type="warn" title="Prefer timezone() over AT TIME ZONE">
Use the `timezone(zone, ts)` function rather than the `ts AT TIME ZONE zone`
infix form. The infix form's direction depends on the operand's type, and
which of `TIMESTAMP`/`TIMESTAMPTZ` it returns differs between DuckDB builds,
so the same expression can silently shift buckets by the UTC offset.
</Callout>

<Callout type="info" title="Requires plugin v1.3.6+">
`$__timezone` and timezone-aware `$__timeGroup` were added in v1.3.3 and
corrected in v1.3.5; `1w` bucketing arrived in v1.3.6. On earlier versions
`$__timeGroup` always bucketed in UTC.
</Callout>

### Example queries

**Memory Usage:**
```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(used_percent) AS memory_used,
  host
FROM prod.mem
WHERE $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
ORDER BY time ASC
```

**Network Traffic (bytes to bits):**
```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(bytes_recv) * 8 AS bits_in,
  AVG(bytes_sent) * 8 AS bits_out,
  host,
  interface
FROM prod.net
WHERE $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host, interface
ORDER BY time ASC
```

**Disk I/O:**
```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(read_bytes) AS disk_read,
  AVG(write_bytes) AS disk_write,
  host
FROM prod.diskio
WHERE $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
ORDER BY time ASC
```

## Template variables

Create dynamic dashboards with variables that filter your data.

### Creating variables

1. Go to **Dashboard settings** → **Variables**
2. Click **Add variable**
3. Configure variable settings

### Variable examples

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

### Using variables in queries

Reference variables with `$variable` syntax:

```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage
FROM $database.cpu
WHERE host = '$server'
  AND cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval')
ORDER BY time ASC
```

### Multi-select variables

Enable **Multi-value** in variable settings, then use `IN`:

```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage,
  host
FROM prod.cpu
WHERE host IN ($hosts)  -- Multi-select variable
  AND cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
ORDER BY time ASC
```

## Alerting

The Arc datasource fully supports Grafana alerting.

### Creating alert rules

1. Open a panel with an Arc query
2. Go to **Alert** tab
3. Click **Create alert rule from this panel**
4. Configure alert conditions

### Example alert query

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

### Example alert: Memory usage

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

### Alert notifications

Configure notification channels:
1. Go to **Alerting** → **Contact points**
2. Add notification channel (Email, Slack, PagerDuty, etc.)
3. Link alert rules to notification channels

## Dashboard examples

### System monitoring dashboard

Create a comprehensive system monitoring dashboard:

**Panels:**

1. **CPU Usage by Host** (Time series)
```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(100 - usage_idle) AS cpu_usage,
  host
FROM prod.cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
ORDER BY time ASC
```

2. **Memory Usage** (Time series)
```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(used_percent) AS memory_used,
  host
FROM prod.mem
WHERE $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
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
  $__timeGroup(time, '$__interval') as time,
  SUM(bytes_recv) * 8 / 1000000 AS mbps_in,
  SUM(bytes_sent) * 8 / 1000000 AS mbps_out,
  host
FROM prod.net
WHERE $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
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

<!-- TODO(screenshot): a real Arc-backed Grafana dashboard with these four panels populated. The ASCII mock below conveys panel arrangement but not what the plugin's query editor, time picker, or rendered series actually look like — the thing a reader is trying to recognize on their own screen. -->

### Dashboard layout

```text
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

## Advanced queries

### Window functions

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
  $__timeGroup(time, '$__interval') as time,
  host,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY usage_idle) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY usage_idle) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY usage_idle) as p99
FROM prod.cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
GROUP BY $__timeGroup(time, '$__interval'), host
ORDER BY time ASC
```

### Cross-database queries

**Production vs Staging Comparison:**
```sql
SELECT
  $__timeGroup(time, '$__interval') as time,
  AVG(p.usage_idle) as prod_cpu_idle,
  AVG(s.usage_idle) as staging_cpu_idle
FROM prod.cpu p
JOIN staging.cpu s ON p.time = s.time AND p.host = s.host
WHERE p.cpu = 'cpu-total'
  AND s.cpu = 'cpu-total'
  AND $__timeFilter(p.time)
GROUP BY $__timeGroup(time, '$__interval')
ORDER BY time ASC
```

## Performance optimization

### 1. Use Apache Arrow

Arrow protocol is enabled by default and provides significantly faster data transfer:

- Substantially faster than JSON for large result sets
- Zero-copy deserialization
- Columnar format perfect for time-series

### 2. Optimize time ranges

- Use Grafana's time picker to limit data scanned
- Add time filters with `$__timeFilter()`
- Avoid querying months of data for real-time dashboards

### 3. Bucket with `$__timeGroup`

Grafana adjusts `$__interval` to the dashboard's width, so let it choose the
bucket size:

```sql
-- Good: interval follows the panel width
$__timeGroup(time, '$__interval')

-- Bad: fixed interval, far more points than the panel can show
$__timeGroup(time, '1s')
```

Prefer `$__timeGroup` over a bare `time_bucket(INTERVAL '$__interval', time)`:
`time_bucket` always buckets in UTC, so daily and weekly panels are misaligned
on any dashboard that is not set to UTC. See
[Timezone-aware bucketing](#timezone-aware-bucketing).

### 4. Use LIMIT for exploration

```sql
SELECT * FROM prod.cpu
WHERE $__timeFilter(time)
LIMIT 1000  -- Limit result size
```

### 5. Enable query caching

Grafana's query caching is an Enterprise/Cloud feature configured per data
source; it is not part of the Arc plugin. Where it is available, a short
cache timeout lets repeated dashboard loads skip Arc entirely.

## Troubleshooting

### Plugin not appearing

```bash
# Check plugin directory permissions
ls -la /var/lib/grafana/plugins/basekick-arc-datasource

# Verify plugin.json exists
cat /var/lib/grafana/plugins/basekick-arc-datasource/plugin.json

# Check Grafana logs
tail -f /var/log/grafana/grafana.log

# Restart Grafana
systemctl restart grafana-server
```

### Connection failed

```bash
# Verify Arc is running
curl http://localhost:8000/health

# Test API token
curl -H "Authorization: Bearer $ARC_TOKEN" \
  http://localhost:8000/api/v1/auth/verify

# Check network connectivity
ping localhost
```

### Blocked address

```text
Arc URL resolves to a blocked address (private/loopback).
destination address is not permitted
```

The plugin refuses datasource URLs resolving to private or loopback addresses
unless **Allow Private IPs** is enabled. Turn it on in the datasource settings
when Arc runs on an internal network or in Docker (for example
`http://arc:8000`). See [Connection settings](#2-connection-settings).

### Query errors

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

### Slow queries

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

### Backend plugin issues

```bash
# Ensure backend binary is compiled
cd /path/to/grafana-arc-datasource
mage -v

# Check binary permissions
chmod +x dist/gpx_arc-datasource_*

# Verify Go version
go version  # Should be 1.21+
```

## Performance tips

1. **Use Arrow Protocol**: Enabled by default, provides considerably faster data transfer
2. **Optimize Time Ranges**: Smaller ranges = faster queries
3. **Bucket with `$__timeGroup`**: pass `$__interval` so the bucket follows the time range
4. **Add Indexes**: Arc automatically indexes time columns
5. **Enable Caching**: Configure query caching in datasource settings
6. **Limit Result Size**: Use `LIMIT` for exploratory queries
7. **Use Variables**: Filter data with template variables instead of loading everything

## Resources

- **[Grafana Arc Datasource GitHub](https://github.com/basekick-labs/grafana-arc-datasource)**
- **[Grafana Documentation](https://grafana.com/docs/grafana/latest/)**
- **[Arc Query API](/arc/api-reference/overview/#querying)**
- **[DuckDB SQL Reference](https://duckdb.org/docs/sql/introduction)**

## Next steps

- **[Query API Reference](/arc/api-reference/overview/)**
- **[Telegraf Integration](/arc/integrations/telegraf/)** - Collect system metrics
- **[Apache Superset Integration](/arc/integrations/superset/)** - BI dashboards
