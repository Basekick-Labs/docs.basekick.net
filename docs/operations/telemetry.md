---
sidebar_position: 1
---

# Telemetry

Arc sends anonymous usage telemetry to help improve the project. This page explains what data is collected, how it's used, and how to opt out.

## Overview

Arc collects minimal, anonymous usage statistics to help the development team understand:
- How Arc is being deployed (operating systems, hardware configurations)
- Which Arc versions are in active use
- Basic system characteristics for optimization and testing

:::info Privacy First
Arc does not collect any personally identifiable information, user data, database contents, queries, or performance metrics.
:::

## What Is Collected

Arc sends the following anonymous data every 24 hours:

### Instance Information

- **instance_id**: A random UUID generated on first run
  - Stored in `./data/.instance_id`
  - Unique per Arc installation
  - Not linked to any personal information

- **timestamp**: When the telemetry report was generated (UTC)

- **arc_version**: The running version number (e.g., `0.1.0`)

### System Information

- **os**: Operating system details
  - Name (e.g., "Linux", "macOS", "Windows")
  - Version (e.g., "Ubuntu 22.04", "macOS 14.0")
  - Architecture (e.g., "x86_64", "arm64")
  - Platform (e.g., "linux", "darwin")

- **cpu**: CPU characteristics
  - Physical cores
  - Logical cores (threads)
  - Frequency in MHz

- **memory**: System memory
  - Total RAM in gigabytes

### Example Payload

```json
{
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-20T10:30:00Z",
  "arc_version": "0.1.0",
  "os": {
    "name": "Linux",
    "version": "Ubuntu 22.04",
    "architecture": "x86_64",
    "platform": "linux"
  },
  "cpu": {
    "physical_cores": 8,
    "logical_cores": 16,
    "frequency_mhz": 3400
  },
  "memory": {
    "total_gb": 32
  }
}
```

## What Is NOT Collected

Arc explicitly avoids collecting:

- **User Data**: No usernames, emails, or personal information
- **Database Contents**: No table names, schemas, or data
- **Query Information**: No SQL queries or query patterns
- **Network Information**: No IP addresses or hostnames
- **Credentials**: No API keys, passwords, or tokens
- **File Paths**: No directory structures or file names
- **Performance Metrics**: No query times, throughput, or resource usage
- **Custom Configuration**: No application-specific settings

## How It Works

### Telemetry Schedule

1. **First Transmission**: 1 minute after Arc starts
2. **Subsequent Transmissions**: Every 24 hours
3. **Primary Worker Only**: Only the primary worker process sends telemetry (multi-worker deployments send one report)

### Endpoint

Telemetry is sent to: `telemetry.basekick.net`

### Network Behavior

- If the telemetry endpoint is unreachable, Arc logs a warning but continues operating normally
- Failed transmissions are retried during the next scheduled transmission
- No telemetry data is queued or persisted locally

### Startup Logging

Arc logs telemetry status on startup:

**When Enabled**:
```
INFO: Telemetry enabled. Sending anonymous usage data to telemetry.basekick.net every 24 hours.
```

**When Disabled**:
```
INFO: Telemetry disabled via configuration.
```

## Disabling Telemetry

You can opt out of telemetry in two ways:

### Option 1: Configuration File

Edit your `arc.conf` file and add:

```toml
[telemetry]
enabled = false
```

**Full Example**:
```toml
[server]
host = "0.0.0.0"
port = 8000

[telemetry]
enabled = false
```

### Option 2: Environment Variable

Set the environment variable before starting Arc:

```bash
export ARC_TELEMETRY_ENABLED=false
```

**With Docker**:
```bash
docker run -e ARC_TELEMETRY_ENABLED=false arc:latest
```

**With Docker Compose**:
```yaml
services:
  arc:
    image: arc:latest
    environment:
      - ARC_TELEMETRY_ENABLED=false
```

### Verification

After configuring, start Arc and check the logs:

```
INFO: Telemetry disabled via configuration.
```

If you see this message, telemetry is successfully disabled.

## Why Telemetry?

### Benefits to the Project

Anonymous telemetry helps the Arc team:

1. **Prioritize Platform Support**: Understand which operating systems and architectures to focus on
2. **Test on Real Hardware**: Know what CPU and memory configurations are common
3. **Track Version Adoption**: See how quickly users upgrade to new releases
4. **Plan Deprecations**: Identify when old versions are no longer in use

### Privacy Considerations

Arc's telemetry is designed with privacy as a priority:

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
- Network timeout is short (5 seconds)
- Failed transmissions don't block Arc operations

### Can I verify what's being sent?

Yes. You can inspect the telemetry payload by:

1. **Network Inspection**: Use tools like Wireshark or tcpdump to capture the request
2. **Source Code**: Review the telemetry implementation in the Arc repository
3. **Logging**: Enable debug logging to see telemetry payloads (future feature)

### What happens to the data?

Telemetry data is:
- Stored securely on Basekick infrastructure
- Aggregated for statistical analysis
- Not shared with third parties
- Not used for commercial purposes
- Retained for a limited time (90 days)

### Will Arc work if telemetry is blocked?

Yes. Arc functions identically whether telemetry is enabled or disabled. If the telemetry endpoint is unreachable (firewall, network issues), Arc logs a warning and continues normally.

### Why not make it opt-in?

We believe in transparency and easy opt-out rather than opt-in because:
- Telemetry helps improve the product for everyone
- Data collected is truly anonymous and minimal
- Opt-out is simple and clearly documented
- Many users don't discover opt-in options

However, we respect your choice and make opting out straightforward.

### Does Arc Enterprise have different telemetry?

No. Both Arc Core and Arc Enterprise use identical telemetry collection. Arc Enterprise customers can request custom telemetry configurations for their deployments.

## Privacy Policy

For detailed information about how Basekick handles data, see our [Privacy Policy](https://basekick.net/privacy) (Coming Soon).

## Support

If you have questions or concerns about telemetry:
- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
- Email: privacy@basekick.net
