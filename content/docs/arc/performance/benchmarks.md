---
title: "Performance Benchmarks"
description: "Where to find Arc's published ClickBench and ingestion benchmark results, including the per-database comparison posts and the methodology behind each recorded run."
---

Benchmark results are published on the Basekick blog rather than duplicated here. A number in the docs goes stale the moment the hardware, the dataset, or the release changes; the blog posts keep each result attached to the machine, the dataset, and the Arc version that produced it.

## ClickBench

Arc's ClickBench results, including the test hardware, the dataset, and the full per-query timings:

- **[Arc on ClickBench](https://basekick.net/blog/arc-fastest-timeseries-database-clickbench?utm_source=docs&utm_medium=referral&utm_campaign=arc)** — the headline results and how the runs were performed.
- **[Cold-run results](https://basekick.net/blog/arc-clickbench-cold-runs?utm_source=docs&utm_medium=referral&utm_campaign=arc)** — query performance with caches flushed.

Every ClickBench submission is independently verifiable at [benchmark.clickhouse.com](https://benchmark.clickhouse.com).

## Comparisons with other databases

Each post runs the same benchmark on the same instance type against one other system:

- [Arc vs InfluxDB](https://basekick.net/blog/arc-clickbench-vs-influxdb?utm_source=docs&utm_medium=referral&utm_campaign=arc)
- [Arc vs TimescaleDB](https://basekick.net/blog/arc-clickbench-vs-timescaledb?utm_source=docs&utm_medium=referral&utm_campaign=arc)
- [Arc vs DuckDB](https://basekick.net/blog/arc-clickbench-vs-duckdb?utm_source=docs&utm_medium=referral&utm_campaign=arc)
- [Arc vs CrateDB](https://basekick.net/blog/arc-clickbench-vs-cratedb?utm_source=docs&utm_medium=referral&utm_campaign=arc)
- [Arc vs StarRocks](https://basekick.net/blog/arc-clickbench-vs-starrocks?utm_source=docs&utm_medium=referral&utm_campaign=arc)
- [Arc vs Elasticsearch](https://basekick.net/blog/arc-clickbench-vs-elasticsearch?utm_source=docs&utm_medium=referral&utm_campaign=arc)

## Log workloads

- **[Arc log benchmark](https://basekick.net/blog/arc-log-benchmark-2026?utm_source=docs&utm_medium=referral&utm_campaign=arc)** — ingestion and query performance on log-shaped data.

## Reproducing a run

The benchmark harnesses are public, so you can re-run any of these against your own hardware:

- [ClickBench](https://github.com/ClickHouse/ClickBench) — the upstream harness and dataset.
- [Arc repository](https://github.com/basekick-labs/arc) — Arc itself, plus the configuration used in the published runs.

Measuring on hardware that resembles your production deployment is worth more than any published figure. Throughput depends heavily on batch size, ingestion protocol, storage backend, and whether the [WAL](/arc/advanced/wal/) is enabled.

## Related

- [Storage file format](/arc/configuration/storage-file-format/) — Arc's on-disk Parquet format and its compression.
- [File compaction](/arc/advanced/compaction/) — why small files slow queries down.
- [Query caching](/arc/advanced/caching/) — what Arc memoizes on the query path.
