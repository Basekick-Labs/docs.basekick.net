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
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/sql \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1 AS hello"}'
```

You should receive a JSON response with the result `hello: 1`.

## 6. Ingest Data

Send your first records to Arc Cloud:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/ingest \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "database": "my_app",
    "records": [
      {"timestamp": "2026-03-23T12:00:00Z", "event": "page_view", "user_id": "u123", "page": "/home"}
    ]
  }'
```

Arc Cloud automatically creates the database and table on first write.

## 7. Query Your Data

Retrieve the data you just ingested:

```bash
curl -X POST https://<instance-id>.arc.<region>.basekick.net/api/v1/sql \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM my_app.events LIMIT 10"}'
```

## Next Steps

- [Dashboard Guide](/arc-cloud/getting-started/dashboard) — Explore the SQL console, log explorer, and more
- [Connection Details](/arc-cloud/getting-started/connection) — Authentication, SDKs, and client libraries
- [Arc API Reference](/arc/api-reference) — The Arc Cloud HTTP API is the same as the Arc API. See the full reference for all endpoints, formats, and options.
