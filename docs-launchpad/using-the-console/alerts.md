---
sidebar_position: 5
---

# Alerts

Alerts watch your data and notify a webhook when a condition is met. Create and manage them from the **Alerts** tab.

![Launchpad alerts](/img/launchpad/launchpad-alerts.png)

## Create an alert

Configure:

| Field | Description |
|---|---|
| **Alert Name** | A label for the alert. |
| **Condition** | A threshold on the last or aggregated value of your data; the alert fires when it's crossed. |
| **Check Interval** | How often the condition is evaluated. The minimum is 1 minute. |
| **Webhook URL** | The endpoint to notify when the alert fires (e.g. Slack, Discord, or a custom receiver). |
| **Message** | The payload/message sent with the notification. |
| **Enable alert immediately** | Whether it starts active or paused. |

## Monitor and manage

Each alert card shows its condition, check interval, last value, and **Recent Triggers** so you can see when it last fired. From the same screen you can **enable**, **disable**, **edit**, or **delete** any alert.

:::tip Requires admin
Alert management drives Arc's admin API and requires an admin-scoped connection.
:::

:::note Notification delivery
Launchpad hands the webhook to Arc, which delivers the notification. Make sure the webhook URL is reachable from your Arc server.
:::
