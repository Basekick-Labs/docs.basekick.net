---
sidebar_position: 1
---

# CSV Import

Import CSV files into Arc via the REST API. DuckDB reads the file, auto-detects column types, partitions data by hour, and writes optimized Parquet files to storage.

:::info Available since v26.02.1
CSV bulk import is available starting Arc v26.02.1 (February 2026).
:::

## Endpoint

```
POST /api/v1/import/csv
```

## Headers

| Header | Required | Default | Description |
|--------|----------|---------|-------------|
| `Authorization` | Yes | - | `Bearer YOUR_TOKEN` |
| `X-Arc-Database` | Yes | - | Target database name (or use `db` query param) |

## Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `measurement` | Yes | - | Target measurement name |
| `time_column` | No | `time` | Name of the timestamp column in the CSV |
| `time_format` | No | auto-detect | Timestamp format: `epoch_s`, `epoch_ms`, `epoch_us`, `epoch_ns`, or leave empty for auto-detection |
| `delimiter` | No | `,` | Column delimiter character |
| `skip_rows` | No | `0` | Number of header/metadata rows to skip before the CSV header |

## Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/import/csv?measurement=sensors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Arc-Database: iot" \
  -F "file=@sensor_data.csv"
```

## Example with Options

```bash
# TSV file with epoch seconds and 2 metadata rows to skip
curl -X POST "http://localhost:8000/api/v1/import/csv?measurement=telemetry&time_column=ts&time_format=epoch_s&delimiter=%09&skip_rows=2" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Arc-Database: satellites" \
  -F "file=@telemetry_export.tsv"
```

## Response

```json
{
  "status": "ok",
  "result": {
    "database": "iot",
    "measurement": "sensors",
    "rows_imported": 50000,
    "partitions_created": 3,
    "time_range_min": "2026-01-15T00:00:00Z",
    "time_range_max": "2026-01-15T02:30:00Z",
    "columns": ["time", "temperature", "humidity", "device_id"],
    "duration_ms": 245
  }
}
```

## Notes

- The `measurement` parameter is **required** -- unlike Line Protocol import where measurements are embedded in the data.
- The time column is renamed to `time` in the output Parquet files.
- Data is automatically partitioned by hour for optimal query performance.
- Gzip-compressed CSV files (`.csv.gz`) are automatically detected and decompressed.
- Maximum file size: **500 MB** (after decompression).
- RBAC: write permissions are checked for the target measurement.
- Column types are auto-detected by DuckDB. Numeric columns become `DOUBLE`, text columns become `VARCHAR`.

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Missing database, measurement, or file |
| `403` | Insufficient write permissions |
| `413` | File exceeds 500 MB size limit |
| `500` | Import execution error |
