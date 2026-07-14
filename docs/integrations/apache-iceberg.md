---
sidebar_position: 1
---

# Apache Iceberg Export

Publish Arc's data as **Apache Iceberg** tables so any Iceberg-aware engine — Spark, Trino, DuckDB, Snowflake, PyIceberg — can query it directly, without going through Arc.

:::info Availability
Iceberg export is available in **Arc 26.09.1+**. Enable it with `iceberg.enabled = true`.
:::

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
2. On a timer (default every 5 minutes), the reconciler walks each measurement's Parquet files and diffs them against the Iceberg table's current file set.
3. It commits the delta in one Iceberg snapshot — adding newly-written files and removing files that compaction/retention deleted — **without rewriting any data**.
4. Old snapshots are expired on a retention policy so metadata stays bounded.

Because the reconciler is driven by what's actually on storage (not a transient event stream), it is **self-healing**: a missed or failed pass simply converges on the next tick. Measurements whose file set hasn't changed since the last pass are skipped entirely, so steady state is cheap.

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

```bash
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
| `iceberg.retain_snapshots` | `ARC_ICEBERG_RETAIN_SNAPSHOTS` | `10` | Iceberg snapshots (and metadata versions) kept per table; older are expired to bound metadata growth. |
| `iceberg.namespace_prefix` | `ARC_ICEBERG_NAMESPACE_PREFIX` | `arc` | Namespace prefix; tables land in `<prefix>_<database>`. |
| `iceberg.warehouse` | `ARC_ICEBERG_WAREHOUSE` | *storage root* | Root URI where table metadata is written. Defaults alongside the data. |
| `iceberg.catalog_db_path` | `ARC_ICEBERG_CATALOG_DB_PATH` | *shared auth DB* | SQLite catalog location. |

## Schema mapping

Arc's columns map to Iceberg types as follows:

| Arc / Arrow | Iceberg |
|---|---|
| `time` (Timestamp µs, UTC) | `timestamptz` |
| int64 | `long` |
| float64 | `double` |
| string | `string` |
| bool | `boolean` |
| decimal128 | `decimal(P,S)` |

Tables are partitioned by `day(time)`. If a measurement gains columns over time, the Iceberg table's schema is evolved automatically and older files (without the new column) remain readable.

## Limitations (v1)

- **Local storage only.** Iceberg export requires `storage.backend = "local"`. Arc **refuses to start** if Iceberg export is enabled with a non-local primary backend or with cold-tier tiering, because a file migrated to object storage would silently leave the Iceberg table.
- **No cold-tier tiering.** Same reason as above — disable one of `iceberg.enabled` / `tiered_storage.cold.enabled`.
- **Eventual consistency.** The Iceberg view reflects the last reconcile pass, so it lags live ingest by up to `reconcile_interval`. This is expected for a lakehouse export.
- **On-disk portability.** Iceberg metadata references files by absolute path. Tables read fine on the same host; moving a local table to a different path/host requires re-pointing (object-store warehouses avoid this).
- **Catalog discovery.** Catalog-aware access works today via the SQLite catalog (PyIceberg) or by pointing engines at the table directory (DuckDB, Spark). Broad multi-engine *catalog* discovery (Trino, Glue) would use a REST/JDBC catalog in front of the warehouse — a deployment choice beyond v1.
- **Clustered deployments.** Exactly one node must run the reconciler. Under the compactor failover lease this is guaranteed; in a static-role cluster, enable Iceberg export where a single compaction-capable node runs.

## Backup & restore

Arc's backup includes the Iceberg warehouse metadata (`metadata.json`, manifest `.avro`, `version-hint.text`) alongside the Parquet data, so a restored deployment keeps its Iceberg tables intact.

## FAQ

**Does this slow down ingestion?** No. The export is a background reconciler; the write path is unchanged.

**Does it duplicate my data?** No. It registers your existing Parquet files by reference. Only small Iceberg metadata is written.

**Can I still use Arc's SQL API?** Yes. Iceberg export is additive — Arc's native query API is unaffected. The same Parquet files serve both.

**What happens to compacted/retained files?** The reconciler reflects them: when compaction replaces small files with a larger one, or retention deletes old files, the next pass updates the Iceberg table's file set accordingly.
