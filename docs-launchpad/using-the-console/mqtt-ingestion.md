---
sidebar_position: 6
---

# MQTT ingestion

If you're pulling sensor and IoT data over MQTT, the **MQTT** tab manages the whole ingestion path from the browser, with no broker config files and no restarts. Each **subscription** tells Arc which broker to connect to, which topics to consume, and where to land the data.

![Launchpad MQTT subscription management with live stats](/img/launchpad/launchpad-mqtt.png)

## Add a subscription

Click **Add Subscription** and configure the broker connection:

### Broker connection

| Field | Description |
|---|---|
| **Name** | A label for the subscription. |
| **Broker URL** | e.g. `tcp://broker:1883`. Schemes: `tcp://`, `ssl://`, `ws://`, `wss://`, `mqtt://`, `mqtts://`. |
| **Client ID** | The MQTT client identifier. |
| **Username / Password** | Optional broker credentials. |
| **Target Database** | The Arc database that consumed messages land in. |
| **QoS** | Quality-of-service level (0, 1, or 2). |
| **Auto-start** | Bring the subscription up automatically with the instance. |

### Topics and routing

- **Topics**: one or more topics to subscribe to (wildcards like `sensors/#` are supported).
- **Per-topic database override**: route different topics into different databases so each stream lands where it belongs.

### Secure transport (TLS / mTLS)

Enable TLS for encrypted broker connections, including full **mTLS**: provide the **CA certificate**, **client cert**, and **client key** paths for brokers that require mutual authentication.

### Connection tuning

Keep-alive, connect timeout, and reconnect back-off (min/max) are all configurable, so you can match the subscription to your broker's behavior.

## Live stats and lifecycle

A running subscription card shows the broker, target database, topic count, and **live stats for the current session**: messages **Received**, **Failed**, **Bytes**, **Reconnects**, and the **Last message** time. These update in near-real-time.

From the card you can **Stop**, **Pause**, **Restart**, **Edit**, or **Delete** the subscription.

:::note Stop to edit
A subscription must be stopped to change its configuration: stop it, edit, then start it again.
:::

:::note Availability & permissions
The MQTT tab only appears when MQTT is enabled on that Arc instance, and MQTT management requires an admin-scoped connection.
:::
