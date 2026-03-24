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
| **Starter** | 1 | 2 GB | 50 GB | 85K rec/s | $50/mo |
| **Growth** | 2 | 4 GB | 100 GB | 170K rec/s | $125/mo |
| **Professional** | 4 | 8 GB | 200 GB | 250K rec/s | $225/mo |
| **Business** | 8 | 16 GB | 500 GB | 500K rec/s | $550/mo |
| **Premium** | 16 | 32 GB | 1 TB | 1M rec/s | $1,200/mo |
| **Ultimate** | 32 | 64 GB | 2 TB | 2M rec/s | $2,400/mo |

Annual billing saves 15%. Need more? **Dedicated** (from $4,000/mo) and **Enterprise** plans are available with custom compute, storage, SLAs, and support. Contact support@basekick.net.

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

## Integrations

- **Telegraf**: Use the standard Telegraf output plugin to ship metrics directly to Arc Cloud
- **InfluxDB Client Libraries**: Arc Cloud accepts InfluxDB line protocol, so existing InfluxDB client libraries work out of the box
- **OpenTelemetry**: Send traces, metrics, and logs via the OpenTelemetry collector
- **MQTT**: Ingest IoT data from MQTT brokers

## Bulk Import

Arc Cloud supports bulk data import from CSV, Parquet, and InfluxDB. Use these to migrate existing datasets or backfill historical data. See the [Bulk Import guide](/arc-cloud/guides/bulk-import) for details.

## Next Steps

- [Quickstart](/arc-cloud/getting-started/quickstart) — Create your first instance in under a minute
- [Dashboard Guide](/arc-cloud/getting-started/dashboard) — Navigate the Arc Cloud dashboard
- [Connection Details](/arc-cloud/getting-started/connection) — Connect to your instance
- [Arc API Reference](/arc/api-reference) — Full HTTP API documentation

## Support

- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
- Email: support@basekick.net
