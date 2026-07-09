---
sidebar_position: 4
title: Migrate from InfluxDB
description: "Step-by-step guide to migrating from InfluxDB (1.x, 2.x, 3.x) to Arc: re-point Line Protocol ingestion, bulk-load history with tsm2arc or line protocol export, and translate InfluxQL and Flux to standard SQL."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Migrate from InfluxDB to Arc

This guide walks you through moving an InfluxDB workload to Arc: re-pointing live ingestion, bulk-loading your history, and translating your queries. It covers **InfluxDB 1.x, 2.x, and 3.x**. Every command was tested end-to-end against **InfluxDB 1.8.10** and **Arc 26.06.3**.

InfluxDB is the smoothest migration to Arc, because Arc speaks InfluxDB Line Protocol natively:

- **Live ingestion is a URL change.** Point Telegraf or any InfluxDB client at Arc's `/write` (1.x) or `/api/v2/write` (2.x) endpoint. Dual-write during the migration, cut over when ready. No agent changes, no downtime.
- **History has a purpose-built tool.** [`tsm2arc`](https://github.com/Basekick-Labs/tsm2arc) reads InfluxDB 1.x/2.x TSM files directly off disk and loads Arc, reconstructing multi-field points correctly. Line Protocol export/import works for every version including 3.x.
- **Queries move to standard SQL.** InfluxQL and Flux map to standard SQL. Flux is deprecated in InfluxDB 3 anyway.

## How InfluxDB concepts map to Arc

| InfluxDB | Arc | Notes |
|----------|-----|-------|
| Measurement | Measurement | Same name, a queryable table. |
| Tag / field | Column | Tags and fields both become columns. |
| Bucket (2.x) / database (1.x) | Database | The target Arc database. |
| Organization (2.x) | (ignored) | Arc has no org concept; the `org` parameter is accepted and ignored. |
| `time` | `time` column | Timestamps convert losslessly to Arc's internal microsecond precision. |
| InfluxQL / Flux | Standard SQL | Direct equivalents for the common patterns. See [Step 4](#step-4-translate-your-queries). |
| TSM / Parquet (3.x) storage | Apache Parquet | Portable Parquet you own, queryable by any Parquet tool. |

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

## Step 2: Re-point live ingestion (the easy win)

Arc accepts InfluxDB Line Protocol on InfluxDB-compatible endpoints, so live writers move with a URL change. See [InfluxDB Client Compatibility](/arc/integrations/influxdb-clients) for the full client and endpoint reference.

| InfluxDB endpoint | Arc endpoint | For |
|-------------------|--------------|-----|
| `/write` | `/write?db=<database>` | 1.x clients |
| `/api/v2/write` | `/api/v2/write?bucket=<database>&org=<ignored>` | 2.x clients |

```bash
# InfluxDB 1.x style
curl -X POST "http://localhost:8000/write?db=metrics&precision=ns" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  --data-binary 'cpu,host=server01 usage_idle=95.0,usage_user=3.2 1700000000000000000'

# InfluxDB 2.x style (bucket becomes the database; org is ignored)
curl -X POST "http://localhost:8000/api/v2/write?bucket=metrics&org=myorg&precision=ns" \
  -H "Authorization: Token $ARC_TOKEN" \
  --data-binary 'cpu,host=server02 usage_idle=88.0,usage_user=5.1 1700000001000000000'
```

**Dual-write with Telegraf** so new data lands in both systems while you migrate history, then drop the InfluxDB output at cutover:

```toml
# Keep InfluxDB during the migration
[[outputs.influxdb_v2]]
  urls = ["http://influxdb:8086"]
  token = "$INFLUX_TOKEN"
  organization = "myorg"
  bucket = "metrics"

# New data also goes to Arc
[[outputs.arc]]
  url = "http://localhost:8000/api/v1/write/msgpack"
  api_key = "$ARC_TOKEN"
  content_encoding = "gzip"
  database = "metrics"
```

The Arc Telegraf output requires Telegraf 1.33+. See the [Telegraf integration](/arc/integrations/telegraf).

## Step 3: Migrate historical data

Two paths. **Line Protocol export/import** works for every InfluxDB version and is the universal path. For large **1.x/2.x** datasets, **tsm2arc** is faster, resumable, and reconstructs multi-field points correctly.

### Line Protocol export and import

Export to a `.lp` file, then import with `POST /api/v1/import/lp`. The export command depends on your InfluxDB version.

<Tabs>
  <TabItem value="v1" label="InfluxDB 1.x" default>

Use `influx_inspect export` (reads TSM and WAL directly, works offline):

```bash
influx_inspect export \
  -datadir /var/lib/influxdb/data \
  -waldir /var/lib/influxdb/wal \
  -database mydb -lponly -out mydb.lp
```

  </TabItem>
  <TabItem value="v2" label="InfluxDB 2.x">

Export with a Flux query, pivoting fields back into line-protocol-friendly rows:

```bash
influx query --raw 'from(bucket:"mydb")
  |> range(start: 0)
  |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")' > mydb.lp
```

  </TabItem>
  <TabItem value="v3" label="InfluxDB 3.x">

Use the `influxdb3` CLI with line-protocol output:

```bash
influxdb3 query --database mydb --format lp \
  "SELECT * FROM cpu" > cpu.lp
```

  </TabItem>
</Tabs>

Import into Arc:

```bash
curl -X POST "http://localhost:8000/api/v1/import/lp" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: mydb" \
  -F "file=@mydb.lp"
```

:::caution `influx_inspect export` splits fields into separate lines
`influx_inspect export` writes one Line Protocol line per field, so a two-field point becomes two rows in Arc, each with one field populated and the other null. For single-field measurements this is fine. For multi-field measurements, either use **tsm2arc** (below), which rejoins fields into one point, or export with an InfluxQL `SELECT` per measurement so the fields stay together. See the full mechanics in [Line Protocol Bulk Import](/arc/data-import/line-protocol).
:::

### Bulk migration with tsm2arc (recommended for 1.x/2.x)

[tsm2arc](https://github.com/Basekick-Labs/tsm2arc) (Apache-2.0) reads InfluxDB 1.x/2.x TSM and WAL files **directly off disk**, reconstructs each multi-field point into a single Line Protocol record, and streams it into Arc's `/api/v1/import/lp` endpoint with resumable checkpointing. It does not need a running InfluxDB, which makes it ideal for cold volumes and EBS snapshots. (InfluxDB 3.x stores Parquet, not TSM, so use the Line Protocol path above for 3.x.)

Install:

```bash
go install github.com/basekick-labs/tsm2arc/cmd/tsm2arc@latest
# or a release binary from https://github.com/basekick-labs/tsm2arc/releases
# or:  docker run --rm ghcr.io/basekick-labs/tsm2arc:latest --version
```

Dry-run first (extracts and counts, writes nothing):

```bash
tsm2arc --datadir /var/lib/influxdb/data --waldir /var/lib/influxdb/wal \
  --dry-run --sample 5
```

The dry-run reports discovered shards and reconstructed points, for example `points: 10000  fields: 20000` with rejoined lines like `cpu,host=server01 usage_idle=50,usage_user=10 1700000000000000000`.

Then the real run:

```bash
export ARC_TOKEN='<admin-tier-token>'
tsm2arc \
  --datadir    /var/lib/influxdb/data \
  --waldir     /var/lib/influxdb/wal \
  --arc-url    http://localhost:8000 \
  --token      "$ARC_TOKEN" \
  --workers    2 \
  --checkpoint /var/lib/tsm2arc/migration.checkpoint.db
```

:::tip tsm2arc operational notes
- **Always pass `--waldir`.** InfluxDB does not flush the WAL to TSM on a normal shutdown, so recent shards can live entirely in `.wal` files. Omitting `--waldir` silently misses them.
- **Size `--workers` against Arc's RAM, not the migration host.** Arc buffers each import server-side, roughly 1 to 1.3 GB per concurrent worker at the default chunk size. The default of 2 is conservative; raise it if Arc has headroom.
- **Resume by re-running the identical command.** Progress is checkpointed per shard in SQLite; completed shards are skipped. Changing `--chunk-bytes`, `--start`/`--end`, or `--db-map` between runs is refused to keep the checkpoint consistent.
- **Rename databases** with `--db-map old=new`, and filter with `--database-filter` or `--start`/`--end` (RFC3339 UTC).
- Supports InfluxDB 1.7/1.8 and 2.0 to 2.7. For 2.x it reads `influxd.bolt` to recover bucket names.
:::

**Verify the load** against the source. In Arc, set `X-Arc-Database` so you can use bare table names:

```bash
curl -X POST "http://localhost:8000/api/v1/query" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Arc-Database: mydb" \
  -d '{"sql":"SELECT count(*), min(time), max(time) FROM cpu"}'
```

Compare with InfluxDB: `SELECT count(usage_idle), min(time), max(time) FROM cpu`. Counts and time range should match.

## Step 4: Translate your queries

Arc runs standard SQL. InfluxQL and Flux map to it directly for the common patterns. Set the `X-Arc-Database` header on your query requests and you keep bare table names (`FROM cpu` instead of `FROM mydb.cpu`).

| InfluxQL / Flux | Arc |
|-----------------|-----|
| `GROUP BY time(1h)` | `time_bucket(INTERVAL '1 hour', time)` + `GROUP BY 1` |
| `MEAN(field)` / `SUM` / `MAX` | `avg(field)` / `sum` / `max` |
| `LAST(field)` / `FIRST(field)` | `arg_max(field, time)` / `arg_min(field, time)` |
| `PERCENTILE(field, 95)` | `quantile_cont(field, 0.95)` |
| `GROUP BY "tag"` | `GROUP BY tag` |
| Flux `\|> aggregateWindow(every: 1h, fn: mean)` | `time_bucket(INTERVAL '1 hour', time)` + `avg(...)` |
| Flux (deprecated in InfluxDB 3) | standard SQL |

### Downsampling

```sql
-- InfluxQL
SELECT MEAN(usage_idle) FROM cpu GROUP BY time(1h);

-- Arc
SELECT time_bucket(INTERVAL '1 hour', time) AS bucket, avg(usage_idle)
FROM cpu GROUP BY 1 ORDER BY 1;
```

Tested identical: same buckets, same averages.

### Last value per series

```sql
-- InfluxQL
SELECT LAST(usage_idle) FROM cpu GROUP BY host;

-- Arc
SELECT host, arg_max(usage_idle, time) FROM cpu GROUP BY host;
```

Tested identical.

:::note Percentiles differ slightly by design
InfluxQL `PERCENTILE(field, 95)` and Arc's `quantile_cont(field, 0.95)` use different interpolation, so they can differ in the last digits (for example 97.49 vs 97.4905). Both are correct percentiles; the small difference is expected.
:::

See the [SQL Querying Guide](/arc/guides/querying) for the full function reference.

## Differences to know

- **No Flux.** Arc uses standard SQL. Flux is deprecated in InfluxDB 3, so this aligns with InfluxData's own direction.
- **Organizations are ignored.** The 2.x `org` parameter is accepted and ignored; a bucket maps to an Arc database.
- **Retention and tasks.** InfluxDB retention policies map to Arc's retention API; continuous tasks map to Arc continuous queries.
- **The query API is read-only.** `POST /api/v1/query` rejects write verbs. Ingest through the write and import endpoints.
- **Portable storage.** Arc's Parquet files are yours, queryable in place by any Parquet-compatible tool.

## Next steps

- [InfluxDB Client Compatibility](/arc/integrations/influxdb-clients) - endpoint mapping, auth, and supported clients
- [Line Protocol Bulk Import](/arc/data-import/line-protocol) - the `/api/v1/import/lp` reference
- [tsm2arc on GitHub](https://github.com/Basekick-Labs/tsm2arc) - the TSM bulk migration tool
- [SQL Querying Guide](/arc/guides/querying) - full SQL function reference
- [Telegraf integration](/arc/integrations/telegraf) - the native `outputs.arc` output plugin
- [Grafana data source](/arc/integrations/grafana) - dashboards on your migrated data
