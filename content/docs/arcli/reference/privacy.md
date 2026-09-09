---
title: "Privacy"
description: "What arcli sends and stores: requests to the Arc servers you configure, the one exception (arcli sample), a random installation id in the Arcli-Installation-Id header that Arc telemetry may report, and the two opt-outs."
---

With one exception, every request goes to the Arc server you configured, and the only thing arcli stores is `~/.arcli/config.toml`.

The exception is [`arcli sample`](/arcli/commands/sample/), which downloads published datasets from `samples.basekick.net`. See [Sample downloads](#sample-downloads) below.

## What a request carries

- A `User-Agent` with the arcli version and OS/architecture, for example `arcli/26.09.1 (darwin/arm64)`.
- Once a config file exists, a random installation id in the `Arcli-Installation-Id` header. It is a version 4 UUID minted the first time arcli writes its config file (the first `config create`), stored as `installation_id` in that file, and derived from nothing about your machine or account.

Arc records the ids of the installations it served, on requests it authenticated, and its own opt-out [telemetry](/arc/operations/telemetry/) may report them together with the instance id to Basekick once a day (and once at shutdown), so Basekick can count how many CLI installations talk to how many Arc servers. Because the id is the same for every server you use, it links the servers one installation talks to. Public probes such as `ping` are never counted. Nothing about the request (database, query, token) is recorded, and the id is never logged.

## Opting out

Either of these stops the header; the id stays in the file:

- `DO_NOT_TRACK=1` in the environment (`true`, `yes` and `on` also work), the [console convention](https://consoledonottrack.com).
- `send_installation_id = false` in the config file.

Disabling telemetry on the Arc server also stops it, on that server. `arcli config current` shows the id and whether it is being sent:

```text
installation_id:  49ae95aa-997f-41ba-89e7-cb0f848e1cec (sent to Arc servers: no (DO_NOT_TRACK is set))
```

Delete the key from the file and the next command that writes it (`config create|update|set-active|delete`) mints a new one. With no config file at all (an environment-only setup in a container or CI) there is no id and nothing is sent.

## Sample downloads

`arcli sample list`, `show` and `load` fetch dataset files from `samples.basekick.net`, a Basekick-controlled host. These are the only arcli commands that contact Basekick directly; everything else talks solely to the Arc servers you configure.

What those requests carry:

- The same `User-Agent` and `Arcli-Installation-Id` header as any other arcli request. Both opt-outs above apply here unchanged.
- Nothing else from arcli: not your token, not your Arc endpoint, not the database or measurement you are loading into, and nothing about your data.

What they necessarily reveal, as any download from any website does: your IP address, the file you asked for and when. Cloudflare serves the files and its platform logging records that on Basekick's behalf. The service keeps no application log of its own beyond that.

If you would rather not fetch from us at all, `arcli sample show <dataset> -o json` prints every file URL and its SHA-256. Download them however you like, then use [`arcli import parquet`](/arcli/commands/import/); the checksums let you verify what you got.

## What is never sent or stored

No query text, no database names, no results, no tokens, no hostnames, no usage counters. arcli has no update check, no crash reporting and no history file; shell completion reads the config file and never a server.
