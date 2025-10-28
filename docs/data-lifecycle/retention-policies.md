---
sidebar_position: 1
---

# Retention Policies

Retention policies allow you to automatically manage data lifecycle by defining how long data should be kept.

:::info Manual Execution Only
Automatic execution is reserved for Arc Enterprise. In Arc Core, retention policies must be manually triggered via the API.
:::

## Overview

Retention policies in Arc help you:
- Define data retention periods at database or measurement level
- Automatically clean up old data through manual execution
- Reduce storage costs by removing unnecessary historical data
- Maintain compliance with data retention requirements
- Test deletion operations safely with dry-run mode

## How It Works

Arc implements retention through physical file deletion:

1. **Scanning**: Examines Parquet files in measurement directories
2. **Metadata Analysis**: Reads file metadata to find maximum timestamps
3. **Identification**: Locates files where all rows are older than the cutoff date
4. **Deletion**: Physically removes entire files from disk

**Cutoff Calculation**: `cutoff_date = today - retention_days - buffer_days`

## API Endpoints

### Create Policy

Create a new retention policy:

```bash
POST /api/v1/retention
```

**Request Body**:
```json
{
  "name": "delete_old_metrics",
  "database": "telegraf",
  "measurement": "cpu",
  "retention_days": 90,
  "buffer_days": 7,
  "is_active": true
}
```

**Parameters**:
- `name` (string, required): Unique policy identifier
- `database` (string, required): Target database name
- `measurement` (string, optional): Target measurement (null for database-wide)
- `retention_days` (integer, required): Number of days to retain data
- `buffer_days` (integer, required): Safety margin in days
- `is_active` (boolean, required): Enable/disable the policy

### List Policies

Retrieve all retention policies:

```bash
GET /api/v1/retention
```

**Response**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "delete_old_metrics",
    "database": "telegraf",
    "measurement": "cpu",
    "retention_days": 90,
    "buffer_days": 7,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "last_executed_at": "2024-01-20T02:00:00Z",
    "last_deleted_count": 1500
  }
]
```

### Get Single Policy

Retrieve a specific retention policy:

```bash
GET /api/v1/retention/{policy_id}
```

### Update Policy

Update an existing retention policy:

```bash
PUT /api/v1/retention/{policy_id}
```

**Request Body**: Same as create policy

### Delete Policy

Remove a retention policy:

```bash
DELETE /api/v1/retention/{policy_id}
```

### Execute Policy

Manually trigger a retention policy:

```bash
POST /api/v1/retention/{policy_id}/execute
```

**Request Body**:
```json
{
  "dry_run": false,
  "confirm": true
}
```

**Dry Run Example**:
```json
{
  "dry_run": true,
  "confirm": false
}
```

**Response**:
```json
{
  "policy_id": "550e8400-e29b-41d4-a716-446655440000",
  "cutoff_date": "2023-10-22T00:00:00Z",
  "files_to_delete": [
    "/data/telegraf/cpu/2023-10-15.parquet",
    "/data/telegraf/cpu/2023-10-20.parquet"
  ],
  "total_files": 2,
  "dry_run": true
}
```

### View Execution History

View past executions of a retention policy:

```bash
GET /api/v1/retention/{policy_id}/executions?limit=50
```

**Response**:
```json
[
  {
    "execution_id": "abc123",
    "executed_at": "2024-01-20T02:00:00Z",
    "deleted_count": 1500,
    "execution_time_ms": 2500,
    "status": "success"
  }
]
```

## Configuration Parameters

### Retention Days

The number of days to keep data before it becomes eligible for deletion. Choose based on:
- Business requirements
- Compliance regulations
- Storage capacity
- Query patterns

**Example**: `retention_days: 90` keeps data for 90 days.

### Buffer Days

A safety margin added to the retention period to prevent accidental deletion of recent data.

**Recommended Values**:
- Development: 7 days
- Production: 14-30 days

**Example**: With `retention_days: 90` and `buffer_days: 7`, data older than 97 days will be deleted.

### Database vs Measurement Level

**Database-wide policy**:
```json
{
  "database": "telegraf",
  "measurement": null,
  "retention_days": 365
}
```

**Measurement-specific policy**:
```json
{
  "database": "telegraf",
  "measurement": "cpu",
  "retention_days": 90
}
```

Use measurement-specific policies for granular control over different data types.

## Usage Examples

### Example 1: Clean Old Metrics

```python
import requests

# Create a retention policy for old CPU metrics
response = requests.post(
    "http://localhost:8000/api/v1/retention",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    json={
        "name": "cpu_cleanup",
        "database": "telegraf",
        "measurement": "cpu",
        "retention_days": 90,
        "buffer_days": 7,
        "is_active": True
    }
)

policy_id = response.json()["id"]

# Test with dry run first
dry_run = requests.post(
    f"http://localhost:8000/api/v1/retention/{policy_id}/execute",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    json={"dry_run": True, "confirm": False}
)

