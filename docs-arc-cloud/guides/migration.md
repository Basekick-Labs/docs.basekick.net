---
sidebar_position: 7
---

# Migration Guide

Arc Cloud supports bulk import of CSV, Parquet, and line protocol files, making it straightforward to migrate data from InfluxDB or any other source. The import endpoints accept files up to **500 MB** per request and support **gzip** compression.

Throughout this guide, replace the base URL with your instance's URL:

```
https://<instance-id>.arc.<region>.basekick.net
```

## From InfluxDB

### 1. Export Data as Line Protocol

Use the `influx` CLI to export your data in line protocol format:

```bash
influx -database mydb -execute "SELECT * FROM cpu" -format lp > cpu_export.lp
```

For large datasets, export one measurement at a time or add a `WHERE time > ...` clause to split by time range.

### 2. Import into Arc Cloud

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/lp?db=mydb" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/plain" \
  --data-binary @cpu_export.lp
```

With gzip compression (recommended for large files):

```bash
gzip cpu_export.lp

curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/lp?db=mydb" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/plain" \
  -H "Content-Encoding: gzip" \
  --data-binary @cpu_export.lp.gz
```

### 3. Verify

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"q": "SELECT count(*) FROM cpu"}'
```

## From CSV

Arc Cloud can import CSV files directly. You need to specify the measurement name and which column contains the timestamp.

### Prepare Your CSV

Ensure your CSV has a header row and a parseable timestamp column:

```csv
timestamp,host,region,usage,temperature
2026-03-23T12:00:00Z,server01,us-east,0.64,72.1
2026-03-23T12:01:00Z,server02,eu-west,0.38,68.4
```

### Import

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/csv?db=mydb&measurement=sensors&time_column=timestamp" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/csv" \
  --data-binary @data.csv
```

### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `db` | Target database | required |
| `measurement` | Target measurement name | required |
| `time_column` | Name of the timestamp column | `timestamp` |
| `delimiter` | Column delimiter | `,` |
| `tag_columns` | Comma-separated list of columns to treat as tags | none (all columns are fields) |

### Example with Custom Delimiter and Tags

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/csv?db=mydb&measurement=sensors&time_column=ts&delimiter=;&tag_columns=host,region" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/csv" \
  --data-binary @data.csv
```

## From Parquet

Parquet is ideal for migrating large datasets. The columnar format is compact and fast to import.

```bash
curl -X POST "https://<instance-id>.arc.<region>.basekick.net/api/v1/import/parquet?db=mydb&measurement=sensors" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @data.parquet
```

The Parquet file should include a timestamp column. Arc will auto-detect common timestamp column names (`time`, `timestamp`, `ts`, `datetime`). To specify explicitly, add `&time_column=your_column` to the query string.

## Tips for Large Migrations

- **Split large exports** into files under 500 MB each. For line protocol exports, split by measurement or time range.
- **Use gzip compression** to reduce transfer time. All import endpoints accept `Content-Encoding: gzip`.
- **Import in parallel** -- Arc Cloud handles concurrent imports safely. You can run multiple `curl` commands simultaneously for different measurements.
- **Verify row counts** after import by querying `SELECT count(*) FROM <measurement>` and comparing against the source.
