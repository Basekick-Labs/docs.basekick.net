---
sidebar_position: 1
---

# Telemetry

Liftbridge sends anonymous usage telemetry to help improve the project. This page explains what data is collected, how it's used, and how to opt out.

## Overview

Liftbridge collects minimal, anonymous usage statistics to help the development team understand:
- How Liftbridge is being deployed (operating systems, hardware configurations)
- Which Liftbridge versions are in active use
- Basic system characteristics for optimization and testing

:::info Privacy First
Liftbridge does not collect any personally identifiable information, message data, stream names, or performance metrics.
:::

## What Is Collected

Liftbridge sends the following anonymous data every 24 hours:

### Instance Information

- **instance_id**: A random UUID generated on first run
  - Stored in `{data.dir}/.instance_id`
  - Unique per Liftbridge installation
  - Not linked to any personal information

- **timestamp**: When the telemetry report was generated (UTC)

- **liftbridge_version**: The running version number (e.g., `1.10.0`)

### System Information

- **os**: Operating system details
  - Name (e.g., "linux", "darwin", "windows")
  - Version (Go runtime version)
  - Architecture (e.g., "amd64", "arm64")
  - Platform (e.g., "linux-go1.23.0-amd64")

- **cpu**: CPU characteristics
  - Physical cores
  - Logical cores (threads)
  - Frequency in MHz (when available)

- **memory**: System memory
  - Total RAM in gigabytes

### Example Payload

```json
{
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-20T10:30:00Z",
  "liftbridge_version": "1.10.0",
  "os": {
    "name": "linux",
    "version": "go1.23.0",
    "architecture": "amd64",
    "platform": "linux-go1.23.0-amd64"
  },
  "cpu": {
    "physical_cores": 8,
    "logical_cores": 16,
    "frequency_mhz": null
  },
  "memory": {
    "total_gb": 32.0
  }
}
```

## What Is NOT Collected

Liftbridge explicitly avoids collecting:

- **User Data**: No usernames, emails, or personal information
- **Message Contents**: No stream data or message payloads
- **Stream Information**: No stream names, subjects, or configurations
- **Network Information**: No IP addresses, hostnames, or NATS server addresses
- **Credentials**: No API keys, passwords, or TLS certificates
- **File Paths**: No directory structures or file names
- **Performance Metrics**: No throughput, latency, or resource usage
- **Cluster Information**: No server IDs, namespace names, or peer details

## How It Works

### Telemetry Schedule

1. **First Transmission**: Immediately after Liftbridge starts
2. **Subsequent Transmissions**: Every 24 hours
3. **Single Instance**: Each Liftbridge server sends its own telemetry

### Endpoint

Telemetry is sent to: `https://telemetry.basekick.net/api/v1/liftbridge/telemetry`

### Network Behavior

- If the telemetry endpoint is unreachable, Liftbridge logs a warning but continues operating normally
- Failed transmissions are retried during the next scheduled transmission
- No telemetry data is queued or persisted locally

### Startup Logging

Liftbridge logs telemetry status on startup:

**When Enabled**:
```
INFO: Telemetry collector started [instance_id=550e8400-e29b-41d4-a716-446655440000, interval=24h0m0s]
```

**When Disabled**:
```
INFO: Telemetry is disabled
```

## Disabling Telemetry

You can opt out of telemetry in two ways:

### Option 1: Configuration File

Edit your Liftbridge YAML configuration file and add:

```yaml
telemetry:
  enabled: false
```

**Full Example**:
```yaml
listen: 0.0.0.0:9292
data.dir: /var/lib/liftbridge

clustering:
  server.id: node-1
  namespace: production

telemetry:
  enabled: false
```

### Option 2: Environment Variable

Set the environment variable before starting Liftbridge:

```bash
export LIFTBRIDGE_TELEMETRY_ENABLED=false
```

**With Docker**:
```bash
docker run -e LIFTBRIDGE_TELEMETRY_ENABLED=false liftbridge/liftbridge:latest
```

**With Docker Compose**:
```yaml
services:
  liftbridge:
    image: liftbridge/liftbridge:latest
    environment:
      - LIFTBRIDGE_TELEMETRY_ENABLED=false
```

### Verification

After configuring, start Liftbridge and check the logs:

```
INFO: Telemetry is disabled
```

If you see this message, telemetry is successfully disabled.

## Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `telemetry.enabled` | boolean | `true` | Enable or disable telemetry |
| `telemetry.interval.seconds` | integer | `86400` | Reporting interval in seconds (default: 24 hours) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LIFTBRIDGE_TELEMETRY_ENABLED` | `true` | Enable or disable telemetry |
| `LIFTBRIDGE_TELEMETRY_INTERVAL_SECONDS` | `86400` | Reporting interval in seconds |

## Why Telemetry?

### Benefits to the Project

Anonymous telemetry helps the Liftbridge team:

1. **Prioritize Platform Support**: Understand which operating systems and architectures to focus on
2. **Test on Real Hardware**: Know what CPU and memory configurations are common
3. **Track Version Adoption**: See how quickly users upgrade to new releases
4. **Plan Deprecations**: Identify when old versions are no longer in use

### Privacy Considerations

Liftbridge's telemetry is designed with privacy as a priority:

- **Anonymous**: No linkage to individuals or organizations
- **Minimal**: Only essential system characteristics
- **Transparent**: Full disclosure of what is collected
- **Optional**: Easy opt-out with no functionality loss
- **No Tracking**: No cookies, fingerprinting, or cross-site tracking

## Frequently Asked Questions

### Does telemetry affect performance?

No. Telemetry runs asynchronously and has negligible performance impact:
- Transmission occurs once per 24 hours
- Payload is ~500 bytes
- Network timeout is 30 seconds
- Failed transmissions don't block Liftbridge operations

### Can I verify what's being sent?

Yes. You can inspect the telemetry payload by:

1. **Network Inspection**: Use tools like Wireshark or tcpdump to capture the request
2. **Source Code**: Review the telemetry implementation in the [Liftbridge repository](https://github.com/liftbridge-io/liftbridge/tree/master/server/telemetry)

### What happens to the data?

Telemetry data is:
- Stored securely on Basekick infrastructure
- Aggregated for statistical analysis
- Not shared with third parties
- Not used for commercial purposes
- Retained for a limited time (90 days)

### Will Liftbridge work if telemetry is blocked?

Yes. Liftbridge functions identically whether telemetry is enabled or disabled. If the telemetry endpoint is unreachable (firewall, network issues), Liftbridge logs a warning and continues normally.

### Why not make it opt-in?

We believe in transparency and easy opt-out rather than opt-in because:
- Telemetry helps improve the product for everyone
- Data collected is truly anonymous and minimal
- Opt-out is simple and clearly documented
- Many users don't discover opt-in options

However, we respect your choice and make opting out straightforward.

## Privacy Policy

For detailed information about how Basekick handles data, see our [Privacy Policy](https://basekick.net/privacy).

## Support

If you have questions or concerns about telemetry:
- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/liftbridge-io/liftbridge/issues)
- Email: privacy@basekick.net
