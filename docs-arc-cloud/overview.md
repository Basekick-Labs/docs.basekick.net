---
sidebar_position: 1
slug: /
---

# Welcome to Arc Cloud

**Fully managed analytical database — no servers, no ops**

Arc Cloud is a managed analytical database built on [Arc](/arc), the open-source analytical database by Basekick Labs. Powered by DuckDB, Parquet, and Apache Arrow, it delivers high-performance analytics without the operational overhead.

## Key Features

- **Fully Managed**: No servers to provision, no infrastructure to maintain
- **DuckDB Engine**: Full SQL support with sub-second analytical queries
- **Columnar Storage**: Data stored as Parquet files for maximum compression and query speed
- **Apache Arrow**: Fast in-memory processing with zero-copy reads
- **HTTP API**: Standard REST API for queries, ingestion, and management
- **Dashboard**: SQL console, log explorer, retention policies, and continuous queries at [cloud.arc.basekick.net](https://cloud.arc.basekick.net)
- **Instance Isolation**: Each customer gets dedicated compute, storage, and network isolation via Kubernetes
- **Automatic TLS**: HTTPS endpoints provisioned automatically for every instance

## Use Cases

- **Product Analytics**: User events, funnels, session analysis at scale
- **Observability & Logging**: Centralized logs, metrics, and traces
- **AI Agent Memory**: Persistent structured memory for LLM agents and workflows
- **IoT Time-Series**: Sensor telemetry, industrial monitoring, fleet tracking

## Pricing Tiers

| Tier | vCPU | RAM | Storage | Ingest Rate | Price |
|------|------|-----|---------|-------------|-------|
| **Free** | 0.5 | 512 MB | 5 GB | 30K rec/s | $0/mo |
| **Starter** | 1 | 1 GB | 20 GB | 100K rec/s | $29/mo |
| **Pro** | 2 | 4 GB | 100 GB | 500K rec/s | $149/mo |
| **Business** | 4 | 8 GB | 500 GB | 2M rec/s | $599/mo |
| **Scale** | 8 | 16 GB | 2 TB | 5M rec/s | $1,200/mo |
| **Ultimate** | 16 | 32 GB | 5 TB | 10M rec/s | $2,400/mo |

Need more? **Dedicated** and **Enterprise** plans are available with custom compute, storage, SLAs, and support. Contact enterprise@basekick.net.

## Arc OSS vs Arc Cloud

| Feature | Arc OSS | Arc Cloud |
|---------|---------|-----------|
| DuckDB query engine | Yes | Yes |
| Parquet columnar storage | Yes | Yes |
| HTTP API | Yes | Yes |
| Retention policies | Yes | Yes |
| Continuous queries | Yes | Yes |
| Python SDK | Yes | Yes |
| **Managed infrastructure** | No | Yes |
| **Automatic provisioning** | No | Yes |
| **Dashboard UI** | No | Yes |
| **Billing & usage tracking** | No | Yes |
| **Team management** | No | Yes |
| **DNS & routing** | No | Yes |
| **Automatic TLS** | No | Yes |
| **Storage overage billing** | No | Yes |

## Next Steps

- [Quickstart](/arc-cloud/getting-started/quickstart) — Create your first instance in under a minute
- [Dashboard Guide](/arc-cloud/getting-started/dashboard) — Navigate the Arc Cloud dashboard
- [Connection Details](/arc-cloud/getting-started/connection) — Connect to your instance
- [Arc API Reference](/arc/api-reference) — Full HTTP API documentation

## Support

- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
- Enterprise: enterprise@basekick.net
