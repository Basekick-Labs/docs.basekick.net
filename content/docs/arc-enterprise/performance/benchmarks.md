---
title: Performance Benchmarks
description: Where Arc Enterprise benchmark results are published, and how to reproduce them on your own cluster hardware with make bench before sizing writer, reader, and compactor nodes.
---

Benchmark results for Arc are published on the Basekick blog rather than in these docs, so that every figure stays tied to the hardware, dataset, and Arc version it was measured on.

## Published results

Start with the ClickBench summary, which covers methodology, dataset, and how Arc was configured for each run:

- **[Arc on ClickBench](https://basekick.net/blog/arc-fastest-timeseries-database-clickbench)** — methodology and headline results

Per-database comparisons:

- [vs InfluxDB](https://basekick.net/blog/arc-clickbench-vs-influxdb)
- [vs TimescaleDB](https://basekick.net/blog/arc-clickbench-vs-timescaledb)
- [vs DuckDB](https://basekick.net/blog/arc-clickbench-vs-duckdb)
- [vs CrateDB](https://basekick.net/blog/arc-clickbench-vs-cratedb)
- [vs StarRocks](https://basekick.net/blog/arc-clickbench-vs-starrocks)
- [vs Elasticsearch](https://basekick.net/blog/arc-clickbench-vs-elasticsearch)

Additional runs:

- [Cold-run results](https://basekick.net/blog/arc-clickbench-cold-runs) — first-query latency against object storage
- [Log benchmark](https://basekick.net/blog/arc-log-benchmark-2026)

## Reproduce locally

The benchmark harness ships in the Arc repository:

```bash
git clone https://github.com/basekick-labs/arc.git
cd arc
make bench
```

## Benchmarking an Enterprise cluster

Published numbers are measured on a single node. A clustered deployment adds variables that dominate the result, so size from your own measurements rather than from the blog figures:

- **Node roles.** Writers, readers, and compactors are benchmarked separately — a reader's query throughput is unrelated to a writer's ingest ceiling. See [Clustering](/arc-enterprise/configuration/clustering/).
- **Storage topology.** Shared object storage and local storage with peer replication have different latency profiles. See [Deployment patterns](/arc-enterprise/configuration/deployment-patterns/).
- **Tiered storage.** Queries that reach cold-tier data pay a retrieval cost that hot-tier queries do not. See [Tiered storage](/arc-enterprise/data-lifecycle/tiered-storage/).
- **Query governance.** Rate limits and row limits cap throughput by design; benchmark with the limits you intend to run. See [Query governance](/arc-enterprise/query/query-governance/).

## Next steps

- **[Getting started](/arc-enterprise/getting-started/)** — run Arc Enterprise locally
- **[Configuration](/arc-enterprise/configuration/overview/)** — tune for your workload
- **[Python SDK](/arc-enterprise/sdks/python/)** — client for driving load