print(f"Would delete {dry_run.json()['total_files']} files")

# Execute for real
if input("Proceed? (yes/no): ") == "yes":
    result = requests.post(
        f"http://localhost:8000/api/v1/retention/{policy_id}/execute",
        headers={"Authorization": "Bearer YOUR_TOKEN"},
        json={"dry_run": False, "confirm": True}
    )
    print(f"Deleted {result.json()['total_files']} files")
```

### Example 2: Database-wide Retention

```python
# Apply retention to all measurements in a database
response = requests.post(
    "http://localhost:8000/api/v1/retention",
    headers={"Authorization": "Bearer YOUR_TOKEN"},
    json={
        "name": "database_cleanup",
        "database": "telegraf",
        "measurement": None,  # Apply to all measurements
        "retention_days": 180,
        "buffer_days": 14,
        "is_active": True
    }
)
```

### Example 3: List and Monitor Policies

```python
# List all policies
policies = requests.get(
    "http://localhost:8000/api/v1/retention",
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

for policy in policies.json():
    print(f"Policy: {policy['name']}")
    print(f"  Last executed: {policy['last_executed_at']}")
    print(f"  Last deleted: {policy['last_deleted_count']} rows")

    # Get execution history
    history = requests.get(
        f"http://localhost:8000/api/v1/retention/{policy['id']}/executions?limit=10",
        headers={"Authorization": "Bearer YOUR_TOKEN"}
    )
    print(f"  Recent executions: {len(history.json())}")
```

## Best Practices

### 1. Always Test First

Use dry-run mode before executing retention policies:

```python
# Always start with dry run
result = requests.post(
    f"http://localhost:8000/api/v1/retention/{policy_id}/execute",
    json={"dry_run": True, "confirm": False}
)

# Review what will be deleted
print(f"Files to delete: {result.json()['files_to_delete']}")
```

### 2. Use Buffer Days

Implement a safety buffer to prevent accidental deletion:

```json
{
  "retention_days": 90,
  "buffer_days": 14  // 14-day safety margin
}
```

### 3. Start Conservative

Begin with longer retention periods and gradually shorten:

```json
// Start here
{"retention_days": 365, "buffer_days": 30}

// After monitoring, reduce if needed
{"retention_days": 180, "buffer_days": 14}
```

### 4. Test in Non-Production

Create and test policies in a development environment first:

```bash
# Development environment
export ARC_ENV=dev
# Test policies thoroughly before production
```

### 5. Monitor Execution History

Regularly check the `last_deleted_count` field:

```python
# Check if deletion counts are as expected
policy = requests.get(f"/api/v1/retention/{policy_id}").json()
if policy['last_deleted_count'] > 10000:
    print("Warning: Large deletion detected!")
```

### 6. Use Measurement-Specific Policies

Create granular policies for different data types:

```python
# High-frequency metrics - shorter retention
{"measurement": "cpu", "retention_days": 30}

# Business metrics - longer retention
{"measurement": "revenue", "retention_days": 730}
```

## Important Limitations

### Local Storage Only

Currently, retention policies only work with local filesystem storage. Cloud storage backends (S3, MinIO, GCS) are not yet implemented.

### File-Level Granularity

Retention operates at the file level, not row level. A file is only deleted if **all** rows are older than the cutoff date.

:::caution
For optimal retention policy effectiveness, ensure your data is properly compacted. Files with mixed timestamps may not be eligible for deletion.
:::

### No Rollback

Deleted data cannot be recovered. Always:
1. Use dry-run mode first
2. Maintain backups of critical data
3. Test in non-production environments

### Sequential Processing

Retention policies process measurements sequentially. Large databases may take time to process.

### Works Best with Compacted Files

Retention policies are most effective when files contain data from similar time periods. Enable [automatic compaction](/arc/advanced/compaction) for better results.

## Troubleshooting

### No Files Being Deleted

**Problem**: Dry run shows 0 files to delete.

**Solutions**:
- Check that data actually exists older than `retention_days + buffer_days`
- Verify the policy targets the correct database and measurement
- Ensure files are fully older than the cutoff (file-level granularity)

### Policy Not Executing

**Problem**: Manual execution returns an error.

**Solutions**:
- Verify the policy `is_active` is set to `true`
- Check that `confirm: true` is set for actual execution
- Ensure you have write permissions on the data directory

### Unexpected File Count

**Problem**: More/fewer files than expected are being deleted.

**Solutions**:
- Remember: Only files where **all rows** are older than cutoff are deleted
- Check file timestamps using `ls -l` on the measurement directory
- Review recent compaction activity that may have merged files

## Related Topics

- [Delete Operations](/arc/data-lifecycle/delete-operations) - Manual delete operations for specific data
- [Continuous Queries](/arc/data-lifecycle/continuous-queries) - Downsample data before deletion
- [Compaction](/arc/advanced/compaction) - Optimize file structure for better retention
