---
sidebar_position: 3
title: Migrate from ClickHouse
description: "Step-by-step guide to migrating from ClickHouse to Arc: export MergeTree tables to CSV or Parquet, import into Arc, move ongoing writes, and translate ClickHouse SQL to standard SQL."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Migrate from ClickHouse to Arc

This guide walks you through moving a ClickHouse workload to Arc: standing up Arc, bulk-loading your table history, moving ongoing writes, and translating your queries. Every command below was tested end-to-end against **ClickHouse 26.6.1** and **Arc 26.06.3**.

ClickHouse and Arc are both fast columnar analytical engines, so this is a migration between peers, not an escape from a slow system. Teams move for three reasons:

- **Operational simplicity.** Arc is a single Go binary with embedded consensus. No ZooKeeper or ClickHouse Keeper, no MergeTree merge tuning, no multi-process cluster to babysit.
- **Ingestion throughput.** Arc sustains ~2.5x higher write throughput than ClickHouse (19.9M vs 7.0M records/sec on the same hardware) and accepts small batches (from ~1,000 rows) instead of ClickHouse's 100,000-row minimums.
- **Portable storage.** Arc stores every table as standard Apache Parquet you own and can read with any Parquet tool. MergeTree is readable only by ClickHouse.

:::note An honest note on query speed
On ClickBench with the same storage format (Parquet) and the same hardware, Arc matches or beats ClickHouse and wins every cold run. ClickHouse's **native** MergeTree format is faster on hot analytical queries. Migrate for ingestion throughput, operational simplicity, cold-start performance, and portable storage, not for a raw hot-query speedup over native ClickHouse.
:::

## How ClickHouse concepts map to Arc

