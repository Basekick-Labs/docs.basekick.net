---
sidebar_position: 2
---

# Parquet Import

Import existing Parquet files directly into Arc. Useful for data lake integration, analytics pipeline output, or migrating from other columnar stores.

:::info Available since v26.02.1
Parquet bulk import is available starting Arc v26.02.1 (February 2026).
:::

:::note Changed in v26.06.2
Parquet import now reads the file in-process (via Apache Arrow) instead of through DuckDB. The request and response are unchanged. Two things to be aware of: `DECIMAL` columns are imported as `DOUBLE`, and empty files / duplicate column names / a `time_column` rename that collides with an existing `time` column are rejected with `400`.
:::

## Endpoint

```
POST /api/v1/import/parquet
```

## Headers

| Header | Required | Default | Description |
|--------|----------|---------|-------------|
| `Authorization` | Yes | - | `Bearer $ARC_TOKEN` |
| `X-Arc-Database` | Yes | - | Target database name (or use `db` query param) |

## Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `measurement` | Yes | - | Target measurement name |
| `time_column` | No | `time` | Name of the timestamp column in the Parquet file |

## Example

```bash
curl -X POST "http://localhost:8000/api/v1/import/parquet?measurement=metrics" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: production" \
  -F "file=@data_export.parquet"
```

## Response

```json
{
  "status": "ok",
  "result": {
    "database": "production",
    "measurement": "metrics",
    "rows_imported": 1200000,
    "partitions_created": 8,
    "time_range_min": "2026-01-01T00:00:00Z",
    "time_range_max": "2026-01-01T07:45:00Z",
    "columns": ["time", "host", "region", "cpu_usage", "mem_usage"],
    "duration_ms": 890
  }
}
```

## Notes

- The Parquet file must contain a timestamp column (default name: `time`). Use the `time_column` parameter if your column has a different name. The time column may be an Arrow `TIMESTAMP` (any unit) or an integer epoch column.
- Arc reads the Parquet file in-process via Apache Arrow and repartitions the data into Arc's hourly partition layout regardless of the source file's structure.
- `DECIMAL` columns are imported as `DOUBLE`. If you need exact decimal precision, use Line Protocol ingestion with a configured decimal column.
- Maximum file size: **500 MB**.
- RBAC: write permissions are checked for the target measurement.

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Missing database/measurement/file; empty file or no rows; `time_column` not found; duplicate column names; or a `time_column` rename that collides with an existing `time` column |
| `403` | Insufficient write permissions |
| `413` | File exceeds 500 MB size limit |
| `422` | Unreadable Parquet file, an unsupported column type, or an unparseable time column |
| `500` | Import execution error |
