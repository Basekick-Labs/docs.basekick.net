---
sidebar_position: 1
---

# Instance Configuration

An Arc Cloud instance is a fully managed Arc deployment running on dedicated compute resources. Each instance gets its own isolated environment with guaranteed CPU, memory, and storage.

## Instance Lifecycle

Every instance moves through a defined set of states:

| State | Description |
|-------|-------------|
| **Creating** | The instance record has been created and is awaiting provisioning. |
| **Provisioning** | Infrastructure is being allocated — compute, storage, networking, and DNS. |
| **Running** | The instance is live and accepting connections. |
| **Stopped** | Compute is shut down. Data is preserved and storage billing continues. |
| **Error** | Something went wrong during provisioning or runtime. Check the dashboard for details. |
| **Deleted** | Compute removed. Data is retained for 7 days, then permanently purged. |

When an instance is deleted, its persistent volume is kept for 7 days. During this window you can download your data from the [Storage](/arc-cloud/configuration/storage) page. After 7 days the volume is permanently purged.

## Starting and Stopping Instances

You can stop a running instance at any time from the dashboard. Stopping an instance:

- **Pauses compute billing** — you are not charged for vCPU or memory while stopped.
- **Keeps your data** — all databases, tables, and stored records are preserved on disk.
- **Continues storage billing** — you are still billed for the storage your data occupies.

To resume, click **Start** in the dashboard. The instance typically returns to a running state within 30 seconds.

## Upgrading Tiers

You can upgrade your instance tier at any time without downtime. When you upgrade:

- The change takes effect immediately.
- You are charged a prorated amount for the difference between your current tier and the new tier for the remainder of your billing cycle.
- Downgrades take effect at the start of your next billing period.

## Instance Regions

Arc Cloud instances are currently deployed in a single region:

- **us-east-1** — US East (Virginia)

Additional regions are on the roadmap. If you have specific region requirements, [contact us](mailto:sales@basekick.net).

## Resource Allocation per Tier

Each tier provides a fixed allocation of compute, memory, storage, and ingest capacity.

| Tier | vCPU | Memory | Storage | DuckDB Memory | Threads | Ingest Rate | Price |
|------|------|--------|---------|---------------|---------|-------------|-------|
| Free | 0.5 | 512MB | 5GB | 256MB | 1 | 30K rec/s | $0 |
| Starter | 1 | 2GB | 50GB | 1GB | 2 | 85K rec/s | $50/mo |
| Growth | 2 | 4GB | 100GB | 2GB | 4 | 170K rec/s | $125/mo |
| Professional | 4 | 8GB | 200GB | 4GB | 8 | 250K rec/s | $225/mo |
| Business | 8 | 16GB | 500GB | 8GB | 16 | 500K rec/s | $550/mo |
| Premium | 16 | 32GB | 1TB | 16GB | 32 | 1M rec/s | $1,200/mo |
| Ultimate | 32 | 64GB | 2TB | 32GB | 64 | 2M rec/s | $2,400/mo |
| Dedicated | 36 | 256GB | 1.92TB | 128GB | 72 | Unlimited | From $4,000/mo |
| Enterprise | Custom | Custom | Custom | Custom | Custom | Custom | Contact sales |

Annual billing saves **15%** on all paid tiers.