| ClickHouse | Arc | Notes |
|------------|-----|-------|
| MergeTree table | Measurement | A queryable table. No `ENGINE`, no `ORDER BY`/`PARTITION BY` to port. |
| `CREATE TABLE ... ENGINE = MergeTree` | (none) | Arc is schema-on-write. A measurement and its columns appear on first write; there is no DDL. |
| `DateTime` / `DateTime64` column | `time` column | Arc stores the timestamp as a `time` column. See [Step 3](#step-3-migrate-historical-data) for the clean export form. |
| `Nullable(T)`, `LowCardinality(T)`, `Enum` | plain column of `T` | These are storage/encoding wrappers. They land as ordinary nullable / string / value columns. |
| `toStartOfInterval()`, `toStartOfHour()` | `time_bucket()`, `date_trunc()` | Standard equivalents, tested to return identical results. |
| `argMax(v, t)` / `argMin(v, t)` | `arg_max(v, t)` / `arg_min(v, t)` | Direct rename. |
| `SummingMergeTree` / `AggregatingMergeTree`, materialized views | Scheduled rollups | No table engines and no insert-time materialized views; run a bucketed aggregation on a schedule and write the rollup to a measurement. |
| `MergeTree` proprietary storage | Apache Parquet | Portable Parquet you own, queryable in place by any Parquet tool. |

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

ClickHouse shares no wire protocol with Arc. ClickHouse clients write over the native TCP protocol (port 9000) or HTTP `INSERT` (port 8123); Arc ingests over its own HTTP API. There is no drop-in driver compatibility, so plan for a real change to your write path.

- **If you already ship through Telegraf**, point the [Arc output plugin](/arc/integrations/telegraf) at Arc and drop the ClickHouse output. Note that ClickHouse deployments are frequently fed directly from application code or Kafka rather than Telegraf, so confirm this applies to you.
- **Otherwise**, re-target your producers at Arc's HTTP write API: the [MessagePack columnar protocol](/arc/api-reference/overview) is the fastest, and the [Line Protocol endpoints](/arc/data-import/line-protocol) accept InfluxDB-style writes. Kafka pipelines re-point their sink; application writers change their client.

:::tip Run both in parallel
Keep ClickHouse authoritative while you backfill history into Arc and shadow-read to compare results. Cut over only once you trust Arc.
:::

## Step 3: Migrate historical data

Export each table with `clickhouse-client`, then bulk-import into Arc. Both CSV and Parquet work; Parquet is the cleanest because column types carry through.

### Option A: Parquet (recommended)

ClickHouse exports `DateTime` as a proper Parquet timestamp, so Arc reads it with no format flags:

```bash
clickhouse-client --output_format_parquet_string_as_string=1 \
  --query "SELECT * FROM cpu ORDER BY time FORMAT Parquet" > cpu.parquet
```

```bash
curl -X POST "http://localhost:8000/api/v1/import/parquet?measurement=cpu&time_column=time" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: mydb" \
  -F "file=@cpu.parquet"
```

### Option B: CSV

Export with `CSVWithNames` (header row). Force ISO/UTC timestamps so the import is unambiguous:

```bash
clickhouse-client --date_time_output_format=iso \
  --query "SELECT * FROM cpu ORDER BY time FORMAT CSVWithNames" > cpu.csv
# time column becomes 2023-11-14T22:13:20Z (RFC 3339, UTC)
```

```bash
curl -X POST "http://localhost:8000/api/v1/import/csv?measurement=cpu&time_column=time" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: mydb" \
  -F "file=@cpu.csv"
```

Response (either option):

```json
{
  "status": "ok",
  "result": {
    "database": "mydb",
    "measurement": "cpu",
    "rows_imported": 10000,
    "time_range_min": "2023-11-14T22:13:20Z",
    "time_range_max": "2023-11-15T00:59:59Z",
    "columns": ["time", "host", "usage_idle", "usage_user"],
    "duration_ms": 11
  }
}
```

:::caution Timestamps and timezones
ClickHouse's default CSV output is the space form `2023-11-14 22:13:20` with **no offset**. Arc accepts that form and treats it as UTC, so it imports directly **when your `DateTime` column is UTC**. But ClickHouse renders `DateTime` in the column's declared timezone, so a non-UTC column produces a naive string that Arc would read as UTC and silently shift. Passing `--date_time_output_format=iso` (Option B) forces `...Z` UTC and removes the ambiguity. Alternatively, export epoch seconds with `toUnixTimestamp(time)` and import with `time_format=epoch_s`. All four forms were tested and import cleanly; ISO is the safe default.
:::

:::tip Sizing and batching
Check table sizes before you start:

```sql
SELECT name, total_rows, formatReadableSize(total_bytes) AS size
FROM system.tables WHERE database = currentDatabase();
```

For large tables, export in time ranges (`WHERE time >= '2024-01-01' AND time < '2024-02-01'`) to stay under the 500 MB import limit and to parallelize. Arc auto-detects gzip on CSV uploads. Script export-then-import in a loop over your tables.
:::

**Verify the load** against the source. In Arc, set `X-Arc-Database` so you can use bare table names:

```bash
curl -X POST "http://localhost:8000/api/v1/query" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Arc-Database: mydb" \
  -d '{"sql":"SELECT count(*), min(time), max(time) FROM cpu"}'
```

Compare with ClickHouse: `SELECT count(), min(time), max(time) FROM cpu`. Counts and time range should match.

## Step 4: Translate your queries

Arc runs standard SQL. ClickHouse's SQL dialect diverges more than most, but the common time-series patterns have direct, tested equivalents.

Set the `X-Arc-Database` header on your query requests and you keep bare table names (`FROM cpu` instead of `FROM mydb.cpu`). This is the recommended pattern, it keeps your SQL closest to the original and takes Arc's leaner query path.

| ClickHouse | Arc |
|------------|-----|
| `toStartOfInterval(time, INTERVAL 1 HOUR)` | `time_bucket(INTERVAL '1 hour', time)` |
| `toStartOfHour(time)` / `toStartOfDay(time)` | `date_trunc('hour', time)` / `date_trunc('day', time)` |
| `argMax(value, time)` / `argMin(value, time)` | `arg_max(value, time)` / `arg_min(value, time)` |
| `uniqExact(x)` | `count(DISTINCT x)` |
| `uniq(x)` / `uniqCombined(x)` | `approx_count_distinct(x)` |
| `quantile(0.95)(x)` | `quantile_cont(x, 0.95)` |
| `sumIf(x, cond)` / `countIf(cond)` | `sum(x) FILTER (WHERE cond)` / `count(*) FILTER (WHERE cond)` |
| `FINAL`, `PREWHERE`, `SAMPLE` | drop or rewrite (no equivalent) |

### Downsampling: `toStartOfInterval` to `time_bucket`

```sql
-- ClickHouse
SELECT toStartOfInterval(time, INTERVAL 1 HOUR) AS bucket, avg(usage_idle)
FROM cpu GROUP BY bucket ORDER BY bucket;

-- Arc
SELECT time_bucket(INTERVAL '1 hour', time) AS bucket, avg(usage_idle)
FROM cpu GROUP BY 1 ORDER BY 1;
```

Tested identical: same buckets, same averages, same counts.

### Latest per series and conditional aggregates

```sql
-- ClickHouse:  argMax + sumIf
SELECT host, argMax(usage_idle, time) FROM cpu GROUP BY host;
SELECT sumIf(usage_user, usage_idle > 90) FROM cpu;

-- Arc:  arg_max + FILTER
SELECT host, arg_max(usage_idle, time) FROM cpu GROUP BY host;
SELECT sum(usage_user) FILTER (WHERE usage_idle > 90) FROM cpu;
```

Both tested to return identical results.

:::note Quantiles differ by design
ClickHouse's `quantile(0.95)(x)` is an **approximate** aggregate (reservoir sampling). Arc's `quantile_cont(x, 0.95)` is exact continuous interpolation, so the two will not match to the last digit. That is expected. Use `quantile_cont` for an exact percentile; if you specifically want to reproduce ClickHouse's exact-quantile behavior, ClickHouse's own `quantileExact(0.95)(x)` is the closer reference.
:::

### ClickHouse-only keywords

`FINAL` (query-time dedup of `ReplacingMergeTree`), `PREWHERE` (a read optimization that is semantically just a filter), and `SAMPLE` have no standard equivalent. Drop `PREWHERE` into the regular `WHERE`; drop `FINAL` and do any dedup explicitly with `arg_max` or a `ROW_NUMBER()` window; remove `SAMPLE` or replace it with an explicit sampling predicate.

See the [SQL Querying Guide](/arc/guides/querying) for the full function reference.

## Differences to know

- **No wire protocol.** Arc ingests over HTTP. Ongoing writes move to Telegraf-to-Arc or the HTTP write API, not a connection-string swap. See [Step 2](#step-2-move-ongoing-writes).
- **No engines or DDL.** Arc is schema-on-write. There is no `MergeTree`, no `ORDER BY`/`PARTITION BY`, no `CREATE TABLE`. A measurement appears on first write.
- **No aggregate combinators or insert-time materialized views.** `-If` maps to `FILTER`; `-State`/`-Merge` and `SummingMergeTree`/`AggregatingMergeTree` rollups become scheduled aggregation jobs.
- **The query API is read-only.** `POST /api/v1/query` rejects write verbs (`INSERT`, `DELETE`, `DROP`, and the file-reading functions). Ingest through the write and import endpoints.
- **Portable storage.** Arc's Parquet files are yours, queryable in place by any Parquet-compatible tool, or moved to S3/MinIO/Azure without an export step.

## Next steps

- [SQL Querying Guide](/arc/guides/querying) - full SQL function reference and query patterns
- [CSV Import](/arc/data-import/csv) - all import parameters and options
- [Parquet Import](/arc/data-import/parquet) - importing Parquet exports directly
- [Telegraf integration](/arc/integrations/telegraf) - the native `outputs.arc` output plugin
- [Grafana data source](/arc/integrations/grafana) - dashboards on your migrated data
