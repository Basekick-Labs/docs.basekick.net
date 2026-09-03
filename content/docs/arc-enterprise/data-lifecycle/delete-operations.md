---
title: "Delete Operations"
description: "Delete data from an Arc Enterprise cluster by rewriting Parquet files: enable delete in arc.toml, scope by measurement and time range, and audit every deletion."
---

Arc supports deleting data using a rewrite-based approach that provides precise deletion with zero overhead on write and query operations.

<Callout type="warn" title="Configuration Required">
Delete operations must be explicitly enabled in configuration for safety.
</Callout>

## Overview

Arc's delete operations provide:
- **Precise Control**: Delete specific rows using WHERE clauses
- **Zero Runtime Overhead**: No performance impact on writes or queries
- **Physical Removal**: Data is permanently removed by rewriting Parquet files
- **Safety Mechanisms**: Multiple safeguards prevent accidental deletion
- **Dry Run Mode**: Test operations before execution

## How it works

Arc uses a rewrite-based deletion approach:

### 1. Find affected files

Scan the measurement directory to identify Parquet files containing rows that match the WHERE clause.

### 2. Rewrite files

For each affected file:
1. Load the file into an Arrow table
2. Filter out matching rows: `SELECT * FROM table WHERE NOT (delete_clause)`
3. Write filtered data to a temporary file
4. Atomically replace the original file using `os.replace()`

### 3. Cleanup

- Files that become empty after filtering are deleted entirely
- Files with remaining data are replaced with their rewritten versions
- All operations use atomic file replacement to ensure data integrity

### Atomic safety

System crashes during deletion result in either the old file or the new file being present, never corruption or partial writes.

## Configuration

Delete operations must be explicitly enabled and configured.

### Configuration file

Edit `arc.toml`:

```toml
[delete]
enabled = true
confirmation_threshold = 10000
max_rows_per_delete = 1000000
```

### Environment variables

```bash
export DELETE_ENABLED=true
export DELETE_CONFIRMATION_THRESHOLD=10000
export DELETE_MAX_ROWS=1000000
```

### Configuration parameters

- `enabled` (boolean): Enable/disable delete functionality (default: `false`)
- `confirmation_threshold` (integer): Row count requiring explicit confirmation (default: `10000`)
- `max_rows_per_delete` (integer): Maximum rows allowed per operation (default: `1000000`)

## API endpoints

### Delete data

Execute a delete operation:

```bash
POST /api/v1/delete
```

**Request Body**:
```json
{
  "database": "telegraf",
  "measurement": "cpu",
  "where": "host = 'server01' AND time < '2024-01-01'",
  "dry_run": false,
  "confirm": false
}
```

**Parameters**:
- `database` (string, required): Target database name
- `measurement` (string, required): Target measurement name
- `where` (string, required): SQL WHERE clause for deletion
- `dry_run` (boolean, optional): Test without deleting (default: `false`)
- `confirm` (boolean, optional): Confirm large operations (default: `false`)

**Response**:
```json
{
  "deleted_count": 15000,
  "affected_files": 3,
  "rewritten_files": 2,
  "deleted_files": 1,
  "execution_time_ms": 1250,
  "files": [
    {
      "path": "/data/telegraf/cpu/2023-12-15.parquet",
      "action": "rewritten",
      "rows_before": 10000,
      "rows_after": 5000
    },
    {
      "path": "/data/telegraf/cpu/2023-12-20.parquet",
      "action": "deleted",
      "rows_before": 5000,
      "rows_after": 0
    }
  ]
}
```

### Get configuration

Retrieve current delete configuration:

```bash
GET /api/v1/delete/config
```

**Response**:
```json
{
  "enabled": true,
  "confirmation_threshold": 10000,
  "max_rows_per_delete": 1000000
}
```

## Safety mechanisms

### 1. WHERE clause required

Delete operations **must** include a WHERE clause to prevent accidental full-table deletion.

**Intentional Full Delete**:
```json
{
  "where": "1=1"  // Explicitly delete all rows
}
```

### 2. Confirmation threshold

Operations exceeding the configured threshold require explicit confirmation:

```json
{
  "where": "time < '2024-01-01'",
  "confirm": true  // Required if deleted_count > threshold
}
```

**Without Confirmation**:
```json
{
  "error": "Operation would delete 15000 rows, exceeding threshold of 10000. Set confirm=true to proceed."
}
```

