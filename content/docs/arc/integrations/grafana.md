---
title: "Grafana Integration"
description: "Connect Grafana to Arc with the Arc data source plugin: install the plugin, add the connection and its token, and build dashboard panels from SQL against your measurements."
---

Connect Arc to Grafana for real-time dashboards, alerting, and ad-hoc analysis, using the Arc data source plugin.

## Overview

The Arc data source plugin gives Grafana:

- **Three wire protocols** — Apache Arrow IPC (default), columnar MessagePack, and JSON
- **Native SQL** — full DuckDB analytical SQL, not a query builder
- **Grafana macros** — `$__timeFilter`, `$__timeGroup`, `$__interval` and friends
- **Timezone-aware bucketing** — daily and weekly buckets align to the dashboard's local calendar
- **Template variables** — dynamic dashboards with single- and multi-value filters
- **Alerting** — full support for Grafana alert rules
- **Query splitting** — long ranges are chunked and run in parallel, with automatic skipping where that would change results

## Requirements

- Grafana **12.3 or later**
- Arc reachable from the Grafana server
- An Arc API token

## Installation

The plugin is not yet in the Grafana plugin catalog, so install it from a release or from source. Because it is unsigned, Grafana must be told to load it.

### From a release

```bash
# Resolve the latest release tag, then download the matching plugin archive
LATEST=$(curl -s https://api.github.com/repos/basekick-labs/grafana-arc-datasource/releases/latest \
  | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/grafana-arc-datasource/releases/download/v${LATEST}/basekick-arc-datasource-${LATEST}.zip

# Extract into the Grafana plugins directory
unzip basekick-arc-datasource-${LATEST}.zip -d /var/lib/grafana/plugins/

systemctl restart grafana-server
```

### Allow the unsigned plugin

Grafana refuses to load unsigned plugins by default. Add the plugin ID to your configuration:

```ini
# /etc/grafana/grafana.ini
[plugins]
allow_loading_unsigned_plugins = basekick-arc-datasource
```

Or, with Docker:

```yaml
environment:
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: basekick-arc-datasource
```

Without this, the plugin is downloaded and ignored, and the data source never appears in the list.

### From source

```bash
git clone https://github.com/basekick-labs/grafana-arc-datasource
cd grafana-arc-datasource

npm install
npm run build     # frontend
mage -v           # backend (requires Go 1.26.6+)

cp -r dist /var/lib/grafana/plugins/basekick-arc-datasource
systemctl restart grafana-server
```

## Configuration

### 1. Add the data source

1. In Grafana, go to **Connections** → **Data sources**
2. Click **Add new data source**
3. Select **Arc**

### 2. Connection settings

| Setting | Description | Required | Default |
|---------|-------------|----------|---------|
| **URL** | Arc API endpoint | Yes | `http://localhost:8000` |
| **API Key** | Arc authentication token | Yes | — |
| **Database** | Default database for this data source | No | `default` |
| **Timeout** | Query timeout in seconds | No | `30` |
| **Protocol** | `Arrow`, `MessagePack`, or `JSON` | No | `Arrow` |
| **Max Concurrency** | Parallel chunks within one split query | No | `4` |
| **Max In Flight** | Simultaneous Arc requests for this data source | No | `32` |
| **Max Response MB** | Per-response size cap | No | `1024` |
| **Allow Private IPs** | Permit the URL to resolve to a private address | No | on |
| **Allow Database Override** | Permit a per-query database override | No | on |

**Allow Private IPs** is on because self-hosted Arc usually runs on a private network or a Docker service name such as `http://arc:8000`. Turn it off to require a public address. Link-local and cloud-metadata addresses are blocked either way.

Click **Save & test** to verify the connection.

### 3. Choosing a protocol

- **Arrow** decodes Arc's Arrow IPC stream directly and is the fastest option. Keep it unless you have a reason not to.
- **MessagePack** uses Arc's columnar msgpack endpoint. Slightly slower to decode, and it supports gzip compression, which helps on constrained links.
- **JSON** is the slowest path, kept for compatibility and debugging.

One practical difference: `SHOW DATABASES` and `SHOW TABLES` are **not supported on the Arrow endpoint**. If you want to use them in a template variable, set the data source to MessagePack or JSON, or query a table directly instead.

