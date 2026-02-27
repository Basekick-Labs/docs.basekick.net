---
sidebar_position: 1
---

# Apache Superset Integration

Connect Arc to Apache Superset for interactive dashboards and visualizations.

## Overview

Arc provides a native SQLAlchemy dialect for Apache Superset, enabling:
- Full SQL query support via DuckDB
- Multi-database schema support
- Cross-database joins
- Time-series visualizations
- Interactive dashboards

## Installation

### Option 1: Install in Existing Superset

```bash
# Activate Superset environment
source venv/bin/activate

# Install Arc dialect
pip install arc-superset-dialect
```

### Option 2: Docker with Arc Pre-configured

```bash
# Clone Arc Superset dialect repo
git clone https://github.com/basekick-labs/arc-superset-dialect.git
cd arc-superset-dialect

# Build and run
docker build -t superset-arc .
docker run -d \
  -p 8088:8088 \
  --name superset-arc \
  superset-arc
```

Access Superset at `http://localhost:8088` (admin/admin)

## Connecting to Arc

### 1. Add Database Connection

In Superset UI:
1. Click **Settings** → **Database Connections**
2. Click **+ Database**
3. Select **Other** from database list
4. Enter connection string

### 2. Connection String Format

```
arc://{api_token}@{host}:{port}/{database}
```

**Example:**
```
arc://YourAPITokenHere@localhost:8000/default
```

### 3. Test Connection

Click **Test Connection** to verify Arc is reachable.

## Multi-Database Support

Arc databases appear as **schemas** in Superset:

```
Connection: arc://token@localhost:8000/default

Schemas available:
├── default
│   ├── cpu
│   ├── mem
│   └── disk
├── production
│   ├── cpu
│   └── mem
└── staging
    ├── cpu
    └── mem
```

### Querying Different Databases

```sql
-- Query default database
SELECT * FROM default.cpu LIMIT 10;

-- Query production database
SELECT * FROM production.cpu LIMIT 10;

-- Cross-database query
SELECT
    p.timestamp,
    p.host,
    p.usage_idle as prod_cpu,
    s.usage_idle as staging_cpu
FROM production.cpu p
JOIN staging.cpu s ON p.timestamp = s.timestamp AND p.host = s.host
WHERE p.timestamp > NOW() - INTERVAL 1 HOUR;
```

## Creating Charts

### Time-Series Line Chart

**SQL Query:**
```sql
SELECT
    time_bucket(INTERVAL '5 minutes', timestamp) as time,
    host,
    AVG(usage_idle) as avg_idle
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 6 HOUR
GROUP BY time, host
ORDER BY time DESC;
```

**Chart Configuration:**
- **Chart Type**: Line Chart
- **Time Column**: time
- **Metrics**: avg_idle
- **Group By**: host

### CPU vs Memory Correlation

**SQL Query:**
```sql
SELECT
    c.timestamp,
    c.host,
    c.usage_idle as cpu_idle,
    m.used_percent as mem_used
FROM default.cpu c
JOIN default.mem m ON c.timestamp = m.timestamp AND c.host = m.host
WHERE c.timestamp > NOW() - INTERVAL 1 HOUR
ORDER BY c.timestamp DESC;
```

**Chart Configuration:**
- **Chart Type**: Mixed Chart (Line + Bar)
- **X-axis**: timestamp
- **Y-axis 1**: cpu_idle
- **Y-axis 2**: mem_used

### Top Hosts by CPU Usage

**SQL Query:**
```sql
SELECT
    host,
    AVG(usage_user + usage_system) as avg_usage,
    MAX(usage_user + usage_system) as max_usage
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY host
ORDER BY avg_usage DESC
LIMIT 10;
```

**Chart Configuration:**
- **Chart Type**: Bar Chart
- **X-axis**: host
- **Y-axis**: avg_usage
- **Sort**: Descending

### Heatmap - Host Activity

**SQL Query:**
```sql
SELECT
    DATE_TRUNC('hour', timestamp) as hour,
    host,
    AVG(100 - usage_idle) as cpu_activity
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 7 DAY
GROUP BY hour, host;
```

**Chart Configuration:**
- **Chart Type**: Heatmap
- **X-axis**: hour
- **Y-axis**: host
- **Color**: cpu_activity

## Creating Dashboards

### 1. Create Dashboard

1. Click **Dashboards** → **+ Dashboard**
2. Name it: "System Monitoring"
3. Click **Edit Dashboard**

### 2. Add Charts

Drag and drop charts from the chart list or create new ones.

### 3. Add Filters

```sql
-- Host filter
SELECT DISTINCT host FROM default.cpu ORDER BY host;

-- Time range filter
-- Use Superset's built-in time range filter
```

### 4. Dashboard Layout

Example monitoring dashboard layout:

```
┌─────────────────────────────────────────┐
│  System Overview - Last 24 Hours        │
├─────────────────┬───────────────────────┤
│                 │                       │
│  CPU Usage      │  Memory Usage         │
│  (Line Chart)   │  (Line Chart)         │
│                 │                       │
├─────────────────┼───────────────────────┤
│                 │                       │
│  Top 10 Hosts   │  Disk I/O             │
│  (Bar Chart)    │  (Area Chart)         │
│                 │                       │
├─────────────────┴───────────────────────┤
│                                         │
│  Host Activity Heatmap (7 days)         │
│  (Heatmap)                              │
│                                         │
└─────────────────────────────────────────┘
```

## Advanced Features

### Custom SQL

Superset supports full DuckDB SQL:

```sql
-- Window functions
SELECT
    timestamp,
    host,
    usage_idle,
    AVG(usage_idle) OVER (
        PARTITION BY host
        ORDER BY timestamp
        ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as moving_avg
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 1 HOUR;

-- CTEs (Common Table Expressions)
WITH hourly_avg AS (
    SELECT
        DATE_TRUNC('hour', timestamp) as hour,
        host,
        AVG(usage_idle) as avg_idle
    FROM default.cpu
    WHERE timestamp > NOW() - INTERVAL 24 HOUR
    GROUP BY hour, host
)
SELECT * FROM hourly_avg
WHERE avg_idle < 50
ORDER BY hour DESC;

-- Percentiles
SELECT
    host,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY usage_idle) as p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY usage_idle) as p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY usage_idle) as p99
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY host;
```

### Alerts

Configure alerts in Superset:

1. Go to **Settings** → **Alerts & Reports**
2. Click **+ Alert**
3. Configure:
   - **Chart**: Select your chart
   - **Condition**: Greater than, Less than, etc.
   - **Threshold**: Value
   - **Recipients**: Email addresses
   - **Schedule**: Cron expression

**Example Alert - High CPU Usage:**
```sql
SELECT
    host,
    AVG(100 - usage_idle) as cpu_usage
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 5 MINUTE
GROUP BY host
HAVING AVG(100 - usage_idle) > 80;
```

Alert when query returns rows (CPU > 80%)

### Scheduled Reports

Email dashboards on a schedule:

1. Go to **Dashboards** → Your Dashboard
2. Click **...** → **Set up email report**
3. Configure:
   - **Recipients**: Email list
   - **Schedule**: Daily at 8 AM
   - **Format**: PNG or PDF

## Performance Tips

### 1. Use Time Filters

Always filter by time to reduce data scanned:

```sql
-- Good: Time filter
WHERE timestamp > NOW() - INTERVAL 24 HOUR

-- Bad: No filter (scans all data)
SELECT * FROM default.cpu
```

### 2. Limit Result Size

```sql
-- Add LIMIT to exploratory queries
SELECT * FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 1 HOUR
LIMIT 1000;
```

### 3. Enable Query Caching

In Arc's `arc.conf`:

```toml
[query_cache]
enabled = true
ttl_seconds = 300  # 5 minutes
```

Repeated queries return instantly from cache.

### 4. Use Materialized Queries

For slow dashboards, create materialized views:

```sql
-- Pre-aggregate data
CREATE TABLE default.cpu_hourly AS
SELECT
    DATE_TRUNC('hour', timestamp) as hour,
    host,
    AVG(usage_idle) as avg_idle,
    MAX(usage_idle) as max_idle,
    MIN(usage_idle) as min_idle
FROM default.cpu
GROUP BY hour, host;

-- Query materialized data
SELECT * FROM default.cpu_hourly
WHERE hour > NOW() - INTERVAL 7 DAY;
```

### 5. Optimize Chart SQL

```sql
-- Good: Aggregate first
SELECT
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(usage_idle) as avg_idle
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY hour;

-- Bad: Return all rows
SELECT timestamp, usage_idle
FROM default.cpu
WHERE timestamp > NOW() - INTERVAL 24 HOUR;
-- Then aggregate in Superset (slow)
```

## Troubleshooting

### Connection Refused

```bash
# Check Arc is running
curl http://localhost:8000/health

# Verify token
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/auth/verify
```

### No Schemas Showing

```sql
-- Verify databases exist
SHOW DATABASES;

-- Check tables in database
SHOW TABLES;
```

### Slow Queries

```bash
# Check compaction status
curl http://localhost:8000/api/compaction/status

# Manually trigger compaction
curl -X POST http://localhost:8000/api/compaction/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Token Expired

Create a new token:

```bash
# Docker
docker exec -it arc-api python3 -c "
from api.auth import AuthManager
auth = AuthManager(db_path='/data/arc.db')
token = auth.create_token('superset', description='Superset connection')
print(token)
"

# Native
python3 -c "
from api.auth import AuthManager
auth = AuthManager(db_path='./data/arc.db')
token = auth.create_token('superset', description='Superset connection')
print(token)
"
```

Update connection string in Superset with new token.

## Example Dashboards

### System Monitoring Dashboard

**Queries Included:**
- CPU Usage by Host (last 24h)
- Memory Usage Trends
- Disk I/O Operations
- Network Traffic
- Top 10 Busiest Hosts
- System Health Heatmap

**Download:**
- [monitoring_dashboard.json](https://github.com/basekick-labs/arc-superset-dialect/examples/monitoring_dashboard.json)

### IoT Sensor Dashboard

**Queries Included:**
- Temperature Trends
- Sensor Online/Offline Status
- Alert History
- Anomaly Detection
- Geographic Distribution

**Download:**
- [iot_dashboard.json](https://github.com/basekick-labs/arc-superset-dialect/examples/iot_dashboard.json)

## Resources

- **[Arc Superset Dialect GitHub](https://github.com/basekick-labs/arc-superset-dialect)**
- **[PyPI Package](https://pypi.org/project/arc-superset-dialect/)**
- **[Superset Documentation](https://superset.apache.org/docs/intro)**
- **[DuckDB SQL Reference](https://duckdb.org/docs/sql/introduction)**

## Next Steps

- **[Query API Reference](/arc/api-reference/overview#querying)**
- **[SQL Query Guide](/arc/guides/querying)**
- **[Dashboard Examples](https://github.com/basekick-labs/arc-superset-dialect/examples)**
