---
sidebar_position: 3
---

# Connecting to Arc

Launchpad doesn't host databases; you point it at an Arc server you already run. Each server you register is called a **connection** (or instance) in the UI.

## Add a connection

From the sidebar, go to **Instances**, then **Connect an Arc server**.

![Connect an Arc server](/img/launchpad/launchpad-add-connection.png)

Fill in:

| Field | Description |
|---|---|
| **Name** | Optional label to identify this server (e.g. "Production", "Arc running in Docker"). |
| **Arc server URL** | Base URL of the Arc HTTP API, e.g. `https://arc.example.com:8000`. On a shared Docker network this is `http://arc:8000`. |
| **Admin / API token** | A bearer token with access to this Arc server. Stored securely and used to authenticate queries and admin actions. |

Click **Connect**. Launchpad verifies the endpoint and token, then the connection appears on your Instances page.

![Arc server connected](/img/launchpad/launchpad-arc-connected.png)

## Getting the Arc admin token

If Arc has auth enabled, you need an admin (or sufficiently scoped) token. On a fresh Arc instance, an admin token is generated on first run; grab it from the logs:

```bash
docker logs arc | grep -i "admin token"
```

If your Arc runs with auth disabled, any non-empty value is accepted but unused; admin actions still work against that instance.

:::tip Scope matters
The token you register determines what Launchpad can do on that instance. An **admin-scoped** token unlocks the operational surface (tokens, retention, alerts, continuous queries, MQTT). A read-only token can still run SQL and browse schemas, but management tabs that require admin access will say so.
:::

## Reaching Arc on a private network

By default Launchpad rejects Arc endpoints that resolve to a private, loopback, or link-local address (`localhost`, `127.0.0.1`, `10.x`, `192.168.x`, `*.internal`, cloud metadata, …). This is an SSRF safeguard.

If your Arc server legitimately runs on a private network reachable from the Launchpad host (the same box, the same Docker network, or the same Kubernetes cluster), set `LAUNCHPAD_ALLOW_PRIVATE_ENDPOINTS=true`. Even then, the proxy resolves-and-pins the target IP per request, so it stays safe against DNS rebinding. See [Configuration](/launchpad/administration/configuration#private-endpoints).

Some URL notes for containerized setups:

- **Same Docker network:** use the service name, e.g. `http://arc:8000`.
- **Arc on the host, Launchpad in a container:** `localhost` inside the container is the container itself. Reach a host-side Arc via `http://host.docker.internal:8000` or the host's LAN IP.

## Open the console

Once connected, click the instance to open its console. From there you can run SQL and manage the instance. See [Using the Console](/launchpad/using-the-console/sql-console).
