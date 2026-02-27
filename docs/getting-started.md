---
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Getting Started

Get Arc up and running in 5 minutes.

## Prerequisites

- 4GB RAM minimum, 8GB+ recommended
- Docker, Kubernetes, or Linux (Debian/RHEL)

## Quick Start

<Tabs>
  <TabItem value="docker" label="Docker" default>

```bash
docker run -d \
  --name arc \
  -p 8000:8000 \
  -v arc-data:/app/data \
  ghcr.io/basekick-labs/arc:latest
```

  </TabItem>
  <TabItem value="kubernetes" label="Kubernetes">

```bash
helm install arc https://github.com/basekick-labs/arc/releases/latest/download/arc-25.12.1.tgz
kubectl port-forward svc/arc 8000:8000
```

  </TabItem>
  <TabItem value="debian" label="Debian/Ubuntu">

```bash
wget https://github.com/basekick-labs/arc/releases/latest/download/arc_25.12.1_amd64.deb
sudo dpkg -i arc_25.12.1_amd64.deb
sudo systemctl enable arc && sudo systemctl start arc
```

  </TabItem>
  <TabItem value="rhel" label="RHEL/Fedora">

```bash
wget https://github.com/basekick-labs/arc/releases/latest/download/arc-25.12.1-1.x86_64.rpm
sudo rpm -i arc-25.12.1-1.x86_64.rpm
sudo systemctl enable arc && sudo systemctl start arc
```

  </TabItem>
</Tabs>

**Verify it's running:**

```bash
curl http://localhost:8000/health
```

## Get Your Admin Token

Arc generates an admin token on first startup. **Copy it immediately - you won't see it again!**

<Tabs>
  <TabItem value="docker" label="Docker" default>

```bash
docker logs arc 2>&1 | grep -i "admin"
```

  </TabItem>
  <TabItem value="kubernetes" label="Kubernetes">

```bash
kubectl logs -l app=arc | grep -i "admin"
```

  </TabItem>
  <TabItem value="native" label="Native (systemd)">

```bash
sudo journalctl -u arc | grep -i "admin"
```

  </TabItem>
</Tabs>

You'll see:
```
======================================================================
  FIRST RUN - INITIAL ADMIN TOKEN GENERATED
======================================================================
  Initial admin API token: arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
======================================================================
```

Save it:
```bash
export ARC_TOKEN="arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Write Data

<Tabs>
  <TabItem value="msgpack" label="MessagePack (18.6M rec/s)" default>

```python
import msgpack
import requests
from datetime import datetime
import os

token = os.getenv("ARC_TOKEN")

data = {
    "m": "cpu",
    "columns": {
        "time": [int(datetime.now().timestamp() * 1000)],
        "host": ["server01"],
        "usage_idle": [95.0],
        "usage_user": [3.2]
    }
}

response = requests.post(
    "http://localhost:8000/api/v1/write/msgpack",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/msgpack",
        "x-arc-database": "default"
    },
    data=msgpack.packb(data)
)
```

  </TabItem>
  <TabItem value="lineprotocol" label="Line Protocol">

```bash
# InfluxDB 1.x compatible endpoint
curl -X POST "http://localhost:8000/write?db=default&p=$ARC_TOKEN" \
  --data-binary "cpu,host=server01 usage_idle=95.0,usage_user=3.2"

# Or with Authorization header
curl -X POST "http://localhost:8000/write?db=default" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  --data-binary "cpu,host=server01 usage_idle=95.0,usage_user=3.2"
```

  </TabItem>
  <TabItem value="sdk" label="Python SDK">

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token=os.environ["ARC_TOKEN"]) as client:
    client.write.write_columnar(
        measurement="cpu",
        columns={
            "time": [1704067200000],
            "host": ["server01"],
            "usage_idle": [95.0],
        },
    )
```

  </TabItem>
</Tabs>

## Query Data

<Tabs>
  <TabItem value="curl" label="curl" default>

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM default.cpu LIMIT 10", "format": "json"}'
```

  </TabItem>
  <TabItem value="python" label="Python">

```python
import requests
import os

token = os.getenv("ARC_TOKEN")

response = requests.post(
    "http://localhost:8000/api/v1/query",
    headers={"Authorization": f"Bearer {token}"},
    json={"sql": "SELECT * FROM default.cpu LIMIT 10", "format": "json"}
)

print(response.json())
```

  </TabItem>
  <TabItem value="arrow" label="Arrow (2.64M rows/s)">

```python
import requests
import pyarrow as pa
import os

token = os.getenv("ARC_TOKEN")

response = requests.post(
    "http://localhost:8000/api/v1/query/arrow",
    headers={"Authorization": f"Bearer {token}"},
    json={"sql": "SELECT * FROM default.cpu LIMIT 10000"}
)

reader = pa.ipc.open_stream(response.content)
df = reader.read_all().to_pandas()
print(df.head())
```

  </TabItem>
</Tabs>

## Next Steps

- **[Python SDK](/arc/sdks/python/)** - Official client with DataFrame support
- **[Telegraf Integration](/arc/integrations/telegraf)** - Collect system metrics
- **[Apache Superset](/arc/integrations/superset)** - Build dashboards
- **[Configuration](/arc/configuration/overview)** - Tune Arc for your workload

## Troubleshooting

<Tabs>
  <TabItem value="docker" label="Docker" default>

```bash
docker logs arc
```

  </TabItem>
  <TabItem value="kubernetes" label="Kubernetes">

```bash
kubectl logs -l app=arc
kubectl describe pod -l app=arc
```

  </TabItem>
  <TabItem value="native" label="Native">

```bash
sudo journalctl -u arc -n 50
sudo systemctl status arc
```

  </TabItem>
</Tabs>

### Common Issues

**Authentication errors**: Make sure `ARC_TOKEN` is set and included in headers.

**No data returned**: Data may not be flushed yet. Force flush:
```bash
curl -X POST http://localhost:8000/api/v1/write/line-protocol/flush \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Need Help?

- [Discord Community](https://discord.gg/nxnWfUxsdm)
- [GitHub Issues](https://github.com/basekick-labs/arc/issues)