### 4. Get an API token

```bash
# Docker — the admin token is printed on first start
docker logs <container-id> 2>&1 | grep "Admin token"

# Or mint a token scoped to Grafana
curl -X POST http://localhost:8000/api/v1/auth/tokens \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "grafana-datasource",
    "description": "Grafana data source access"
  }'
```

Give Grafana a token scoped to what its dashboard viewers are allowed to read. Arc's token scope, not the plugin, is the authorization boundary.

## Writing queries

### Referring to tables

The data source's **Database** setting is sent with every query, so **write table names unqualified**:

```sql
-- Correct: the data source is configured with Database = telegraf
SELECT time, usage_idle FROM cpu WHERE $__timeFilter(time)
```

```sql
-- Rejected: "Cross-database queries (db.table syntax) not allowed
-- when x-arc-database header is set"
SELECT time, usage_idle FROM telegraf.cpu WHERE $__timeFilter(time)
```

To query a different database from one panel, use the **Database** field in the query editor rather than a qualified name. That requires **Allow Database Override** on the data source.

### Basic query

```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) AS time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage,
  host
FROM cpu
WHERE cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY 1, host
ORDER BY time ASC
```

Set the panel's **Format** to **Time series** so Grafana treats the first column as the time axis.

### Macros

| Macro | Expands to | Example |
|-------|-----------|---------|
| `$__timeFilter(column)` | A range predicate on the column | `WHERE $__timeFilter(time)` |
| `$__timeFrom()` | Start of the dashboard range | `time >= $__timeFrom()` |
| `$__timeTo()` | End of the dashboard range | `time < $__timeTo()` |
| `$__interval` | An interval sized from the range | `time_bucket(INTERVAL '$__interval', time)` |
| `$__interval_ms` | The same interval in milliseconds | `SELECT $__interval_ms` |
| `$__timeGroup(column, interval)` | A timezone-aware time bucket | `$__timeGroup(time, '1d')` |

How they expand:

```sql
-- You write
WHERE $__timeFilter(time)

-- Arc receives
WHERE (time) >= '2026-01-17T10:00:00Z' AND (time) < '2026-01-17T11:00:00Z'
```

### `$__timeGroup` and timezones

Arc stores and returns timestamps in UTC, and Grafana renders them in the
dashboard's timezone. Anything grouped by **day or larger** has to bucket in
that timezone too — otherwise a "day" starts at 00:00 UTC, which in UTC−6 is
18:00 the previous evening, and every bar mixes two local calendar days.

`$__timeGroup` buckets by the **dashboard's timezone**, so a daily bucket is the viewer's day rather than a UTC day:

```sql
SELECT
  $__timeGroup(time, '1d') AS time,
  COUNT(*) AS samples
FROM cpu
WHERE $__timeFilter(time)
GROUP BY 1
ORDER BY time ASC
```

`$__timeGroup` accepts any `<n><unit>` interval — `20s`, `2m`, `10 minutes`,
`1h`, `1d`, `1w` — in short or long form. An interval it cannot parse is left
unexpanded, so Arc returns a clear error rather than silently bucketing
differently.

In a UTC−6 dashboard those buckets start at 06:00 UTC, which is local midnight. Setting the dashboard to "Browser Time" means each viewer sees their own days.

Three details worth knowing:

- **UTC dashboards are unaffected.** They use the same epoch arithmetic every earlier release used.
- **Hour buckets** stay on epoch arithmetic in any zone whose offset is a whole number of hours, which is nearly all of them. The result is identical, and it avoids a daylight-saving hazard where a repeated local hour would merge two buckets into one.
- **`7d` is not a calendar week.** Week buckets anchor on Monday, so ask for `1w` if that is what you mean. `7d` stays a fixed seven-day span.

`$__timeGroup` also disables query splitting when the bucket is wider than a chunk, because a bucket split across chunks would come back as several partial rows.

### More examples

**Memory:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) AS time,
  AVG(used_percent) AS memory_used,
  host
