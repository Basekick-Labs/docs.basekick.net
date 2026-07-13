---
sidebar_position: 2
---

# Logs & monitoring

Two console tabs cover observability, but they observe different things. **Log Viewer** is for the logs you *store in Arc*. **Monitoring** is Arc's own self-observability.

## Log viewer

The **Log Viewer** tab reads the log data you've ingested into Arc: application logs, structured events, anything you write to a log measurement. Point it at your log tables and slice through them without writing the SQL by hand.

![Launchpad log viewer](/img/launchpad/launchpad-logs.png)

It adds tooling on top of the raw rows:

- **Pattern detection**: surfaces recurring shapes across your log lines so you can spot what's noisy.
- **Trace extraction**: pull the entries that belong to a trace together, for following a request across services.

This is the right tab when you need to see what *your application* is doing, as recorded in Arc.

## Monitoring

The **Monitoring** tab is Arc's own self-observability: how the *instance itself* is doing, right alongside your data.

![Launchpad monitoring - Arc self-observability](/img/launchpad/launchpad-monitoring.jpg)

It shows the instance's operational signals: ingestion throughput, query activity, and internal metrics. Use it to answer "is Arc healthy and keeping up?" rather than "what's in my data?".

:::note Which tab do I want?
- **Log Viewer** → the logs your systems write *into* Arc.
- **Monitoring** → how the Arc server is performing.
:::
