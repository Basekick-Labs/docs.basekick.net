---
title: "Apache Iceberg Export"
description: "Publish Arc measurements as Apache Iceberg tables so Spark, Trino, DuckDB, and PyIceberg can read them directly, configured through the iceberg section of arc.toml."
---

Publish Arc's data as **Apache Iceberg** tables so any Iceberg-aware engine — Spark, Trino, DuckDB, Snowflake, PyIceberg — can query it directly, without going through Arc.

<Callout type="info" title="Availability">
Iceberg export is available in **Arc 26.09.1+**. Enable it with `iceberg.enabled = true`.
</Callout>

## What it is

[Apache Iceberg](https://iceberg.apache.org/) is an open **table format**: a metadata layer that turns a collection of data files into a coherent, transactional table with schema, snapshots, and partition information. It is **not a file format** — Iceberg tables are backed by Parquet (which Arc already writes).

Arc's Iceberg export is a background **reconciler** that registers Arc's **existing** Parquet files into an Iceberg table *by reference*, and keeps the table's file list in sync as compaction and retention change the underlying files.

## Why use it

- **No lock-in, taken further.** Arc already stores open Parquet files you own. Iceberg export makes those same files a standard lakehouse table that the entire Iceberg ecosystem can read — no proprietary API in the path.
- **Zero-copy.** Files are registered in place using Iceberg's `add_files` semantics. **No data is copied or rewritten**, so there is effectively no storage overhead beyond small Iceberg metadata. (This is a real differentiator: many streaming/TSDB systems re-export data into *new* Parquet; Arc doesn't need to, because it already writes Parquet.)
- **Query with your existing tools.** Spark, Trino, DuckDB, Snowflake, Dremio, and PyIceberg all read Iceberg. Point them at Arc's data instead of building a custom connector.
- **Ingest is untouched.** The export runs on a background timer and never touches Arc's high-throughput write path.

## How it works