FROM mem
WHERE $__timeFilter(time)
GROUP BY 1, host
ORDER BY time ASC
```

**Network throughput, bytes to bits:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) AS time,
  AVG(bytes_recv) * 8 AS bits_in,
  AVG(bytes_sent) * 8 AS bits_out,
  host,
  interface
FROM net
WHERE $__timeFilter(time)
GROUP BY 1, host, interface
ORDER BY time ASC
```

**Disk I/O:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) AS time,
  AVG(read_bytes) AS disk_read,
  AVG(write_bytes) AS disk_write,
  host
FROM diskio
WHERE $__timeFilter(time)
GROUP BY 1, host
ORDER BY time ASC
```

## Template variables

### Creating a variable

1. **Dashboard settings** → **Variables** → **Add variable**
2. Choose **Query**, select the Arc data source, and write SQL returning one column

```sql
-- Host variable
SELECT DISTINCT host FROM cpu ORDER BY host
```

```sql
-- Interface variable
SELECT DISTINCT interface FROM net ORDER BY interface
```

Avoid `SHOW TABLES` in a variable query unless the data source uses the MessagePack or JSON protocol; the Arrow endpoint rejects it.

### Quoting rules

This plugin follows the same rule as Grafana's built-in SQL data sources, so queries port between them unchanged:

| Variable kind | What the plugin does | How to write it |
|---|---|---|
| Single-value | Escapes embedded quotes; adds **no** quotes | You supply them: `WHERE host = '$server'` |
| Multi-value or "Include All" | Quotes **each** value and joins with commas | Leave it bare: `WHERE host IN ($servers)` |

So a single-value variable works inside a literal of any shape, including a regex:

```sql
WHERE host = '$server'
WHERE host ~ '^$server$'
```

and a multi-value variable must **not** be wrapped in quotes:

```sql
-- Correct
WHERE host IN ($servers)

-- Wrong: produces ''a','b''
WHERE host IN ('$servers')
```

If you need a multi-value variable inside a regex literal, use `${servers:regex}`.

Embedded single quotes are always doubled, so a value cannot terminate the literal it sits in. Two cases fall outside that guarantee, both identical to Grafana's own SQL data sources: a variable used **without** quotes (`WHERE host = $server`), and a variable inside a DuckDB **escape-string** literal (`E'$server'`). Both are reasons to scope Arc's API token to what dashboard viewers may read.

### Using a variable

```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) AS time,
  AVG(usage_idle) * -1 + 100 AS cpu_usage
FROM cpu
WHERE host = '$server'
  AND cpu = 'cpu-total'
  AND $__timeFilter(time)
GROUP BY 1
ORDER BY time ASC
```

## Alerting

Grafana alert rules work against Arc queries. Because an alert has no dashboard, it has no timezone: `$__timeGroup` buckets in UTC on the alerting path.

### Creating a rule

1. Open a panel with an Arc query
2. **Alert** tab → **New alert rule**
3. Set the condition and evaluation interval

### Example: high CPU

```sql
SELECT
  time,
  100 - usage_idle AS cpu_usage,
  host
FROM cpu
WHERE cpu = 'cpu-total'
  AND time >= NOW() - INTERVAL '5 minutes'
ORDER BY time ASC
```

Condition: `WHEN avg() OF query(A, 5m, now) IS ABOVE 80`

### Example: memory pressure

```sql
SELECT
  time,
  used_percent AS memory_used,
  host
FROM mem
WHERE time >= NOW() - INTERVAL '5 minutes'
ORDER BY time ASC
```

Condition: `WHEN avg() OF query(A, 5m, now) IS ABOVE 90`

Route rules to a contact point under **Alerting** → **Contact points**.

## Dashboard examples

**CPU by host** (time series):
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) AS time,
  AVG(100 - usage_idle) AS cpu_usage,
  host
FROM cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
GROUP BY 1, host
ORDER BY time ASC
```

**Disk usage** (gauge):
```sql
SELECT
  host,
  AVG(used_percent) AS disk_used
FROM disk
WHERE $__timeFilter(time)
GROUP BY host
```

**Top hosts by CPU** (bar gauge):
```sql
SELECT
  host,
  AVG(100 - usage_idle) AS avg_cpu
FROM cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
GROUP BY host
ORDER BY avg_cpu DESC
LIMIT 10
```

## Advanced queries

