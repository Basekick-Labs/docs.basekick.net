---
sidebar_position: 3
---

# Line Protocol Bulk Import

Import InfluxDB Line Protocol files into Arc. Enables one-command migration from InfluxDB by uploading `.lp` or `.txt` files (plain or gzip-compressed).

:::info Available since v26.02.1
Line Protocol bulk import is available starting Arc v26.02.1 (February 2026).
:::

:::tip Streaming vs. Bulk
This page covers **bulk file import** via `POST /api/v1/import/lp`. For streaming ingestion of Line Protocol data (real-time writes), see the [Line Protocol write endpoints](/arc/api-reference/overview#data-ingestion) in the API Reference.
:::

## Endpoint

```
POST /api/v1/import/lp
```

## Headers

| Header | Required | Default | Description |
|--------|----------|---------|-------------|
| `Authorization` | Yes | - | `Bearer $ARC_TOKEN` |
| `X-Arc-Database` | Yes | - | Target database name (or use `db` query param) |

## Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `measurement` | No | *(all)* | Filter to a single measurement from the LP file |
| `precision` | No | `ns` | Timestamp precision: `ns`, `us`, `ms`, `s` |

## Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/import/lp" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: mydb" \
  -F "file=@export.lp"
```

## Example with Precision

```bash
# Import LP file with second-precision timestamps
curl -X POST "http://localhost:8000/api/v1/import/lp?precision=s" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "X-Arc-Database: mydb" \
  -F "file=@export_seconds.lp"
```

## Response

```json
{
  "status": "ok",
  "result": {
    "database": "mydb",
    "measurements": ["cpu", "mem", "disk"],
    "rows_imported": 150000,
    "precision": "ns",
    "duration_ms": 342
  }
}
```

## InfluxDB Migration

Export from InfluxDB and import directly into Arc:

```bash
# Export from InfluxDB 1.x
influx -execute "SELECT * FROM cpu" -database mydb -format lp > export.lp

# Import to Arc
curl -X POST "http://localhost:8000/api/v1/import/lp" \
  -H "X-Arc-Database: mydb" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -F "file=@export.lp"
```

## How It Works

Data flows through Arc's high-performance columnar ingest pipeline (ArrowBuffer -> ArrowWriter -> Parquet -> storage) -- the same path used by streaming LP ingestion. This means bulk imports benefit from the same throughput, sort optimization, and hourly partitioning.

## Notes

- **Multi-measurement** -- a single LP file can contain multiple measurements; all are imported in one request.
- **Precision-aware** -- timestamps are losslessly converted from the specified precision to Arc's internal microsecond format.
- **Gzip support** -- compressed files (`.lp.gz`) are automatically detected and decompressed via magic bytes.
- **RBAC** -- write permissions are checked for every measurement in the file.
- Maximum file size: **500 MB** (after decompression).

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Missing database, invalid precision, or no file uploaded |
| `403` | Insufficient write permissions for one or more measurements |
| `413` | File exceeds 500 MB size limit |
| `500` | Import execution error |