1. Arc ingests as usual, writing Parquet under `{database}/{measurement}/{Y}/{M}/{D}/{H}/`.
2. On a timer (default every 5 minutes), the reconciler walks each measurement's Parquet files and diffs them, by path and size, against the Iceberg table's current file set.
3. It commits the delta in one Iceberg snapshot — adding newly-written files and removing files that compaction/retention deleted — **without rewriting any data**. Since 27.01.1 the row-level delete API publishes a rewritten file under a fresh path rather than replacing the original in place, so a partial delete reaches the table as a normal add-and-remove.
4. Old snapshots are expired on a retention policy so metadata stays bounded. A pass that removes any file expires **all** older snapshots, because they reference files Arc has deleted — see [Time travel](#time-travel) below.

Because the reconciler is driven by what's actually on storage (not a transient event stream), it is **self-healing**: a missed or failed pass simply converges on the next tick. Measurements whose file set hasn't changed since the last pass are skipped entirely, so steady state is cheap.

This holds all the way to zero: if retention ages out *every* file in a measurement, the table is reconciled to empty rather than left pointing at files that no longer exist — so external engines see an empty table instead of failing on missing paths.

Tables are created per database/measurement in the namespace `<namespace_prefix>_<database>` (default prefix `arc`), e.g. `arc_mydb.sensors`.

## Quick start

```toml
# arc.toml
[storage]
backend = "local"          # Iceberg export requires a local backend in v1 (see Limitations)

[iceberg]
enabled = true             # default: false
```

Or via environment variable:

```ini
ARC_ICEBERG_ENABLED=true
```

Restart Arc. Within one reconcile interval, ingested measurements appear as Iceberg tables under your storage root (`{local_path}/arc_<database>.db/<measurement>/`).

## Reading the tables

### DuckDB

The simplest way to read a table — point `iceberg_scan` at the table directory:

```sql
INSTALL iceberg; LOAD iceberg;

SELECT count(*)
FROM iceberg_scan('/var/lib/arc/data/arc_mydb.db/cpu');
```

Arc emits a `version-hint.text` in each table's `metadata/` directory, so directory-based readers like DuckDB resolve the current snapshot without needing the exact metadata filename.

### PyIceberg

PyIceberg can read through Arc's SQLite catalog directly:

```python
from pyiceberg.catalog.sql import SqlCatalog

cat = SqlCatalog("arc", **{
    "uri": "sqlite:////var/lib/arc/data/arc.db",     # Arc's catalog DB
    "warehouse": "file:///var/lib/arc/data",          # storage root
})

table = cat.load_table(("arc_mydb", "cpu"))
df = table.scan().to_arrow()
print(df.num_rows, df.column_names)
```

### Apache Spark

Read a table from its directory with the Iceberg runtime and a Hadoop-style catalog, or load it directly:

```python
df = (spark.read.format("iceberg")
      .load("file:///var/lib/arc/data/arc_mydb.db/cpu"))
df.printSchema()
df.createOrReplaceTempView("cpu")
spark.sql("SELECT count(*) FROM cpu").show()
```

### Trino / Snowflake / others

Any engine with an Iceberg connector can read the tables. For engines that require a shared catalog service (Trino's JDBC catalog supports PostgreSQL/MySQL, not SQLite), point the connector at the Iceberg metadata; a shared REST or JDBC catalog in front of the warehouse is the path for broad multi-engine access. See **Limitations** below.

## Configuration reference

| Key (`arc.toml`) | Env var | Default | Meaning |
|---|---|---|---|
| `iceberg.enabled` | `ARC_ICEBERG_ENABLED` | `false` | Enable the export reconciler. |
| `iceberg.reconcile_interval` | `ARC_ICEBERG_RECONCILE_INTERVAL` | `300` | Seconds between reconcile passes. |
| `iceberg.retain_snapshots` | `ARC_ICEBERG_RETAIN_SNAPSHOTS` | `10` | Iceberg snapshots (and metadata versions) kept per table; older are expired to bound metadata growth. An upper bound, not a guarantee: a pass that removes a file expires all older snapshots regardless of this value, because they reference deleted files (see [Time travel](#time-travel)). |
| `iceberg.namespace_prefix` | `ARC_ICEBERG_NAMESPACE_PREFIX` | `arc` | Namespace prefix; tables land in `<prefix>_<database>`. |
| `iceberg.warehouse` | `ARC_ICEBERG_WAREHOUSE` | *storage root* | Root URI where table metadata is written (`file://` or a plain path). Defaults alongside the data. Outside the storage root, Arc cannot publish `version-hint.text` for directory-based readers, and backups copy the warehouse separately. |
| `iceberg.catalog_db_path` | `ARC_ICEBERG_CATALOG_DB_PATH` | *shared auth DB* | SQLite catalog location. |
| `iceberg.orphan_sweep_enabled` | `ARC_ICEBERG_ORPHAN_SWEEP_ENABLED` | `true` | Delete manifest files that no retained metadata version references any more. This is the one thing the exporter deletes that nothing regenerates, so it has an off switch; set `false` and the manifests of expired snapshots are kept forever and copied into every backup. Arc logs a warning at startup when it is off. |

## Schema mapping

Arc's columns map to Iceberg types as follows:

| Arc / Arrow | Iceberg |
|---|---|
| `time` (Timestamp µs, UTC) | `timestamptz` |
| int64 | `long` |
| int32 | `int` |
| float64 | `double` |
| float32 | `float` |
| string | `string` |
| bool | `boolean` |
| decimal128 | `decimal(P,S)` |

Arc's own ingest writes int64, float64, string, bool, and timestamps; the 32-bit and decimal types are there for Parquet that arrives through the bulk import API.

Tables are partitioned by `day(time)`.

### Schema changes

**Adding columns is automatic.** If a measurement gains a column over time, the Iceberg table's schema is evolved to include it, and older files (written before the column existed) stay readable — the new column simply reads as `NULL` for those rows.

**Changing a column's type is not supported.** If a column's type changes (say `value` was written as an integer and later arrives as a float), Iceberg cannot represent both in one column. Arc refuses to reconcile that measurement and logs an error naming the column and both types:

```bash
column "value" type mismatch: Iceberg table has long, new Parquet files have double
(the measurement's column type changed; Iceberg cannot represent both in one column)
```

The Iceberg table is left untouched and stays readable at its last good state, and your other measurements keep exporting normally — one bad measurement never blocks the rest. Arc retries on every reconcile pass, so once the underlying type conflict is resolved the measurement recovers on its own without a restart.

The conflict lives in the data, not in Iceberg, so fix it at the source: keep a measurement's column type stable, or write the new type under a different column or measurement name.

## Time travel

**Arc does not support Iceberg time travel across compaction, retention or a partial DELETE.** Reading the current snapshot is fully supported; reading an older one is only sound while nothing has removed a file since.

The reason is a genuine conflict rather than an omission. Iceberg copy-on-write keeps a superseded data file alive until the snapshots that reference it expire. Arc cannot: it reads a partition with a glob over every Parquet file in it, so a superseded file left in place would be counted twice by every ordinary query. Arc therefore deletes the file, and the snapshots naming it stop being readable.

So that a reader gets a meaningful error rather than one that looks like data loss, a reconcile pass that removes any file now expires every older snapshot. Time travel to one returns:

```
Invalid Configuration Error: Could not find snapshot with id 873009943563408273
```

which is the ordinary result of any Iceberg retention policy, instead of:

```
IO Error: Cannot open file ".../cpu_20261008_155058_567682000.parquet": No such file or directory
```

which is indistinguishable from the object store having lost an object. No readable history is lost by this: a removed file is referenced by every snapshot from the one that added it onward, so each of those had already stopped working.

What this means in practice: compaction runs hourly by default, so on an actively-ingesting measurement expect history to be one snapshot deep most of the time. A measurement that only ever gains files keeps `retain_snapshots` of genuinely readable history, because nothing has been removed.

Two edges worth knowing:

- The expiry applies to `version-hint.text`, which is how directory-based readers resolve the table. Arc also keeps `retain_snapshots + 1` older `v<N>.metadata.json` copies for readers that pin a version, and those still list the pre-expiry snapshots — a consumer reading one directly still gets the `IO Error` until the copy is pruned, roughly `retain_snapshots` passes later.
- On a deployment upgrading into this behaviour, a table's stale history is cleaned by its next pass that removes something. A table whose file set has gone quiet is skipped by the reconciler, so it keeps the old snapshot list until it changes again.

A pass that expires history this way logs at `warn` with the snapshot counts before and after.

If you need reproducible reads of historical state, snapshot the query results rather than the table, or use Arc's backup and restore.

## Limitations (v1)

- **Local storage only.** Iceberg export requires `storage.backend = "local"`. Arc **refuses to start** if Iceberg export is enabled with a non-local primary backend or with cold-tier tiering, because a file migrated to object storage would silently leave the Iceberg table.
- **No cold-tier tiering.** Same reason as above — disable one of `iceberg.enabled` / `tiered_storage.cold.enabled`.
- **Eventual consistency.** The Iceberg view reflects the last reconcile pass, so it lags live ingest by up to `reconcile_interval`. This is expected for a lakehouse export.
- **On-disk portability.** Iceberg metadata references files by absolute path. Tables read fine on the same host; moving a local table to a different path/host requires re-pointing (object-store warehouses avoid this).
- **Catalog discovery.** Catalog-aware access works today via the SQLite catalog (PyIceberg) or by pointing engines at the table directory (DuckDB, Spark). Broad multi-engine *catalog* discovery (Trino, Glue) would use a REST/JDBC catalog in front of the warehouse — a deployment choice beyond v1.
- **Metadata is bounded, not constant.** Each reconcile pass that removes a file writes new manifests and leaves the superseded ones behind, so the metadata directory grows with the removal history rather than with the data. Two mechanisms bound it, both automatic: the orphan sweep (above) deletes manifests no retained metadata version references, and a pass that finds a table at 12 or more data manifests merges them into one. Expect on the order of `retain_snapshots` commits' worth of `.avro` in a steady state. A table whose file set has stopped changing is skipped by the reconciler, so it keeps whatever manifest count it last had until something writes to it again.
- **Clustered deployments.** Exactly one node must run the reconciler. Under the compactor failover lease this is guaranteed; in a static-role cluster, enable Iceberg export where a single compaction-capable node runs.

## Backup & restore

Arc's backup includes the Iceberg warehouse metadata (`metadata.json`, manifest `.avro`, `version-hint.text`) alongside the Parquet data, so a restored deployment keeps its Iceberg tables intact. A warehouse outside the storage root is backed up too, under `iceberg/` in the backup, and restored into the node's configured `iceberg.warehouse`. Both the storage root and the warehouse are recorded by absolute path in the Iceberg metadata, so restore to the same paths; see [Backup & restore](/docs/arc/operations/backup-restore) for the details and the cluster caveat.

## FAQ

**Does this slow down ingestion?** No. The export is a background reconciler; the write path is unchanged.

**Does it duplicate my data?** No. It registers your existing Parquet files by reference. Only small Iceberg metadata is written.

**Can I still use Arc's SQL API?** Yes. Iceberg export is additive — Arc's native query API is unaffected. The same Parquet files serve both.

**What happens to compacted/retained files?** The reconciler reflects them. Retention deletes show up as file removals on the next pass. A compacted file is registered only once its compaction has committed, that is, once its source files are gone; until then the source files stay in the table, so a pass that runs in the middle of a compaction never registers both the sources and their replacement. If a compaction deletes some of its sources and fails on the rest, the compacted file stays out of the table and the surviving sources stay in it until the next compaction cycle's recovery finishes the job: a bounded under-count, never a double count.

**What about the row-level delete API?** A delete that matches every row in a file removes the file, and the next pass drops it from the table. A delete that matches only some rows rewrites the file in place at the same path; the reconciler notices the changed file size and re-registers the file in a single commit, so the table's record count and file size follow the rewrite within one reconcile interval instead of keeping the values from the original registration. That commit merges the table's manifests into one (Iceberg's `commit.manifest-merge.enabled`, enabled for that commit only), which is what lets a path that already left the table come back.