**Moving average** (window function):
```sql
SELECT
  time,
  usage_idle,
  host,
  AVG(usage_idle) OVER (
    PARTITION BY host
    ORDER BY time
    ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
  ) AS moving_avg
FROM cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
ORDER BY time ASC
```

**Percentiles:**
```sql
SELECT
  time_bucket(INTERVAL '$__interval', time) AS time,
  host,
  quantile_cont(usage_idle, 0.50) AS p50,
  quantile_cont(usage_idle, 0.95) AS p95,
  quantile_cont(usage_idle, 0.99) AS p99
FROM cpu
WHERE cpu = 'cpu-total' AND $__timeFilter(time)
GROUP BY 1, host
ORDER BY time ASC
```

Queries containing a window function are not split into chunks, since a window spanning a chunk boundary would produce wrong results.

## Performance

**Query splitting** breaks a long range into chunks that run in parallel. It is skipped automatically where chunking would change results: `LIMIT` queries, aggregations without a time bucket, `UNION`, window functions, buckets wider than a chunk, and queries with no time filter to split along.

**Keep the range honest.** `$__timeFilter()` is what lets Arc prune files; a panel without it scans everything.

**Let `$__interval` size the buckets.** It is derived from the selected range, so the point count stays sensible as the range grows:

```sql
-- Good
time_bucket(INTERVAL '$__interval', time)

-- Bad: a day of data at one-second resolution
time_bucket(INTERVAL '1 second', time)
```

**Tune concurrency for the deployment.** *Max Concurrency* bounds one query's chunk fan-out; *Max In Flight* bounds the whole data source across every panel and viewer. Lower them to protect a busy Arc, raise *Max In Flight* if a large dashboard's panels queue behind each other.

**Cache repeated queries.** Grafana's per-data-source query caching helps most on dashboards several people watch at once.

## Troubleshooting

### The data source does not appear

```bash
ls -la /var/lib/grafana/plugins/basekick-arc-datasource
grep -i "unsigned\|basekick" /var/log/grafana/grafana.log
```

The usual cause is the unsigned-plugin setting. Grafana logs `Plugin is unsigned` and skips loading unless `allow_loading_unsigned_plugins` names `basekick-arc-datasource`.

### Save & test fails

```bash
# Is Arc up?
curl http://localhost:8000/health

# Is the token valid?
curl -H "Authorization: Bearer $ARC_TOKEN" http://localhost:8000/api/v1/auth/verify
```

If the message mentions a **blocked address**, the URL resolves to a private range and **Allow Private IPs** is off.

### A query fails

Parser and syntax errors from DuckDB are shown on the panel. Other errors are summarised, with the full text and the expanded SQL in the Grafana server log:

```bash
grep "Arc query failed" /var/log/grafana/grafana.log | tail
```

Common causes:

- **"Cross-database queries not allowed"** — a `db.table` name while the data source has a Database configured. Drop the prefix.
- **"SHOW DATABASES is not supported on the Arrow endpoint"** — switch the data source to MessagePack or JSON, or query a table instead.
- **"Table with name X does not exist"** — the table is in a different database than the one configured.

### Listing what exists

`SHOW` statements need the MessagePack or JSON protocol, and Arc runs one
statement per query, so use them in separate panels or variable queries:

```sql
SHOW DATABASES
```

```sql
SHOW TABLES
```

### Slow dashboards

Most panel latency is Arc-side query time, not plugin overhead. Check a query directly:

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT count(*) FROM cpu WHERE time > NOW() - INTERVAL 1 HOUR"}'
```

If a single query is fast but the dashboard is slow, raise **Max In Flight** so panels stop queuing.

## Resources

- **[Grafana Arc data source on GitHub](https://github.com/basekick-labs/grafana-arc-datasource)**
- **[Grafana documentation](https://grafana.com/docs/grafana/latest/)**
- **[Arc Query API](/arc/api-reference/overview/#querying)**
- **[DuckDB SQL reference](https://duckdb.org/docs/sql/introduction)**

## Next steps

- **[Query API Reference](/arc/api-reference/overview/)**
- **[Telegraf Integration](/arc/integrations/telegraf/)** — collect system metrics
- **[Apache Superset Integration](/arc/integrations/superset/)** — BI dashboards
