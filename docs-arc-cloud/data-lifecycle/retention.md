---
sidebar_position: 1
---

# Retention Policies

Retention policies automatically delete old data based on age, keeping your storage usage under control without manual intervention.

## How Retention Works

A retention policy defines how long records in a given database are kept before they are automatically removed. Arc Cloud uses the **timestamp column** of each record to determine its age. When a record's timestamp is older than the configured retention period, it becomes eligible for deletion.

Retention policies are configured **per database** from the Arc Cloud dashboard.

## Configuration

To set a retention policy:

1. Open your instance in the Arc Cloud dashboard.
2. Navigate to the **Databases** tab.
3. Select the database you want to configure.
4. Under **Retention Policy**, set the desired duration (e.g., 7 days, 30 days, 90 days).
5. Click **Save**.

## Example: Tiered Retention

A common pattern is to keep raw data for a short period and aggregated data for much longer:

| Database | Data | Retention |
|----------|------|-----------|
| `raw_logs` | Raw request logs | 7 days |
| `metrics_1m` | 1-minute aggregated metrics | 30 days |
| `metrics_1h` | Hourly aggregated metrics | 90 days |
| `metrics_1d` | Daily aggregated metrics | 1 year |

Use [continuous queries](./continuous-queries.md) to automatically roll up raw data into aggregated databases before the raw data expires.

## Execution Schedule

- Retention runs **periodically every hour**.
- Freed storage is reflected in your usage dashboard **within 24 hours**.
- Deletion is permanent — there is no way to recover data removed by a retention policy.

## Notes

- If no retention policy is set, data is kept indefinitely (subject to your storage quota).
- Retention policies apply to all tables within the configured database.
- Changing a retention policy takes effect on the next hourly run.
