---
title: "First connection"
description: "Get the admin token from Arc, save it as an arcli profile with config create, confirm it with ping, run a first query and write, and use ARC_ENDPOINT and ARC_TOKEN in CI instead of a config file."
---

arcli needs two things per Arc server: its HTTP endpoint and a bearer token. Everything else is optional.

## Get a token from Arc

A fresh Arc prints its bootstrap admin token to stderr on first start, and Arc Launchpad and arcli can mint more later. If you run Arc with a fixed token (`ARC_AUTH_BOOTSTRAP_TOKEN` or `auth.bootstrap_token` in `arc.toml`), use that. Any token works for `query`; the admin commands need one with the `admin` permission.

<Callout type="idea" title="Keep the token off the command line">
`--token` shows up in shell history and in `ps`. Both `config create` and `config update` accept `--token-stdin`, which reads the token from the first line of a pipe:

```bash
pass show arc/prod | arcli config create --name prod --endpoint https://arc.prod.example.com --token-stdin
```

A terminal on stdin is refused, because the token would be echoed into the scrollback.
</Callout>

## Save a profile

```bash
arcli config create --name local --endpoint http://localhost:8000 --token YOUR-TOKEN --activate
```

```text
Created connection "local" at /home/you/.arcli/config.toml
Generated installation id 49ae95aa-997f-41ba-89e7-cb0f848e1cec; arcli sends it to the Arc servers you connect to (see README, Privacy). Disable with DO_NOT_TRACK=1 or send_installation_id = false.
Active connection is now "local"
```

The first profile you create becomes the active one automatically; later ones need `--activate` (or `arcli config set-active NAME`). The second line appears once, when the config file is first written; it is explained in [Privacy](/arcli/reference/privacy/).

Add `--default-database metrics` to save a default database for `query`, `write` and the commands that take `--database`, and `--insecure` to skip TLS verification for that one profile (lab servers with self-signed certificates only).

## Check the connection

```bash
arcli ping
```

```text
endpoint:   http://localhost:8000 (connection local)
health:     ok (uptime 925.342375ms, latency 4.9ms) storage: hot=ok
auth:       ok as "admin" (id 1, read,write,delete,admin)
```

`ping` calls `/health` without a token first, then verifies the token. It exits 0 only when both pass (or when the server runs without authentication); `-o json` prints the same report as a document, even on failure, so a script can tell "server down" from "token rejected".

## First query and write

```bash
arcli db create metrics
printf 'cpu,host=web-1,region=us-east usage=0.63 1757203200000000000\n' | arcli write --database metrics
arcli query --database metrics "SELECT host, region, usage FROM cpu"
```

```text
┌───────┬─────────┬───────┐
│ HOST  │ REGION  │ USAGE │
├───────┼─────────┼───────┤
│ web-1 │ us-east │ 0.63  │
└───────┴─────────┴───────┘
```

Arc buffers writes before they become queryable; if a query right after a write comes back empty, run it again a few seconds later. See [arcli query](/arcli/commands/query/) and [arcli write](/arcli/commands/write/) for output formats, stdin and file input, and the MessagePack and JSON write formats.

## More than one server

Profiles are named, and the active one is only the default:

```bash
arcli config create --name prod --endpoint https://arc.prod.example.com --token-stdin < prod.token
arcli config list
arcli query -c prod "SELECT count(*) FROM cpu"      # one command against prod
arcli config set-active prod                         # switch the default
arcli config current                                 # who am I talking to?
```

```text
$ arcli config list
┌────────┬───────┬──────────────────────────────┬─────────────┬────────────┐
│ ACTIVE │ NAME  │           ENDPOINT           │    TOKEN    │ DEFAULT DB │
├────────┼───────┼──────────────────────────────┼─────────────┼────────────┤
│ *      │ local │ http://localhost:8000        │ devt...0000 │ metrics    │
│        │ prod  │ https://arc.prod.example.com │ 3f8a...c91e │ -          │
└────────┴───────┴──────────────────────────────┴─────────────┴────────────┘
```

Tokens are shown as their first and last four characters everywhere arcli prints them; the only commands that print a full token are `auth token create` and `auth token rotate`, because delivering the new secret is their purpose.

## Containers and CI: no config file

An endpoint and a token in the environment work without any file:

```bash
export ARC_ENDPOINT=https://arc.prod.example.com
export ARC_TOKEN=$(cat /run/secrets/arc-token)
arcli query "SELECT count(*) FROM cpu"
```

`ARC_CONNECTION=prod` selects a profile from the config file instead. Both must be set together: `ARC_ENDPOINT` without `ARC_TOKEN` (or `--endpoint` without `--token`) is an error rather than a silent fall-through to the active profile. The full precedence is in [Connections and the config file](/arcli/reference/connections/).

## Next

- [arcli query](/arcli/commands/query/) and [arcli write](/arcli/commands/write/)
- [arcli auth](/arcli/commands/auth/) to mint a read-only token for dashboards instead of using the admin one everywhere
- [Output formats and exit codes](/arcli/reference/output/) before wiring arcli into scripts
