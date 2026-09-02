---
title: "Data Import"
description: "Bulk-load existing data into Arc from CSV, Parquet, and InfluxDB Line Protocol files through the import endpoints, with type inference and hourly partitioning."
---

Bulk import is for loading data you already have. For continuous writes, use the ingestion endpoints in the [API reference](/arc/api-reference/overview/) instead.

- **[CSV](/arc/data-import/csv/)** — Upload a CSV file, map its timestamp column, and let Arc infer the rest.
- **[Parquet](/arc/data-import/parquet/)** — Load existing Parquet files, preserving column types.
- **[Line Protocol](/arc/data-import/line-protocol/)** — Load .lp or .txt files, plain or gzip-compressed.
