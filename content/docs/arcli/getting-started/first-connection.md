---
title: "First connection"
description: "Connect arcli to Arc, verify the connection, and run your first query."
---

arcli needs an Arc endpoint and, when authentication is enabled, an API token.

## Create a profile

A new Arc server prints its bootstrap admin token on first start. Save the endpoint and token as a named connection:

```bash
arcli config create --name local --endpoint http://localhost:8000 --token YOUR-TOKEN
```

The first profile becomes active automatically. If Arc runs with `auth.enabled = false`, omit `--token`.

To keep a token out of shell history, pipe it to `--token-stdin`:

```bash
pass show arc/prod | arcli config create --name prod --endpoint https://arc.prod.example.com --token-stdin
```

## Check the connection

```bash
arcli ping
```

`ping` checks the server health and verifies the active token. It exits non-zero when either check fails.

## Load and query real data

```bash
arcli sample load citibike
arcli query --database nyc "SELECT start_station_name AS station, count(*) AS trips FROM citibike_trips GROUP BY 1 ORDER BY trips DESC LIMIT 5"
```

The sample command creates the database when needed, verifies and imports the dataset, and prints more queries to try.

## Write your own data

```bash
arcli db create metrics
echo "cpu,host=web-1,region=us-east usage=0.63" | arcli write --database metrics
arcli query --database metrics "SELECT host, region, usage FROM cpu"
```

Arc buffers writes briefly. If an immediate query returns no rows, try again after a few seconds.

## Switch between servers

```bash
arcli config list
arcli query -c prod "SELECT count(*) FROM cpu"
arcli config set-active prod
arcli config current
```

## Containers and CI

Use environment variables when you do not need a saved profile:

```bash
export ARC_ENDPOINT=https://arc.prod.example.com
export ARC_TOKEN=$(cat /run/secrets/arc-token)
arcli query "SELECT count(*) FROM cpu"
```

See [Connections and configuration](/arcli/reference/connections/) for profile precedence, TLS, and timeouts.

## Next

- [Query data](/arcli/commands/query/)
- [Write data](/arcli/commands/write/)
- [Import files](/arcli/commands/import/)
- [Output formats and exit codes](/arcli/reference/output/)
