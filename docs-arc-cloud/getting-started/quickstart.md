---
sidebar_position: 1
---

# Quickstart

Get up and running with Arc Cloud in under a minute.

## 1. Sign Up

Create a free account at [cloud.arc.basekick.net/signup](https://cloud.arc.basekick.net/signup). No credit card required.

## 2. Create an Instance

From the dashboard, click **Create Instance** and select the **Free** tier. Your instance includes 0.5 vCPU, 512 MB RAM, and 5 GB storage.

## 3. Wait for Provisioning

Your instance will be ready in approximately 30 seconds. The status indicator will change from **Provisioning** to **Running**.

## 4. Get Your Connection Details

Once provisioning completes, you will see:

- **Endpoint URL**: `https://<instance-id>.arc.<region>.basekick.net`
- **Admin Token**: A one-time token displayed on screen

:::warning Save Your Admin Token
The admin token is shown **only once** during provisioning. Copy it immediately and store it securely. If you lose it, you will need to restart the instance to generate a new one.
:::

## 5. Send Your First Query

Verify your instance is running with a simple query:

```bash
curl -X POST "https://<your-instance>.arc.us-east-1.basekick.net/api/v1/query" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT 1 AS hello", "format": "json"}'
```

You should receive a JSON response with the result `hello: 1`.

## 6. Ingest Data

Send your first records to Arc Cloud using line protocol, the simplest way to write data via `curl`:

```bash
curl -X POST "https://<your-instance>.arc.us-east-1.basekick.net/api/v1/write/line-protocol" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -H "x-arc-database: default" \
  -d 'events,source=web page_view=1,user_id="u123",page="/home" 1711180800000000000'
```

Arc Cloud automatically creates the database and table on first write.

:::tip MessagePack for Production
Line protocol is convenient for quick tests. For production workloads, use the MessagePack endpoint (`POST /api/v1/write/msgpack`) with columnar format for higher throughput and lower overhead. See the [Arc API Reference](/arc/api-reference) for details.
:::

## 7. Query Your Data

Retrieve the data you just ingested:

```bash
curl -X POST "https://<your-instance>.arc.us-east-1.basekick.net/api/v1/query" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM default.events LIMIT 10", "format": "json"}'
```

## 8. Use the Python SDK

Arc Cloud exposes the same API as Arc OSS, so all Arc clients and SDKs work without modification. Install the Python SDK:

```bash
pip install arc-tsdb-client[all]
```

```python
from arc_tsdb_client import ArcClient

client = ArcClient(
    url="https://<your-instance>.arc.us-east-1.basekick.net",
    token="<your-token>",
)

# Query
result = client.query("SELECT * FROM default.events LIMIT 10")
print(result)
```

## Next Steps

- [Dashboard Guide](/arc-cloud/getting-started/dashboard) — Explore the SQL console, log explorer, and more
- [Connection Details](/arc-cloud/getting-started/connection) — Authentication, SDKs, and client libraries
- [Arc API Reference](/arc/api-reference) — The Arc Cloud HTTP API is the same as the Arc API. See the full reference for all endpoints, formats, and options.
