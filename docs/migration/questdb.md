---
sidebar_position: 1
title: Migrate from QuestDB
description: "Step-by-step guide to migrating from QuestDB to Arc: re-point Line Protocol ingestion, bulk-load historical data via CSV, and translate QuestDB SQL to Arc's standard SQL."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Migrate from QuestDB to Arc

This guide walks you through moving a QuestDB workload to Arc: standing up Arc, re-pointing your live ingestion, bulk-loading your historical data, and translating your queries. Every command below was tested end-to-end against **QuestDB 9.4.3** and **Arc 26.06.3**.

The migration has three moving parts, and none of them require rewriting your application:

1. **Live ingestion:** QuestDB and Arc both speak InfluxDB Line Protocol (ILP), so Telegraf and ILP clients re-point to Arc with a URL change.
2. **Historical data:** export each QuestDB table to CSV via its `/exp` endpoint and bulk-import it into Arc.
3. **Queries:** QuestDB's time-series SQL extensions map to the standard SQL that Arc runs natively.

## How QuestDB concepts map to Arc

| QuestDB | Arc | Notes |
|---------|-----|-------|
| Table | Measurement | Same thing, a queryable table. Queried as `database.measurement`. |
| Designated timestamp | `time` column | Arc names the timestamp column `time`. It's a normal column you filter and order on explicitly, there's no implicit "designated" timestamp. |
| `SYMBOL` | `VARCHAR` | String/tag columns become standard strings. |
| Native column format | Apache Parquet | Arc stores every measurement as compressed Parquet you own and can query in place with any Parquet tool, no export step. |
| QuestDB SQL (`SAMPLE BY`, `LATEST ON`) | Standard SQL (`time_bucket`, `DISTINCT ON`) | Full analytical SQL surface: window functions, CTEs, joins. See [Translate your queries](#step-4-translate-your-queries). |
| Schema declared / evolved on write | Schema inferred on write | A new measurement or column appears on first write; no DDL required. |

## Step 0: Install and run Arc

<Tabs>
  <TabItem value="native" label="Native (macOS)" default>

Install with Homebrew (Apple Silicon; the query engine is statically linked, so there are no runtime dependencies):

```bash
brew install basekick-labs/tap/arc
```

Start Arc in the foreground:

```bash
arc
```

On first run Arc prints a one-time admin token to **stderr**:

```
======================================================================
  FIRST RUN - INITIAL ADMIN TOKEN GENERATED
======================================================================
  Admin API token: arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
======================================================================
```

Save that token, it is not shown again. To set a known token instead of a generated one, export `ARC_AUTH_BOOTSTRAP_TOKEN` (minimum 32 characters) before the first start:

```bash
ARC_AUTH_BOOTSTRAP_TOKEN="your-32-char-or-longer-secret-token" arc
```

  </TabItem>
  <TabItem value="linux" label="Native (Linux)">

Download the latest `.deb` (Debian/Ubuntu) or `.rpm` (RHEL/Fedora) from GitHub Releases and install it. The package registers an `arc` systemd service.

```bash
# Debian/Ubuntu
LATEST=$(curl -s https://api.github.com/repos/basekick-labs/arc/releases/latest | grep tag_name | cut -d '"' -f 4 | sed 's/v//')
wget https://github.com/basekick-labs/arc/releases/download/v${LATEST}/arc_${LATEST}_amd64.deb
sudo dpkg -i arc_${LATEST}_amd64.deb
sudo systemctl enable arc && sudo systemctl start arc
```

Read the first-run admin token from the journal:

```bash
sudo journalctl -u arc | grep -i "admin"
```

  </TabItem>
  <TabItem value="docker" label="Docker">

```bash
docker run -d --name arc -p 8000:8000 \
  -e ARC_AUTH_BOOTSTRAP_TOKEN="your-32-char-or-longer-secret-token" \
  ghcr.io/basekick-labs/arc:latest
```

Read the first-run admin token from the container logs (omit `ARC_AUTH_BOOTSTRAP_TOKEN` above if you want Arc to generate one):

```bash
docker logs arc 2>&1 | grep -i "admin"
```

  </TabItem>
</Tabs>

Arc listens on port **8000**. Confirm it's up:

```bash
curl http://localhost:8000/health
# {"status":"ok",...}
```

:::info Configuration
Arc reads an optional `arc.toml` (searched in the current directory, then `/etc/arc/`, then `$HOME/.arc/`) and environment variables prefixed with `ARC_` (a TOML key `section.key` maps to `ARC_SECTION_KEY`). To disable anonymous usage telemetry, set `ARC_TELEMETRY_ENABLED=false`. See [Authentication](/arc/configuration/authentication) and [Native Installation](/arc/installation/native) for the full reference.
:::

## Step 1: Set your Arc token

Every request below authenticates with a bearer token. Export it once:

```bash
export ARC_TOKEN="arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Verify it works:

```bash
curl http://localhost:8000/api/v1/auth/verify \
  -H "Authorization: Bearer $ARC_TOKEN"
```

For production, create scoped write tokens rather than reusing the admin token, see [Authentication](/arc/configuration/authentication).

## Step 2: Re-point live ingestion

QuestDB ingests via InfluxDB Line Protocol, and so does Arc. Any Telegraf pipeline or ILP client you already run keeps its exact payload, you only change the destination URL and add an Arc token.

Arc exposes an InfluxDB 1.x-compatible endpoint at `POST /write`. The measurement name in each line becomes the Arc measurement; the target database comes from the `db` query parameter (or the `X-Arc-Database` header):

```bash
curl -X POST "http://localhost:8000/write?db=metrics&precision=ns" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  --data-binary 'cpu,host=server01 usage_idle=95.0,usage_user=3.2 1700000000000000000'
```

`precision` accepts `ns` (default), `us`, `ms`, or `s`.

:::tip Telegraf
If you send to QuestDB from Telegraf today, point the InfluxDB output (or the native [`outputs.arc`](/arc/integrations/telegraf) plugin) at Arc's URL and set the token. No change to your inputs or metric names.
:::

Arc buffers writes and flushes them on an interval. During migration you can force an immediate flush so data is queryable right away:

```bash
curl -X POST "http://localhost:8000/api/v1/write/line-protocol/flush" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

Confirm the data landed:

```bash
curl -X POST "http://localhost:8000/api/v1/query" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Arc-Database: metrics" \
  -d '{"sql":"SELECT count(*) FROM cpu"}'
```

Setting the `X-Arc-Database` header lets you keep the same bare table names you use in QuestDB (`FROM cpu`) instead of `FROM metrics.cpu`. This is the recommended pattern, see [Step 4](#step-4-translate-your-queries).

The ILP field/measurement timestamp is stored in Arc's `time` column automatically. Tag values (like `host`) become string columns; numeric fields keep their types.

## Step 3: Migrate historical data

Export each QuestDB table to CSV through its REST `/exp` endpoint, then bulk-import the file into Arc.

**Export from QuestDB** (default REST port `9000`):

```bash
curl -G "http://localhost:9000/exp" \
  --data-urlencode "query=SELECT * FROM cpu" \
  -o cpu.csv
```

QuestDB writes a header row and RFC 3339 timestamps, e.g.:

```csv
"host","usage_idle","usage_user","timestamp"
"server01",75.572,24.311,"2023-11-14T22:13:20.000000Z"
```

Note the timestamp column is named **`timestamp`** (QuestDB's default designated-timestamp name).

**Import into Arc** with `POST /api/v1/import/csv`. Point `time_column` at QuestDB's `timestamp` column, Arc renames it to `time` in the output Parquet and auto-detects the RFC 3339 format:

```bash
curl -X POST "http://localhost:8000/api/v1/import/csv?measurement=cpu&time_column=timestamp" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: metrics" \
  -F "file=@cpu.csv"
```

Response:

```json
{
  "status": "ok",
  "result": {
    "database": "metrics",
    "measurement": "cpu",
    "rows_imported": 10000,
    "partitions_created": 3,
    "time_range_min": "2023-11-14T22:13:20Z",
    "time_range_max": "2023-11-15T00:59:59Z",
    "columns": ["host", "usage_idle", "usage_user", "time"],
    "duration_ms": 10
  }
}
```

:::info Timestamp formats
Arc auto-detects the timestamp unit. QuestDB's `/exp` produces RFC 3339 strings, which import without a `time_format`. If a column instead holds numeric epochs, pass `time_format=epoch_s`, `epoch_ms`, `epoch_us`, or `epoch_ns` (or omit it to auto-detect by magnitude). Column types are inferred per column. Maximum file size is 500 MB, export large tables in time-ranged chunks with a `WHERE` clause on the timestamp.
:::

For large migrations, script one export + import per table (and per time range for very large tables), then verify each with a `count(*)` and a `min/max(time)` check against QuestDB.

## Step 4: Translate your queries

Arc runs standard SQL. QuestDB's time-series extensions have direct equivalents.

**Scope your queries with the `X-Arc-Database` header.** Set `X-Arc-Database` on the request and you write `FROM cpu`, the same table names you use in QuestDB, instead of `FROM database.cpu`. This is the recommended pattern: it keeps your SQL identical to QuestDB's and takes Arc's leaner query path, since the engine resolves the measurement directly instead of rewriting a cross-database reference.

```bash
curl -X POST "http://localhost:8000/api/v1/query" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Arc-Database: metrics" \
  -d '{"sql":"SELECT count(*) FROM cpu"}'
```

Without the header, address tables as `database.measurement` (e.g. `FROM metrics.cpu`). The examples below use the header form and bare table names.

| QuestDB | Arc |
|---------|-----|
| `SAMPLE BY 1h` | `time_bucket(INTERVAL '1 hour', time)` + `GROUP BY 1` |
| `SAMPLE BY 5m` | `time_bucket(INTERVAL '5 minutes', time)` |
| `LATEST ON ts PARTITION BY sym` | `DISTINCT ON (sym) ... ORDER BY sym, time DESC` |
| Designated timestamp (implicit order) | Explicit `WHERE time >= ... ORDER BY time` |
| `now()` | `now()` |
| `dateadd('d', -7, now())` | `now() - INTERVAL '7 days'` |
| `to_timezone(ts, 'Europe/Madrid')` | `time AT TIME ZONE 'Europe/Madrid'` |

### Downsampling: `SAMPLE BY` → `time_bucket`

QuestDB:

```sql
SELECT timestamp, avg(usage_idle), count()
FROM cpu
SAMPLE BY 1h
ORDER BY timestamp;
```

Arc (with `X-Arc-Database: metrics`):

```sql
SELECT time_bucket(INTERVAL '1 hour', time) AS bucket,
       avg(usage_idle),
       count(*)
FROM cpu
GROUP BY 1
ORDER BY 1;
```

Both return identical buckets, averages, and counts.

### Latest row per series: `LATEST ON` → `DISTINCT ON`

QuestDB:

```sql
SELECT host, timestamp, usage_idle
FROM cpu
LATEST ON timestamp PARTITION BY host;
```

Arc (with `X-Arc-Database: metrics`):

```sql
SELECT DISTINCT ON (host) host, time, usage_idle
FROM cpu
ORDER BY host, time DESC;
```

Or equivalently with a window function:

```sql
SELECT host, time, usage_idle
FROM (
  SELECT host, time, usage_idle,
         ROW_NUMBER() OVER (PARTITION BY host ORDER BY time DESC) AS rn
  FROM cpu
)
WHERE rn = 1
ORDER BY host;
```

See the [SQL Querying Guide](/arc/guides/querying) for the full function reference.

## Differences to know

- **No proprietary query language.** Arc is standard SQL, there's no `SAMPLE BY`/`LATEST ON` syntax, but every pattern has a direct equivalent (above). In exchange you get the full analytical surface: CTEs, window functions, and complex joins run without a penalty.
- **Schema-on-write inference.** Types are inferred from the first write to a measurement; new columns appear automatically. There's no `CREATE TABLE` step.
- **Partition pruning.** Arc partitions Parquet by time. Filtering on the `time` column (`WHERE time >= ...`) prunes partitions and is the single biggest lever on query speed, keep a time filter on large scans.
- **The query API is read-only.** `POST /api/v1/query` rejects write verbs (`INSERT`, `DELETE`, `DROP`, `COPY`, `ATTACH`, and the file-reading functions). Ingest through the write and import endpoints, not through SQL.
- **Portable storage.** Arc's Parquet files are yours. You can query them directly with any Parquet-compatible tool, or move to S3/MinIO/Azure without an export step.

## Next steps

- [SQL Querying Guide](/arc/guides/querying), full SQL function reference and query patterns
- [CSV Import](/arc/data-import/csv), all import parameters and options
- [Authentication](/arc/configuration/authentication), creating scoped tokens for production
- [Telegraf integration](/arc/integrations/telegraf), the native `outputs.arc` output plugin
- [Grafana data source](/arc/integrations/grafana), dashboards on your migrated data
