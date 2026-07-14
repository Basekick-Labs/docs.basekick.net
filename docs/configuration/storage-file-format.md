---
sidebar_position: 4
---

# Storage File Format

Arc stores measurement data as columnar files on disk. You choose the on-disk format once, at deploy time, with a single setting:

```toml
[storage]
file_format = "parquet"   # "parquet" (default) or "vortex"
```

Environment variable: `ARC_STORAGE_FILE_FORMAT=parquet|vortex`.

- **`parquet`** (default) — Apache Parquet. The mature, fully-featured format used by
  every Arc deployment to date. Works with all storage backends (local, S3, MinIO,
  Azure) and every Arc feature.
- **`vortex`** — the [Vortex](https://github.com/vortex-data/vortex) columnar format.
  Optimized for point lookups and low, consistent scan latency. Opt-in, with the
  limitations described below.

## The choice is deployment-wide and immutable

The format applies to the **entire deployment**, not per-measurement. Once Arc has
written data in one format, it **refuses to start** if `storage.file_format` is changed
to the other — mixing formats in one deployment is unsupported. Pick the format at
deploy time.

On first write, Arc records the chosen format in an `.arc_format` marker at the storage
root. On every subsequent boot it verifies the configured format matches the data on
disk (and fails fast on a mismatch or on a storage directory that somehow contains both
formats).

To switch formats, stand up a new deployment with the new `file_format` and re-ingest or
migrate the data.

## When to choose Vortex

**Ingest throughput.** On Arc's MessagePack Columnar path, Vortex ingests **faster** than
Parquet — a sustained IOT benchmark (12 workers, batch 1000, local backend) measured
~25.5M rec/s at p99 1.90ms for Vortex vs ~20.9M rec/s at p99 2.67ms for Snappy Parquet.
Arc writes Vortex with lightweight encodings (dictionary for low-cardinality string tags,
direct primitive buffers for numeric columns) tuned for write speed, so the ingest hot
path does less work than Parquet's.

**Query latency.** Vortex also shines on **point lookups and random access** (single-row /
wide-column reads) and delivers **more consistent scan latency** (lower variance between
cold and warm reads).

**Not for storage savings.** Because Arc's Vortex writer favors speed over compression,
on-disk files are **larger** than well-configured (ZSTD) Parquet. Choose Vortex for
**throughput and latency**, not to save disk space. (Compression can be recovered later at
compaction time.)

## Vortex limitations (v1)

Vortex support is new and intentionally scoped. Understand these before enabling it:

| Area | Parquet | Vortex (v1) |
|---|---|---|
| Storage backends | local, S3, MinIO, Azure | **local filesystem only** |
| Tiered storage (hot/cold to S3/Azure) | Supported (Enterprise) | **Not supported** |
| Compaction | Full, incl. `(tags, time)` de-duplication | Compaction runs, but **without de-duplication** |
| `NULL` in `DECIMAL` columns | Supported | **Rejected at ingest** (other columns keep full `NULL` support) |
| Partition pruning / parallel scan | Yes | Not yet (whole-measurement scans) |
| Query, backup, restore, retention, delete | Yes | Yes |

Details:

- **Local filesystem only.** Vortex reads over object storage are not supported in Arc's
  embedded query engine yet. Arc **refuses to start** if `file_format = "vortex"` is
  combined with `storage.backend` other than `local`, or with cold-tier tiering enabled.
- **No compaction de-duplication.** Arc's Parquet compaction can collapse duplicate
  `(tags, time)` rows. That path relies on Parquet file metadata that Vortex does not
  expose, so Vortex compaction merges files without de-duplicating. Compaction still runs
  and still reduces file count.
- **`NULL` values are otherwise fully preserved.** Arc writes Vortex with per-value
  validity, so `NULL`s round-trip correctly for integer, float, string, boolean, and
  timestamp columns. The one exception is `DECIMAL` columns containing `NULL`s, which are
  rejected at ingest time (fail-loud) rather than silently altered.

## Example

```toml
[storage]
backend = "local"
local_path = "/var/lib/arc/data"
file_format = "vortex"
```

Everything else — ingestion API, SQL queries, retention, backup/restore — works exactly
as with Parquet. Arc transparently reads and writes Vortex files; your clients see no
difference.
