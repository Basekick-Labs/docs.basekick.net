---
sidebar_position: 1
---

# Installation

Launchpad ships as a container image, a Helm chart, and source. Pick the path that fits your environment. The only strictly required configuration is `LAUNCHPAD_JWT_SECRET`, without which the app refuses to start in production.

## Docker Compose (with Arc)

The fastest way to try Launchpad is to bring up both Arc and Launchpad together. Create a `docker-compose.yml`:

```yaml
services:
  arc:
    image: ghcr.io/basekick-labs/arc:latest
    container_name: arc
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - STORAGE_BACKEND=local
    volumes:
      - arc-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  launchpad:
    image: ghcr.io/basekick-labs/launchpad:latest
    container_name: launchpad
    restart: unless-stopped
    depends_on:
      - arc
    ports:
      - "3000:3000"
    environment:
      # REQUIRED: signs session tokens. Generate with: openssl rand -hex 32
      - LAUNCHPAD_JWT_SECRET=${LAUNCHPAD_JWT_SECRET:?set LAUNCHPAD_JWT_SECRET}
      # Public URL of this deployment (email links + passkey origin).
      - LAUNCHPAD_BASE_URL=${LAUNCHPAD_BASE_URL:-http://localhost:3000}
      - LAUNCHPAD_DB_PATH=/app/data/launchpad.db
      # Arc is on the same Docker network (a private address), so allow it.
      - LAUNCHPAD_ALLOW_PRIVATE_ENDPOINTS=true
    volumes:
      - launchpad-data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

volumes:
  arc-data:
  launchpad-data:
```

Bring it up:

```bash
LAUNCHPAD_JWT_SECRET=$(openssl rand -hex 32) docker compose up -d
```

Then open **http://localhost:3000** and continue with [First-run setup](/launchpad/getting-started/first-run-setup).

:::note Private endpoints
By default Launchpad **rejects** Arc endpoints that resolve to a private, loopback, or link-local address. This is an SSRF safeguard, since its proxy forwards requests to whatever endpoint you register. Because Arc here lives on the same Docker network, the compose sets `LAUNCHPAD_ALLOW_PRIVATE_ENDPOINTS=true`. See [Configuration](/launchpad/administration/configuration#private-endpoints).
:::

## Standalone Docker

Point Launchpad at an Arc you already run elsewhere:

```bash
docker run -p 3000:3000 \
  -e LAUNCHPAD_JWT_SECRET=$(openssl rand -hex 32) \
  -e LAUNCHPAD_BASE_URL=http://localhost:3000 \
  -v launchpad-data:/app/data \
  ghcr.io/basekick-labs/launchpad:latest
```

The SQLite database is written to `/app/data/launchpad.db`; mount a volume there to persist it.

:::tip
Set `LAUNCHPAD_BASE_URL` to the public URL you actually serve on. It also drives the `ORIGIN` used for CSRF and the `secure` flag on session cookies, so a mismatch can cause login or form actions to fail. See [Configuration](/launchpad/administration/configuration).
:::

## Helm (Kubernetes)

```bash
helm install launchpad oci://ghcr.io/basekick-labs/charts/launchpad \
  --set jwtSecret=$(openssl rand -hex 32) \
  --set baseUrl=https://launchpad.example.com
```

Common values:

| Value | Default | Purpose |
|---|---|---|
| `jwtSecret` | `""` | **Required** unless `existingSecret` is set. Signs session tokens. |
| `existingSecret` | `""` | Name of a pre-created Secret holding `LAUNCHPAD_JWT_SECRET` instead. |
| `baseUrl` | `http://localhost:3000` | Public URL (email links + passkey origin). |
| `persistence.size` | `1Gi` | PVC size for the SQLite database. |
| `ingress.enabled` | `false` | Enable to expose via an Ingress. |

See `helm/launchpad/values.yaml` in the repo for the full list.

## From source

Requires Node.js 20+.

```bash
git clone https://github.com/Basekick-Labs/launchpad
cd launchpad
npm install
cp .env.example .env        # then edit .env: set LAUNCHPAD_JWT_SECRET at minimum
npm run dev                 # http://localhost:5173
```

For a production build:

```bash
npm run build
LAUNCHPAD_JWT_SECRET=$(openssl rand -hex 32) node build
```

The server listens on `$PORT` (default `3000`).

## Next steps

- [First-run setup](/launchpad/getting-started/first-run-setup): create the admin account
- [Connecting to Arc](/launchpad/getting-started/connecting-to-arc): register your first Arc server
- [Configuration](/launchpad/administration/configuration): the full environment-variable reference
