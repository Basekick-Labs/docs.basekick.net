---
sidebar_position: 2
---

# Parquet Import

Import existing Parquet files directly into Arc. Useful for data lake integration, analytics pipeline output, or migrating from other columnar stores.

:::info Available since v26.02.1
Parquet bulk import is available starting Arc v26.02.1 (February 2026).
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

- The Parquet file must contain a timestamp column (default name: `time`). Use the `time_column` parameter if your column has a different name.
- DuckDB reads the Parquet file natively -- no conversion overhead.
- Data is repartitioned into Arc's hourly partition layout regardless of the source file's structure.
- Gzip-compressed Parquet files are automatically detected and decompressed.
- Maximum file size: **500 MB** (after decompression).
- RBAC: write permissions are checked for the target measurement.

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Missing database, measurement, or file |
| `403` | Insufficient write permissions |
| `413` | File exceeds 500 MB size limit |
| `500` | Import execution error |
