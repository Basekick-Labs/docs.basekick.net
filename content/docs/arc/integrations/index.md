---
title: "Integrations"
description: "Connect Arc to Grafana, Superset, Telegraf, MQTT brokers, OpenTelemetry, Redpanda Connect, VS Code, and Iceberg readers, plus InfluxDB client compatibility."
---

Arc speaks Line Protocol and standard SQL, so most tooling connects without a translation layer. These pages cover the integrations with a native plugin or dialect.

- **[Apache Iceberg](/arc/integrations/apache-iceberg/)** — Publish measurements as Iceberg tables for Spark, Trino, and PyIceberg.
- **[Apache Superset](/arc/integrations/superset/)** — Chart Arc data through the arc-superset-dialect SQLAlchemy driver.
- **[Grafana](/arc/integrations/grafana/)** — Build panels with the Arc data source plugin.
- **[Telegraf](/arc/integrations/telegraf/)** — Ship system metrics with the native Arc output plugin.
- **[InfluxDB clients](/arc/integrations/influxdb-clients/)** — Point existing InfluxDB client libraries at Arc unchanged.
- **[MQTT](/arc/integrations/mqtt/)** — Subscribe Arc directly to broker topics.
- **[VS Code](/arc/integrations/vscode/)** — Query and manage Arc from the Arc Database Manager extension.
- **[OpenTelemetry](/arc/integrations/opentelemetry/)** — Export traces, metrics, and logs from the Collector.
- **[TLE](/arc/integrations/tle/)** — Ingest Two-Line Element satellite orbital data.
- **[Redpanda Connect](/arc/integrations/redpanda-connect/)** — Stream from any Redpanda Connect source.
