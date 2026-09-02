---
title: "Data Lifecycle"
description: "Manage how long data lives in Arc: retention windows, WHERE-clause deletes that rewrite Parquet files, and continuous queries that downsample into materialized views."
---

These features control what happens to data after it lands. In Arc OSS each one is triggered through the API; scheduled execution is an [Arc Enterprise](/arc-enterprise/operations/automated-scheduling/) feature.

- **[Retention policies](/arc/data-lifecycle/retention-policies/)** — Define retention windows per database or measurement.
- **[Delete operations](/arc/data-lifecycle/delete-operations/)** — Remove rows with a WHERE predicate by rewriting Parquet files.
- **[Continuous queries](/arc/data-lifecycle/continuous-queries/)** — Downsample high-frequency data into materialized views.
