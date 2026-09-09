---
title: "Privacy"
description: "The data arcli stores and sends, including client identification and sample downloads."
---

arcli stores connection profiles in `~/.arcli/config.toml` and sends commands to the Arc endpoints you configure.

## Client identification

Requests include:

- The arcli version and OS/architecture in the `User-Agent`.
- A random installation ID stored in the config file, unless disabled.

Arc may include the installation ID in its [usage telemetry](/arc/operations/telemetry/) to count arcli installations. The ID is not derived from your machine or account.

Disable it with either:

```bash
DO_NOT_TRACK=1 arcli <command>
```

or set this in `~/.arcli/config.toml`:

```toml
send_installation_id = false
```

## Sample downloads

The [`arcli sample`](/arcli/commands/sample/) commands fetch public datasets from `samples.basekick.net`. These requests include the same client identification described above, but do not include your Arc token, endpoint, queries, or database contents.

## Data arcli does not collect

arcli has no update check, crash reporting, or command-history file. It does not send query text, results, tokens, database names, or hostnames to Basekick.
