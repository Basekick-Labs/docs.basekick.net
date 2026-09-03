---
title: "Storage File Format"
description: "Arc's on-disk file format: every deployment stores measurement data as Apache Parquet, with Snappy on the ingest path and ZSTD after compaction."
---

Arc stores measurement data as columnar files on disk. The format is **Apache Parquet**
for every deployment and every storage backend — there is no setting to change it.

## Parquet everywhere

Parquet is used across all storage backends (local, S3, MinIO, Azure) and by every Arc
feature: queries, compaction, retention, delete, backup and restore, and tiered storage.
Because the files are ordinary Parquet, they are also readable directly by external
tools — DuckDB, Spark, Polars, pandas — without going through Arc.

There is no `storage.file_format` key, and no pluggable on-disk format. A `file_format`
setting in an `arc.toml` is ignored.

## Compression

Compression differs between freshly-ingested files and compacted files:

| Stage | Codec | Configurable |
|---|---|---|
| Ingest (flushed buffers) | Snappy by default | Yes — `ingest.compression` |
| After compaction | ZSTD | No — fixed |

Snappy keeps the ingest hot path cheap. Compaction rewrites those files with ZSTD, which
is the main reason compacted files are substantially smaller than the files they replace.

See the [configuration overview](/arc/configuration/overview/) for `ingest.compression`,
and [file compaction](/arc/advanced/compaction/) for how and when files are rewritten.

## Layout on disk

Files are laid out by database, measurement, and hour:

```text
arc/                              # Bucket or local path
└── default/                      # Database
    └── cpu/                      # Measurement
        └── 2025/10/08/           # Date
            └── 14/               # Hour
                ├── file1.parquet
                └── file2.parquet
```

This is what makes partition pruning effective: a query with a time bound can skip whole
directories without opening the files inside them. See
[data time partitioning](/arc/advanced/data-time-partitioning/) for details.
