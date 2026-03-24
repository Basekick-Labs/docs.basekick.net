---
sidebar_position: 3
---

# Connecting to Your Instance

Every Arc Cloud instance gets a unique HTTPS endpoint. All communication happens over standard HTTP, so any HTTP client or SDK works out of the box.

## Endpoint URL

Each instance is assigned a URL in the following format:

```
https://<instance-id>.arc.<region>.basekick.net
```

You can find your full endpoint URL on the **Instances** page or the **Connection Details** section of the dashboard.

## Authentication

All API requests require a Bearer token in the `Authorization` header:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/sql \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

### Admin Token

The admin token is generated during instance provisioning and displayed **only once**. Save it immediately in a secure location (password manager, secrets vault, etc.).

:::warning Token Shown Once
If you lose your admin token, the only way to get a new one is to **restart the instance**. Restarting generates a fresh token and invalidates the previous one.
:::

## Supported Clients

The Arc Cloud API is standard HTTP. You can connect using:

- **curl** — Quick testing and scripts
- **Any HTTP client** — fetch, requests, axios, HttpClient, etc.
- **Arc Python SDK** — Native Python client with DataFrame support for Pandas, Polars, and PyArrow. See the [Python SDK docs](/arc/sdks/python).

### Python SDK Example

```python
from arc_sdk import ArcClient

client = ArcClient(
    url="https://<instance-id>.arc.<region>.basekick.net",
    token="<your-token>"
)

# Query data
df = client.query("SELECT * FROM my_app.events LIMIT 100")
print(df)
```

See the [Python SDK documentation](/arc/sdks/python) for installation instructions and full API reference.

## Next Steps

- [Quickstart](/arc-cloud/getting-started/quickstart) — Send your first query
- [Dashboard Guide](/arc-cloud/getting-started/dashboard) — Explore the Arc Cloud dashboard
- [Arc API Reference](/arc/api-reference) — Full HTTP API documentation
