---
sidebar_position: 3
---

# Retention policies

Retention policies delete aged data automatically, so storage doesn't grow without bound. Launchpad drives Arc's admin API to create and run them from the **Retention** tab, with no config files and no curl.

![Launchpad retention policies with dry-run results](/img/launchpad/launchpad-retention.png)

## Create a policy

Click **Create Policy** and configure:

| Field | Description |
|---|---|
| **Database** | Which database the policy applies to. |
| **Measurement** | A specific measurement (table), or **All tables** in the database. |
| **Retention Period (days)** | How long to keep data. Anything older than the cutoff becomes eligible for deletion. |
| **Buffer Period (days)** | An optional grace window beyond the retention period before data is actually removed. |
| **Enabled** | Whether the policy runs on its own, or is created paused. |

## Dry-run before you delete

Before anything is removed, run a **dry-run**. It reports exactly which files and how many records the policy *would* delete, so you're never guessing about the blast radius. Review the results, then execute for real when you're confident.

## Run and manage

Each policy card shows its target (database + measurement), retention period, buffer period, last execution time, and last-deleted count. From the card you can:

- **Edit**: change the periods or scope
- **Pause** / resume: toggle whether it runs automatically
- **Execute Now**: run it on demand
- **Delete**: remove the policy

Expand **Execution History** to see past runs.

:::tip Requires admin
Retention management drives Arc's admin API, so the connection must use an admin-scoped token. See [Connecting to Arc](/launchpad/getting-started/connecting-to-arc#getting-the-arc-admin-token).
:::
