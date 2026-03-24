---
sidebar_position: 2
---

# Dashboard Guide

The Arc Cloud dashboard at [cloud.arc.basekick.net](https://cloud.arc.basekick.net) is your central hub for managing instances, running queries, and monitoring your data.

## Instances

The **Instances** page lists all your Arc Cloud instances with their current status:

- **Running** — Instance is active and accepting requests
- **Stopped** — Instance is paused (no compute charges)
- **Error** — Instance encountered an issue and needs attention

From this page you can **create**, **start**, **stop**, and **delete** instances.

## SQL Console

Run SQL queries directly from your browser. The SQL Console provides:

- A full-featured query editor
- Results displayed in a sortable table format
- Query history for quick re-runs

Use standard DuckDB SQL — window functions, CTEs, joins, and aggregations all work as expected.

## Log Explorer

Browse and search ingested log and event data stored in your databases. The Log Explorer provides:

- A structured view of ingested events with automatic field detection
- Filtering by severity level, time range, and custom field values
- Pattern detection to group similar log entries
- Field browser for exploring your data schema

The Log Explorer reads data from your database tables — it is not for viewing Arc system logs. For Arc instance logs (startup, errors, health), see the **Monitoring** tab on the instance detail page.

## Retention Policies

Configure automatic data retention per database. Retention policies delete data older than a specified duration, keeping storage costs under control.

Set retention at the database level to match your data lifecycle requirements — for example, 30 days for raw logs, 1 year for aggregated metrics.

## Continuous Queries

Schedule recurring SQL queries that run on a defined interval. Use continuous queries for:

- **Materialized views** — Pre-compute expensive aggregations
- **Downsampling** — Reduce high-resolution data to summary tables
- **Aggregations** — Roll up raw events into hourly or daily summaries

## Connection Details

View your instance endpoint URL and region. The admin token is shown once during provisioning. If you need a new token, restart the instance to regenerate it.

## Billing

Manage your subscription from the **Billing** page:

- View current plan and usage
- Upgrade or downgrade tiers
- View and download invoices
- Monitor storage usage and overage charges

## Storage

The **Storage** page lists all persistent volumes in your organization, including volumes from deleted instances that are still within the 7-day retention window. From this page you can:

- See which volumes are **Active** (attached to a running instance) or **Orphaned** (instance deleted)
- **Export data** as a `.tar.gz` archive (Owner and Admin roles only)
- Monitor the retention countdown for orphaned volumes

See [Storage & Data Export](/arc-cloud/data-lifecycle/storage) for details.

## Team

Invite team members and assign roles:

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, billing, delete organization |
| **Admin** | Manage instances, team members, and settings |
| **Member** | Create and manage own instances, run queries |
| **Viewer** | Read-only access to instances and query results |

## Settings

Configure organization-level settings and manage your profile. The Settings page includes:

- **Profile** — Display name and email
- **Organization** — Organization name and settings
- **Security** — Two-factor authentication (TOTP) and passkey management

See [Account Security](/arc-cloud/security-team/security) for setup instructions.
