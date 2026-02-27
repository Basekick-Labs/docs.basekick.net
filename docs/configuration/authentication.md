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
```

**Environment variables:**
```bash
export ARC_AUTH_ENABLED=true
export ARC_AUTH_DB_PATH="./data/arc_auth.db"
export ARC_AUTH_CACHE_TTL=30
export ARC_AUTH_MAX_CACHE_SIZE=1000
```

## Authentication Methods

Arc supports multiple authentication methods for compatibility with various clients:

### Bearer Token (Standard)

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/v1/query
```

### Token Header (InfluxDB 2.x Style)

```bash
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8000/api/v1/query
```

### API Key Header

```bash
curl -H "x-api-key: YOUR_TOKEN" http://localhost:8000/api/v1/query
```

### Query Parameter (InfluxDB 1.x Style)

For InfluxDB 1.x client compatibility:

```bash
curl "http://localhost:8000/write?db=mydb&p=YOUR_TOKEN" -d 'cpu,host=server01 usage=45.2'
```

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
curl -H "Authorization: Bearer YOUR_TOKEN" \
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
