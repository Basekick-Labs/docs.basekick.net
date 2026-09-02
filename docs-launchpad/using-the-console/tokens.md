---
sidebar_position: 7
---

# API tokens

The **Tokens** tab manages the API tokens your ingestion pipelines and applications use to authenticate against Arc. This is the full credential lifecycle (create, scope, disable, and revoke) from the browser.

## Create a token

Click **Create New Token** and provide:

| Field | Description |
|---|---|
| **Description** | What the token is for (e.g. "Telegraf ingest", "Grafana read"). |
| **Permission** | **Read** or **Read/Write**: scope the token to what the consumer actually needs. |

When the token is created it's shown **once**: copy it immediately and store it securely. Launchpad (and Arc) keep only a hash; the plaintext can't be retrieved later.

## Manage tokens

The token list shows each token's description and permission. From there you can:

- **Disable without deleting**: temporarily revoke a token while keeping the record, so you can re-enable it later.
- **Enable**: reactivate a disabled token.
- **Delete**: permanently remove it.

Rotating a credential is: create the new token, roll it out to the consumer, then delete the old one.

:::caution Admin permission required
Creating and managing tokens requires an **admin-scoped** connection. If your connection uses a read-only token, the tab will show "Admin Permission Required"; register an admin token for that instance to manage credentials. See [Connecting to Arc](/launchpad/getting-started/connecting-to-arc#getting-the-arc-admin-token).
:::

:::tip Least privilege
Give each consumer its own token, scoped to the minimum permission it needs, with a clear description. That way you can disable or rotate one consumer without touching the others.
:::
