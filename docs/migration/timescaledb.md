---
sidebar_position: 2
title: Migrate from TimescaleDB
description: "Step-by-step guide to migrating from TimescaleDB to Arc: export hypertables to CSV, import into Arc, move ongoing writes, and translate TimescaleDB SQL. time_bucket works unchanged."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Migrate from TimescaleDB to Arc

This guide walks you through moving a TimescaleDB workload to Arc: standing up Arc, bulk-loading your hypertable history, moving ongoing writes, and translating your queries. Every command below was tested end-to-end against **TimescaleDB 2.28.2 / PostgreSQL 16.14** and **Arc 26.06.3**.

TimescaleDB is PostgreSQL with time-series extensions. Two things make this migration smooth, and one thing takes real work:

- **Queries mostly carry over.** Arc runs standard SQL, and `time_bucket()` has the same name and argument order on both sides. Most dashboards and reports run with little or no change.
- **History is a `\copy` and a `curl`.** Hypertables export to CSV like any table; Arc imports the file directly.
- **Ongoing writes change path.** TimescaleDB apps write over the PostgreSQL wire protocol, which Arc does not speak. Arc ingests over HTTP. If you write through Telegraf this is a one-block config swap; if you write with SQL `INSERT`/`COPY` it is an application change. See [Step 2](#step-2-move-ongoing-writes).

## How TimescaleDB concepts map to Arc

| TimescaleDB | Arc | Notes |
|-------------|-----|-------|
| Hypertable | Measurement | A queryable table. Chunking is transparent to export; in Arc, partitioning is handled by the storage engine. |
| `create_hypertable()`, `add_retention_policy()`, chunk DDL | (none) | Arc is schema-on-write. There is no `CREATE TABLE` or hypertable DDL; a measurement appears on first write. |
| `timestamptz` column | `time` column | Arc stores the timestamp as a `time` column. See [Step 3](#step-3-migrate-historical-data) for the export format that imports cleanly. |
| `time_bucket()` | `time_bucket()` | Same function, same argument order. Queries barely change. |
| `last(v, time)` / `first(v, time)` | `arg_max(v, time)` / `arg_min(v, time)` | Direct, tested equivalents. |
| Continuous aggregate (auto-refresh materialized view) | Scheduled rollup | No auto-incremental primitive; run a bucketed aggregation on a schedule and write the rollup to a measurement. |
| PostgreSQL heap storage | Apache Parquet | Portable Parquet you own, queryable in place by any Parquet tool. No `pg_dump` as your only export path. |

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

## Step 2: Move ongoing writes

Unlike QuestDB, TimescaleDB shares no wire protocol with Arc. TimescaleDB apps write over the PostgreSQL wire protocol; Arc ingests over HTTP (MessagePack, Line Protocol, or bulk import). How much work this is depends entirely on how your data reaches TimescaleDB today.

**If you write through Telegraf**, this is a one-block change. Keep the PostgreSQL output while you migrate history, and add an Arc output so new data lands in both (dual-write):

```toml
# Keep writing to TimescaleDB during the migration
[[outputs.postgresql]]
  connection = "host=localhost user=postgres dbname=mydb sslmode=disable"

# New data also goes to Arc
[[outputs.arc]]
  url = "http://localhost:8000/api/v1/write/msgpack"
  api_key = "$ARC_TOKEN"
  content_encoding = "gzip"
  database = "mydb"
```

Once you have cut over, drop the `[[outputs.postgresql]]` block. See the [Telegraf integration](/arc/integrations/telegraf) for the full plugin reference.

**If you write with custom SQL `INSERT`/`COPY`**, the write path is application work: re-target it at Arc's HTTP write API (the [MessagePack columnar protocol](/arc/api-reference/overview) is the fastest, and the [Line Protocol endpoints](/arc/data-import/line-protocol) accept InfluxDB-style writes). There is no wire-level shortcut here, so plan for a code change.

:::tip Migrate at your own pace
Dual-writing means TimescaleDB stays authoritative while you move history and build confidence in Arc. Nothing is lost if you pause.
:::

## Step 3: Migrate historical data

TimescaleDB is PostgreSQL, so you export with `\copy` (client-side, no server file access needed, works against managed instances). Hypertables export exactly like ordinary tables.

:::caution Convert the timestamp on export
A plain `\copy (SELECT * FROM cpu ...)` writes PostgreSQL's default `timestamptz` format, `2023-11-14 22:13:20+00`. Arc's importer **rejects** the `+00` offset form. Convert the timestamp in the export query to either epoch seconds or RFC 3339. Both are tested below.
:::

**Recommended, export the timestamp as epoch seconds:**

```bash
psql -h localhost -U postgres -d mydb -c \
  "\copy (SELECT EXTRACT(EPOCH FROM time)::bigint AS time, host, usage_idle, usage_user FROM cpu ORDER BY time) TO 'cpu.csv' WITH (FORMAT csv, HEADER true)"
```

Import into Arc with `time_format=epoch_s`:

```bash
curl -X POST "http://localhost:8000/api/v1/import/csv?measurement=cpu&time_column=time&time_format=epoch_s" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: mydb" \
  -F "file=@cpu.csv"
```

Response:

```json
{
  "status": "ok",
  "result": {
    "database": "mydb",
    "measurement": "cpu",
    "rows_imported": 10000,
    "partitions_created": 3,
    "time_range_min": "2023-11-14T22:13:20Z",
    "time_range_max": "2023-11-15T00:59:59Z",
    "columns": ["time", "host", "usage_idle", "usage_user"],
    "duration_ms": 9
  }
}
```

**Alternative, export RFC 3339 timestamps** (leave `time_format` off, Arc auto-detects):

```bash
psql -h localhost -U postgres -d mydb -c \
  "\copy (SELECT to_char(time AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS time, host, usage_idle, usage_user FROM cpu ORDER BY time) TO 'cpu.csv' WITH (FORMAT csv, HEADER true)"
```

```bash
curl -X POST "http://localhost:8000/api/v1/import/csv?measurement=cpu&time_column=time" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: mydb" \
  -F "file=@cpu.csv"
```

Each hypertable becomes a measurement in Arc. The CSV header becomes the columns; Arc infers types.

:::tip Sizing and batching
Check what you are moving before you start:

```sql
SELECT hypertable_name, num_chunks,
       pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass)) AS size
FROM timescaledb_information.hypertables;
```

For large hypertables, export in time ranges (`WHERE time >= '2024-01-01' AND time < '2024-02-01'`) to keep files under the 500 MB import limit and to parallelize. Arc auto-detects gzip, so `gzip cpu.csv` and upload `cpu.csv.gz` for faster transfers. Script export-then-import in a `for` loop over your tables.
:::

**Verify the load** against the source. In Arc, set `X-Arc-Database` so you can use bare table names:

```bash
curl -X POST "http://localhost:8000/api/v1/query" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Arc-Database: mydb" \
  -d '{"sql":"SELECT count(*), min(time), max(time) FROM cpu"}'
```

Compare with TimescaleDB: `SELECT count(*), min(time), max(time) FROM cpu;`. Counts and time range should match.

## Step 4: Translate your queries

The good news first: **`time_bucket()` is identical on both sides**, same name and argument order. A downsampling query that runs on TimescaleDB runs unchanged on Arc.

Set the `X-Arc-Database` header on your query requests and you keep the same bare table names you use in TimescaleDB (`FROM cpu` instead of `FROM mydb.cpu`). This is the recommended pattern, it keeps your SQL identical and takes Arc's leaner query path.

| TimescaleDB | Arc |
|-------------|-----|
| `time_bucket(INTERVAL '5 minutes', time)` | `time_bucket(INTERVAL '5 minutes', time)` (same) |
| `last(value, time)` | `arg_max(value, time)` |
| `first(value, time)` | `arg_min(value, time)` |
| `time_bucket_gapfill()` + `locf()` | `generate_series` spine + LOCF window (see below) |
| `percentile_cont(0.95) WITHIN GROUP (ORDER BY x)` | `percentile_cont(0.95) WITHIN GROUP (ORDER BY x)` (same) |
| `create_hypertable(...)`, retention/compression policies | Not needed (schema-on-write; storage-layer concern) |

### Downsampling: unchanged

```sql
SELECT time_bucket(INTERVAL '1 hour', time) AS bucket,
       avg(usage_idle),
       count(*)
FROM cpu
GROUP BY 1
ORDER BY 1;
```

Identical SQL, identical results on both engines.

### Latest / earliest per series: `last`/`first` to `arg_max`/`arg_min`

```sql
-- TimescaleDB
SELECT host, last(usage_idle, time) FROM cpu GROUP BY host;

-- Arc
SELECT host, arg_max(usage_idle, time) FROM cpu GROUP BY host;
```

`arg_max(v, time)` returns the value of `v` at the row with the maximum `time`. `arg_min` does the same for the minimum. Both match TimescaleDB's `last`/`first` exactly.

### Gap-filling: the one real porting cost

TimescaleDB's `time_bucket_gapfill()` with `locf()`/`interpolate()` has no drop-in equivalent. Reconstruct it with a generated bucket spine, a `LEFT JOIN`, and a window function for last-observation-carried-forward:

```sql
WITH spine AS (
  SELECT unnest(generate_series(
    TIMESTAMPTZ '2023-11-14 22:00:00Z',
    TIMESTAMPTZ '2023-11-15 00:00:00Z',
    INTERVAL '1 hour')) AS bucket
),
agg AS (
  SELECT time_bucket(INTERVAL '1 hour', time) AS bucket, avg(usage_idle) AS avg_idle
  FROM cpu GROUP BY 1
)
SELECT s.bucket,
       a.avg_idle,
       last_value(a.avg_idle IGNORE NULLS) OVER (ORDER BY s.bucket) AS locf_idle
FROM spine s
LEFT JOIN agg a ON s.bucket = a.bucket
ORDER BY s.bucket;
```

The `locf_idle` column carries the last non-null value forward across empty buckets. For linear interpolation, use `lead`/`lag` over the same window.

:::caution Match the spine type to `time_bucket`
`time_bucket()` returns a timestamp *with* time zone, so the spine must be `TIMESTAMPTZ` for the join to match. A plain `TIMESTAMP` spine joins to nothing and every bucket comes back null.
:::

See the [SQL Querying Guide](/arc/guides/querying) for the full function reference.

## Differences to know

- **No PostgreSQL wire protocol.** Arc ingests over HTTP. Ongoing writes move to Telegraf-to-Arc or the HTTP write API, not a connection-string swap. See [Step 2](#step-2-move-ongoing-writes).
- **No hypertable DDL.** Arc is schema-on-write, there is no `create_hypertable()`, no chunk sizing, no retention/compression policy SQL. A measurement and its columns appear on first write.
- **Gap-filling is manual.** `time_bucket_gapfill`/`locf`/`interpolate` are reconstructed with `generate_series` and window functions (above).
- **The query API is read-only.** `POST /api/v1/query` rejects write verbs (`INSERT`, `DELETE`, `DROP`, `COPY`, and the file-reading functions). Ingest through the write and import endpoints.
- **Portable storage.** Arc's Parquet files are yours, queryable in place by any Parquet-compatible tool, or moved to S3/MinIO/Azure without an export step.

## Next steps

- [SQL Querying Guide](/arc/guides/querying) - full SQL function reference and query patterns
- [CSV Import](/arc/data-import/csv) - all import parameters and options
- [Telegraf integration](/arc/integrations/telegraf) - the native `outputs.arc` output plugin
- [Authentication](/arc/configuration/authentication) - creating scoped tokens for production
- [Grafana data source](/arc/integrations/grafana) - dashboards on your migrated data