### 3. Maximum rows limit

Hard cap prevents extremely large operations that could exhaust resources:

```json
{
  "error": "Operation would delete 2000000 rows, exceeding maximum of 1000000"
}
```

### 4. Atomic file replacement

Files are replaced atomically using `os.replace()`, ensuring:
- No partial writes
- No data corruption
- Recovery from crashes (either old or new file exists)

## Usage examples

### Example 1: delete old data

```python
import os
import requests

ARC_TOKEN = os.environ["ARC_TOKEN"]

# Delete data older than a specific date
response = requests.post(
    "http://localhost:8000/api/v1/delete",
    headers={"Authorization": f"Bearer {ARC_TOKEN}"},
    json={
        "database": "telegraf",
        "measurement": "cpu",
        "where": "time < '2024-01-01'"
    }
)

print(f"Deleted {response.json()['deleted_count']} rows")
print(f"Execution time: {response.json()['execution_time_ms']}ms")
```

### Example 2: delete specific host data

```python
import os

ARC_TOKEN = os.environ["ARC_TOKEN"]

# Delete data from a specific host
response = requests.post(
    "http://localhost:8000/api/v1/delete",
    headers={"Authorization": f"Bearer {ARC_TOKEN}"},
    json={
        "database": "telegraf",
        "measurement": "cpu",
        "where": "host = 'server01' OR host = 'server02'"
    }
)
```

### Example 3: dry run first

```python
import os

ARC_TOKEN = os.environ["ARC_TOKEN"]

# Always test with dry run before deleting
dry_run = requests.post(
    "http://localhost:8000/api/v1/delete",
    headers={"Authorization": f"Bearer {ARC_TOKEN}"},
    json={
        "database": "telegraf",
        "measurement": "cpu",
        "where": "host = 'server01'",
        "dry_run": True
    }
)

print(f"Would delete {dry_run.json()['deleted_count']} rows")
print(f"Affected files: {dry_run.json()['affected_files']}")

# Review the files that would be affected
for file in dry_run.json()['files']:
    print(f"  {file['path']}: {file['rows_before']} -> {file['rows_after']} rows")

# If satisfied, execute for real
if input("Proceed? (yes/no): ") == "yes":
    result = requests.post(
        "http://localhost:8000/api/v1/delete",
        headers={"Authorization": f"Bearer {ARC_TOKEN}"},
        json={
            "database": "telegraf",
            "measurement": "cpu",
            "where": "host = 'server01'",
            "dry_run": False
        }
    )
    print(f"Deleted {result.json()['deleted_count']} rows")
```

### Example 4: delete with confirmation

```python
import os

ARC_TOKEN = os.environ["ARC_TOKEN"]

# Large delete requiring confirmation
response = requests.post(
    "http://localhost:8000/api/v1/delete",
    headers={"Authorization": f"Bearer {ARC_TOKEN}"},
    json={
        "database": "telegraf",
        "measurement": "cpu",
        "where": "time < '2023-01-01'",
        "confirm": True  # Explicitly confirm large operation
    }
)
```

### Example 5: complex WHERE clause

```python
import os

ARC_TOKEN = os.environ["ARC_TOKEN"]

# Delete based on multiple conditions
response = requests.post(
    "http://localhost:8000/api/v1/delete",
    headers={"Authorization": f"Bearer {ARC_TOKEN}"},
    json={
        "database": "telegraf",
        "measurement": "cpu",
        "where": """
            host IN ('server01', 'server02', 'server03')
            AND time BETWEEN '2023-01-01' AND '2023-06-30'
            AND usage_idle < 10
        """
    }
)
```

## Performance characteristics

Delete operations are computationally expensive but designed for infrequent use:

### Execution times

**Small Files** (10MB):
- Read + Filter + Write: ~50-100ms per file

**Medium Files** (100MB):
- Read + Filter + Write: ~500ms-1s per file

**Large Files** (1GB):
- Read + Filter + Write: ~2-5s per file

### Performance factors

- **File Size**: Larger files take longer to rewrite
- **Selectivity**: Fewer deleted rows = faster (less data movement)
- **Storage I/O**: Disk speed affects read/write performance
- **Concurrent Load**: Other operations may slow deletion

## Best practices

### 1. Keep disabled by default

Only enable delete operations when needed:

```toml
[delete]
enabled = false  # Enable only when necessary
```

### 2. Always use dry run

Test operations before execution to verify scope:

```python
# Step 1: Dry run
result = requests.post(..., json={"dry_run": True})
print(f"Would delete {result['deleted_count']} rows")

# Step 2: Review affected files
for file in result['files']:
    print(f"{file['path']}: {file['action']}")

# Step 3: Execute if satisfied
result = requests.post(..., json={"dry_run": False, "confirm": True})
```

### 3. Consider retention policies

For time-based deletion, use [retention policies](/arc-enterprise/data-lifecycle/retention-policies/) instead:

```python
# Instead of manual deletes:
# requests.post("/api/v1/delete", json={"where": "time < '2024-01-01'"})

# Use retention policies:
requests.post("/api/v1/retention", json={
    "retention_days": 90,
    "buffer_days": 7
})
```

### 4. Monitor execution times

Track deletion performance for capacity planning:

```python
import time

start = time.time()
result = requests.post("/api/v1/delete", json={...})
elapsed = time.time() - start

print(f"Deleted {result['deleted_count']} rows in {elapsed:.2f}s")
```

### 5. Batch large deletes

Break large deletions into smaller batches by time range:

```python
from datetime import datetime, timedelta

# Instead of one large delete:
# WHERE time < '2023-01-01'

# Batch by month:
start = datetime(2022, 1, 1)
while start < datetime(2023, 1, 1):
    end = start + timedelta(days=30)

    requests.post("/api/v1/delete", json={
        "where": f"time >= '{start.isoformat()}' AND time < '{end.isoformat()}'"
    })

    start = end
```

### 6. Understand storage impact

Deletion rewrites files, which may temporarily increase storage usage:

```python
# Before deletion: 100MB original file
# During deletion: 100MB original + 60MB temp file = 160MB
# After deletion: 60MB rewritten file
```

Ensure sufficient disk space for temporary files during operations.

## Limitations

### Not for frequent operations

Delete operations rewrite entire Parquet files, making them expensive. They are designed for **infrequent, manual operations** only.

**Use Cases**:
- Removing test data
- Deleting specific hosts/sensors
- One-time cleanup operations

**Not Suitable For**:
- Automated recurring deletions (use retention policies)
- High-frequency data cleanup
- Real-time data removal

### Explicit WHERE required

Full-table deletion requires explicit `WHERE 1=1`:

```python
# This will fail:
{"where": ""}  # Error: WHERE clause required

# Explicit full delete:
{"where": "1=1", "confirm": True}
```

### Maximum row limits

Large deletions are subject to `max_rows_per_delete` configuration:

```python
# Will fail if exceeds limit:
{"where": "time < '2020-01-01'"}  # May exceed max_rows

# Solution: Batch by time range
{"where": "time >= '2023-01-01' AND time < '2023-02-01'"}
```

### File-level locking

During deletion, affected files are locked. Concurrent writes may be delayed.

## Troubleshooting

### Delete not enabled

**Problem**: `DELETE_ENABLED=false` or not configured.

**Solution**:
```toml
[delete]
enabled = true
```

### Confirmation required

**Problem**: Operation exceeds confirmation threshold.

**Solution**: Add `confirm: true`:
```json
{"confirm": true}
```

### Exceeds maximum rows

**Problem**: Deletion would affect more rows than `max_rows_per_delete`.

**Solutions**:
1. Batch the operation by time range
2. Increase `max_rows_per_delete` (carefully)
3. Use retention policies for large-scale cleanup

### No rows deleted

**Problem**: `deleted_count: 0` but expected deletions.

**Solutions**:
- Verify WHERE clause syntax matches data
- Check that data exists in the specified database/measurement
- Use dry run to inspect affected files

### Slow execution

**Problem**: Delete operations take longer than expected.

**Solutions**:
- Check file sizes (large files take longer)
- Monitor disk I/O performance
- Batch operations during low-traffic periods
- Consider using retention policies for time-based cleanup

## Related topics

- [Retention Policies](/arc-enterprise/data-lifecycle/retention-policies/) - Automated time-based deletion
- [Continuous Queries](/arc-enterprise/data-lifecycle/continuous-queries/) - Downsample before deletion
- [Compaction](/arc-enterprise/advanced/compaction/) - File optimization for better performance
