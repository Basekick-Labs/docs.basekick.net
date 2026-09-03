---
title: "MQTT ingestion"
description: "Manage Arc's MQTT subscriptions from the browser: set the broker URL, topics, QoS, and target database, enable TLS or mTLS, and watch per-session message and reconnect stats."
---

If you're pulling sensor and IoT data over MQTT, the **MQTT** tab manages the whole ingestion path from the browser, with no broker config files and no restarts. Each **subscription** tells Arc which broker to connect to, which topics to consume, and where to land the data.

![Launchpad MQTT subscription management with live stats](/img/launchpad/launchpad-mqtt.png)

## Add a Subscription

Click **Add Subscription** and configure the broker connection:

### Broker Connection

| Field | Description |
|---|---|
| **Name** | A label for the subscription. |
| **Broker URL** | e.g. `tcp://broker:1883`. Accepted schemes: `tcp://`, `ssl://`, `ws://`, `wss://`, `mqtt://`, `mqtts://`. |
| **Client ID** | Optional MQTT client identifier. |
| **Username / Password** | Optional broker credentials. |
| **Target Database** | The Arc database that consumed messages land in. |
| **QoS** | Quality of service: 0 (at most once), 1 (at least once), or 2 (exactly once). |
| **Auto-start on Arc boot** | Bring the subscription up automatically with the instance. |

### Topics and Routing

- **Topics**: one topic per line. The MQTT wildcards `+` and `#` are allowed, so `sensors/#` works.
- **Topic → database mapping**: optional `topic = database` lines that route different topics into different databases, so each stream lands where it belongs.

### Secure Transport (TLS / mTLS)

Enable TLS for encrypted broker connections, including full **mTLS**. Give the **CA certificate path**, **client cert path**, and **client key path** as paths on the Arc host (e.g. `/etc/arc/ca.pem`), not uploads. A **Skip TLS verification** option exists for testing against self-signed brokers.

### Connection Tuning

Under **Advanced**, keep-alive, connect timeout, and reconnect back-off (min and max) are all configurable in seconds, so you can match the subscription to your broker's behavior.

## Live Stats and Lifecycle

A running subscription card shows the broker, target database, topic count, and **live stats for the current session**: messages **Received**, **Failed**, **Bytes**, **Reconnects**, and the **Last message** time.

A running subscription offers **Stop** and **Pause**; a stopped one offers **Start**. **Restart**, **Edit**, and **Delete** are always available.

<Callout type="info" title="Stop to edit">
A subscription must be stopped to change its configuration: stop it, edit, then start it again.
</Callout>

<Callout type="info" title="Availability & permissions">
The MQTT tab is always present, but it only manages subscriptions when MQTT is enabled on that Arc instance; otherwise it says so and points you at the `[mqtt]` section of `arc.toml`. Managing subscriptions also requires the owner or admin role in the active organization.
</Callout>
