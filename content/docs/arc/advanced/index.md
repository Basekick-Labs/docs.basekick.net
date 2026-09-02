---
title: "Advanced"
description: "How Arc works underneath: data-time partitioning, the optional ingestion WAL, scheduled file compaction, the query-path caches, and edge-to-hub file sync."
---

These pages explain mechanisms rather than tasks — useful when tuning a deployment or working out why Arc behaved the way it did.

- **[Data-time partitioning](/arc/advanced/data-time-partitioning/)** — Why files are partitioned by event time, not ingestion time.
- **[Write-ahead log](/arc/advanced/wal/)** — The optional WAL that bounds data loss on a crash.
- **[File compaction](/arc/advanced/compaction/)** — Merging small Parquet files on an hourly and daily schedule.
- **[Query caching](/arc/advanced/caching/)** — The three caches on the query path and what each memoizes.
- **[Edge sync](/arc/advanced/edge-sync/)** — Shipping Parquet files from an edge spoke to a central hub.
