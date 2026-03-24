---
sidebar_position: 5
---

# Storage & Data Export

The **Storage** page gives you visibility into the persistent volumes backing your instances, including volumes from recently deleted instances.

## Storage Page

Navigate to **Storage** in the sidebar to see all volumes in your organization. Each volume shows:

| Column | Description |
|--------|-------------|
| **Status** | **Active** (instance running) or **Orphaned** (instance deleted, data retained) |
| **Instance** | The instance resource ID, name, and tier |
| **Capacity** | The allocated disk size for this volume |
| **PVC Status** | The Kubernetes volume status (typically Bound) |
| **Created** | When the volume was first provisioned |

## Data Retention After Deletion

When you delete an instance, compute resources are removed immediately but **your data is retained for 7 days**. During this window the volume appears as **Orphaned** on the Storage page with a countdown showing how many days remain before automatic purge.

:::info Export before it's gone
After the 7-day retention window, the volume and all its data are permanently deleted. Use the Export Data feature to download your data before the deadline.
:::

## Exporting Data

Click the **Export Data** button on any volume to download its contents as a `.tar.gz` archive. The archive contains the full data directory — Parquet files and the Arc SQLite metadata database.

Exports are processed one at a time. If another export is already running, your request is queued and a notification lets you know your download will start shortly. If the queue is full, you will be prompted to try again later.

:::tip Use exported data with Arc OSS
The exported archive is fully compatible with [Arc](https://github.com/basekick-labs/arc) open-source. Extract it and point `ARC_STORAGE_LOCAL_PATH` at the `data/arc` directory to resume querying locally.
:::

### Permissions

Only users with the **Owner** or **Admin** role can export data. Members and viewers see the storage page but do not have access to the export action.
