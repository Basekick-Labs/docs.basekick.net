---
title: "API tokens"
description: "Manage the Arc API tokens your pipelines and applications authenticate with: scope each one to read, write, delete, or admin, copy it once, then revoke or delete it later."
---

The **Tokens** tab manages the API tokens your ingestion pipelines and applications use to authenticate against Arc. This is the full credential lifecycle (create, scope, disable, and revoke) from the browser.

## Create a token

Click **Create Token** and provide:

| Field | Description |
|---|---|
| **Name** | Required. Identifies the token in the list. |
| **Description** | Optional note on what the token is for (e.g. "Telegraf ingest", "Grafana read"). |
| **Permissions** | Independent checkboxes, so you grant exactly what the consumer needs. |
| **Expiration** | How long the token stays valid, or never expires. |

The four permissions are:

| Permission | Grants |
|---|---|
| **Read** | Query data from databases. |
| **Write** | Insert and write data to databases. |
| **Delete** | Delete data from databases. |
| **Admin** | Manage tokens, settings, and admin features. |

New tokens default to **Read** and **Write**.

When the token is created it's shown **once**: copy it immediately and store it securely. The plaintext can't be retrieved later, so a lost token has to be replaced rather than recovered.

## Manage tokens

The token list shows each token's name, description, and permissions. From there you can:

- **Revoke**: disable a token without deleting it, keeping the record so you can re-enable it later.
- **Enable**: reactivate a revoked token.
- **Delete**: permanently remove it.

Rotating a credential is: create the new token, roll it out to the consumer, then delete the old one.

<Callout type="warn" title="Admin permission required">
Creating and managing tokens requires an **admin-scoped** connection. If your connection uses a read-only token, the tab will show "Admin Permission Required"; register an admin token for that instance to manage credentials. See [Connecting to Arc](/launchpad/getting-started/connecting-to-arc/#getting-the-arc-admin-token).
</Callout>

<Callout type="idea" title="Least privilege">
Give each consumer its own token, with only the permissions it needs (an ingest pipeline rarely needs **Delete** or **Admin**) and a clear description. That way you can disable or rotate one consumer without touching the others.
</Callout>
