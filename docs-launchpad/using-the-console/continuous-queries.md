---
sidebar_position: 4
---

# Continuous queries

Continuous queries roll up and downsample data on a schedule: read from a source, aggregate over a window, and materialize the result into a destination measurement. They're how you keep long-term storage cheap while preserving the summaries you actually query.

![Launchpad continuous queries](/img/launchpad/launchpad-cq.png)

## Create a continuous query

From the **Continuous Queries** tab, create one and configure:

| Field | Description |
|---|---|
| **Database** | The database the query runs in. |
| **Source** | The source measurement to read from. |
| **Destination Measurement** | Where the aggregated result is written. |
| **Aggregation window / duration** | The time bucket to roll up over (e.g. 1 minute, 1 hour). |
| **Auto-delete source data** | Optionally drop the raw source data after N days once it has been aggregated. |
| **Auto-delete aggregated data** | Optionally drop the rolled-up data after N days too, to cap storage. |
| **Enabled** | Whether it runs on a schedule, or is created paused. |

## Run and manage

Like retention policies, each continuous query can be **Edited**, **Executed** on demand, paused/enabled, or **Deleted**. Run one manually to backfill or test it, then enable it to run continuously.

:::note Availability
Continuous queries depend on Arc's support for them on that instance. If the tab shows "Continuous Queries Not Available", the connected Arc version or configuration doesn't expose the feature.
:::

:::tip Requires admin
Managing continuous queries requires an admin-scoped connection.
:::
