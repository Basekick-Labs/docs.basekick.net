---
sidebar_position: 2
---

# Authentication

Arc uses token-based authentication to secure API access. Tokens are stored in a SQLite database with an in-memory cache for high-performance validation.

:::info Enabled by Default
Authentication is enabled by default since Arc v26.01.2. To disable it for local development, set `auth.enabled = false` in `arc.toml`.
:::

## Configuration

```toml
[auth]
enabled = true                    # Enable/disable authentication
db_path = "./data/arc_auth.db"    # SQLite database for token storage
cache_ttl = 30                    # Token cache TTL in seconds
max_cache_size = 1000             # Maximum cached tokens
bootstrap_token = ""              # Pre-set admin token value (v26.04.1+)
force_bootstrap = false           # Add a recovery token without removing existing ones (v26.04.1+)
```

**Environment variables:**
```bash
export ARC_AUTH_ENABLED=true
export ARC_AUTH_DB_PATH="./data/arc_auth.db"
export ARC_AUTH_CACHE_TTL=30
export ARC_AUTH_MAX_CACHE_SIZE=1000
export ARC_AUTH_BOOTSTRAP_TOKEN=""   # v26.04.1+
export ARC_AUTH_FORCE_BOOTSTRAP=false  # v26.04.1+
```

## Authentication Methods

Arc supports multiple authentication methods for compatibility with various clients:

### Bearer Token (Standard)

```bash
curl -H "Authorization: Bearer $ARC_TOKEN" http://localhost:8000/api/v1/query
```

### Token Header (InfluxDB 2.x Style)

```bash
curl -H "Authorization: Token $ARC_TOKEN" http://localhost:8000/api/v1/query
```

### API Key Header

```bash
curl -H "x-api-key: $ARC_TOKEN" http://localhost:8000/api/v1/query
```

### Query Parameter (InfluxDB 1.x Style)

For InfluxDB 1.x client compatibility:

```bash
curl "http://localhost:8000/write?db=mydb&p=$ARC_TOKEN" -d 'cpu,host=server01 usage=45.2'
```

## Bootstrap & Recovery

:::info Available since v26.04.1
`ARC_AUTH_BOOTSTRAP_TOKEN` and `ARC_AUTH_FORCE_BOOTSTRAP` are available in Arc and Arc Enterprise v26.04.1 and later.
:::

### Pre-configured Bootstrap Token

By default, Arc generates a random admin token on first start and prints it once to stderr. If you miss it, recovery requires deleting the auth database and redeploying.

`ARC_AUTH_BOOTSTRAP_TOKEN` lets you set a known token value at deploy time. On first run, Arc uses this value as the initial admin token instead of generating a random one. On subsequent restarts, it is a no-op — the existing token is preserved.

```bash
export ARC_AUTH_BOOTSTRAP_TOKEN="your-secret-token-value-at-least-32-chars"
```

This is especially useful for:
- **Automated deployments** — bake the token into your secrets manager (Vault, AWS Secrets Manager, Kubernetes Secrets) and have it ready without catching a log line
- **Reproducible environments** — staging and production can use different known tokens set consistently at deploy time

:::caution Minimum length
Token values must be at least 32 characters. Values are stored as bcrypt hashes — the plaintext never persists to disk.
:::

### Recovery When the Admin Token is Lost

If you no longer have access to any admin token, set both `ARC_AUTH_BOOTSTRAP_TOKEN` and `ARC_AUTH_FORCE_BOOTSTRAP=true` before restarting Arc. Arc will add a new admin token named `arc-recovery` **without removing any existing tokens**.

```bash
export ARC_AUTH_BOOTSTRAP_TOKEN="your-new-recovery-token-at-least-32-chars"
export ARC_AUTH_FORCE_BOOTSTRAP=true
```

Existing tokens are preserved so that if the recovery token was injected by a bad actor, any legitimate admin still has their token and can revoke it immediately via the API.

After recovering access:
1. Use the API to review and revoke any tokens you no longer need
2. Remove `ARC_AUTH_FORCE_BOOTSTRAP` from your deployment configuration

:::tip Idempotent on restart
If Arc restarts with `ARC_AUTH_FORCE_BOOTSTRAP=true` and the `arc-recovery` token already exists, it is a no-op. You still hold the token value you provided.
:::

## Token Management

All token management endpoints require **admin** authentication.

### Creating Tokens

```bash
curl -X POST "http://localhost:8000/api/v1/auth/tokens" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-service",
    "description": "Token for production service",
    "is_admin": false
  }'
```

```json
{
  "id": "abc123",
  "name": "my-service",
  "token": "arc_xxxxxxxxxxxxxxxxxxxxxxxx",
  "is_admin": false,
  "created_at": "2026-01-15T10:30:00Z"
}
```

:::caution Save the Token
The token value is only returned once at creation time. Store it securely -- it cannot be retrieved later.
:::

### Listing Tokens

```bash
curl "http://localhost:8000/api/v1/auth/tokens" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Rotating a Token

Generate a new token value while keeping the same token ID and permissions:

```bash
curl -X POST "http://localhost:8000/api/v1/auth/tokens/abc123/rotate" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Revoking a Token

Immediately invalidate a token:

```bash
curl -X POST "http://localhost:8000/api/v1/auth/tokens/abc123/revoke" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Deleting a Token

Permanently remove a token:

```bash
curl -X DELETE "http://localhost:8000/api/v1/auth/tokens/abc123" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Verifying a Token

The verify endpoint is public (no authentication required) and checks if a token is valid:

```bash
curl -H "Authorization: Bearer $ARC_TOKEN" \
  "http://localhost:8000/api/v1/auth/verify"
```

```json
{
  "valid": true,
  "token_info": {
    "id": "abc123",
    "name": "my-service",
    "is_admin": false
  },
  "permissions": []
}
```

## Token Cache

Arc caches validated tokens in memory to avoid SQLite lookups on every request. This is critical for high-throughput ingestion (18M+ records/sec).

### Cache Statistics

```bash
curl "http://localhost:8000/api/v1/auth/cache/stats" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Invalidating the Cache

Force all cached tokens to be re-validated against SQLite:

```bash
curl -X POST "http://localhost:8000/api/v1/auth/cache/invalidate" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

:::tip When to Invalidate
Cache invalidation is automatic for most operations (revoke, delete, rotate). Manual invalidation is only needed if you modify the SQLite database directly.
:::

## Public Endpoints

These endpoints do not require authentication:

- `GET /health` -- Health check
- `GET /ready` -- Readiness probe
- `GET /metrics` -- Prometheus metrics
- `GET /api/v1/auth/verify` -- Token verification

## API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/auth/verify` | Public | Verify token validity |
| `GET` | `/api/v1/auth/tokens` | Admin | List all tokens |
| `POST` | `/api/v1/auth/tokens` | Admin | Create a new token |
| `GET` | `/api/v1/auth/tokens/:id` | Admin | Get token details |
| `PATCH` | `/api/v1/auth/tokens/:id` | Admin | Update token metadata |
| `DELETE` | `/api/v1/auth/tokens/:id` | Admin | Delete a token |
| `POST` | `/api/v1/auth/tokens/:id/rotate` | Admin | Rotate token value |
| `POST` | `/api/v1/auth/tokens/:id/revoke` | Admin | Revoke a token |
| `GET` | `/api/v1/auth/cache/stats` | Admin | Cache statistics |
| `POST` | `/api/v1/auth/cache/invalidate` | Admin | Invalidate token cache |
