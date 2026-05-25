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

## Cluster auth replication (Enterprise)

:::info Available since v26.06.1
Cluster-wide token replication is available in Arc Enterprise v26.06.1 and later. OSS / standalone deployments are unaffected — tokens stay in the local SQLite as they always have.
:::

Before v26.06.1, every Arc Enterprise cluster node carried its own SQLite auth DB. A token created via `POST /api/v1/auth/tokens` on the writer was **not** valid on the reader — the reader's local SQLite never saw the row. Operators worked around this by pre-seeding `ARC_AUTH_BOOTSTRAP_TOKEN` with the same value on every node, but API-created tokens and revocations did not propagate. A revocation on the writer left the same token still valid on every reader for the lifetime of those reader processes.

v26.06.1 routes auth **writes** through the cluster's Raft consensus. Auth **reads** still hit the local cache — there's no Raft round trip on every API call.

### What replicates

| Operation | Replicates cluster-wide? |
|-----------|---|
| Create token | Yes |
| Update token (rename, change permissions, change expiry) | Yes |
| Revoke token | Yes |
| Delete token | Yes |
| Rotate token (new value, same metadata) | Yes |
| `EnsureInitialToken` (first-run bootstrap) | Yes — only the Raft leader's proposal lands; other nodes get an "already exists" no-op |
| RBAC tables (organizations, teams, roles, measurement permissions, token memberships) | Yes — landed in v26.06.1 alongside Phase A. See [RBAC replication](#rbac-replication-enterprise) below. |
| Audit log entries | **No — intentionally per-node** (high-volume append-only, no consensus needed) |
| SSO / OIDC / LDAP | **No — Phase B, separate roadmap item** |

### Convergence semantics

Eventual consistency, typically under 50 ms via Raft apply on local loopback or LAN. Customer SDKs already retry on transient 401, so the brief window between leader commit and follower materialise is invisible in normal usage.

A read-after-write barrier is **not** included in v26.06.1. If a real customer report surfaces the window, a follow-up will add a per-query `LastApplied()` barrier on the query path.

### Bootstrap banner now prints on the leader only

Before v26.06.1, every cluster node printed its own randomly-generated admin token at first start, so a 4-node boot produced 4 banners and 4 different admin tokens (each valid only on its own node).

From v26.06.1, every node still calls `EnsureInitialToken` on boot with its own random plaintext, but only the Raft leader's proposal lands cluster-wide. Followers receive the FSM's `"token name already exists"` rejection from the leader and return an empty plaintext to the caller, so **no banner is emitted on losers**. The losing node's local SQLite still gets the winner's bcrypt hash + prefix via the FSM materialise callback — every node converges on the same admin token.

If you watch a 3-writer + 1-reader cluster boot, expect:
- 1 `Admin API token:` banner on the Raft leader's stderr
- 3 `INFO Deferring initial token bootstrap until cluster Raft proposer is wired (Phase A)` lines during startup (one per node)
- 1 `INFO Cluster auth state replication enabled — token writes now propagate via Raft` line per node after Raft elects a leader

### Security posture

Plaintext token values are **never** written to the Raft log. The proposer generates the token, hashes it with bcrypt locally, and only the hash + prefix go into the replicated payload. The plaintext is returned to the API caller out-of-band before any Raft work begins. Snapshot dumps don't contain plaintext either — verified by a snapshot-grep test in the test suite.

Applier-side validation runs on every node before a token command lands in the FSM. Empty name, missing bcrypt hash, missing prefix, malformed permission string, or zero `created_at` all cause the entry to be rejected on every node. The cluster-wide rejection counter (`arc_cluster_auth_rejected_total`) increments and the rejection is logged at `Error`.

### Prometheus counters

Per node, on the `/metrics` endpoint:

```
arc_cluster_auth_apply_create_total
arc_cluster_auth_apply_update_total
arc_cluster_auth_apply_revoke_total
arc_cluster_auth_apply_delete_total
arc_cluster_auth_apply_rotate_total
arc_cluster_auth_rejected_total
```

In a healthy cluster every node sees the same monotonic count for each `apply_*` counter — they all apply the same Raft log. Divergence across nodes is the load-bearing signal that one of them is missing applies (network partition, FSM stall).

`arc_cluster_auth_rejected_total` is the **security alerting signal** — non-zero growth means somebody is proposing tokens that fail applier-side validation (malformed payload, fuzz attempt, or a buggy client). Alert on growth, not on absolute value.

### Pre-existing tokens DO NOT auto-migrate

Tokens created on a pre-v26.06.1 node by the local-only API path remain valid **only on that node** after upgrade. The expected migration path is:

1. Upgrade every cluster node to v26.06.1.
2. Re-issue API tokens via `POST /api/v1/auth/tokens` after restart. New tokens are cluster-wide automatically.
3. Revoke the old per-node tokens via `POST /api/v1/auth/tokens/:id/revoke` (the revoke also propagates cluster-wide).

Bootstrap tokens set via `ARC_AUTH_BOOTSTRAP_TOKEN` are unaffected if the same value was used on every node (which the pre-v26.06.1 workaround required) — the bytes match, so all nodes effectively share the same admin token already.

### Divergence detection

If a pre-v26.06.1 AUTOINCREMENT row in your local `auth.db` happens to share an ID with a new cluster-replicated token (Raft log indices land in the same `INTEGER` space), the cluster apply on that node will detect the collision and **refuse to overwrite** the pre-existing row. The cluster's in-memory FSM map remains authoritative; the local SQLite cache stays divergent until the operator resolves it.

You'll see an `Error`-level log line on the affected node:

```
ApplyCreateToken: id <N> already exists locally with different token (cluster<->local divergence; see upgrade notes for pre-26.06.1 tokens)
```

And the `arc_cluster_auth_rejected_total` counter increments on that node only.

**Remediation**: drop the diverging rows from the local `auth.db`, or drop the whole local auth DB and let the FSM repopulate from the cluster's snapshot. Stop Arc on the affected node, run:

```sql
sqlite3 /app/data/arc.db "DELETE FROM api_tokens WHERE id = <N>"
```

Then restart Arc — it'll re-apply the cluster's authoritative state on the affected ID range.

Identical hash + name is treated as idempotent log replay (no-op, no error), so a normal cluster restart never surfaces this.

### `arcx`-style upgrade path

Operators of pre-v26.06.1 Enterprise clusters with many AUTOINCREMENT tokens may prefer to **drain the local auth DB** before re-joining:

1. Note down the names of any service tokens currently in active use.
2. Stop Arc on the node.
3. Move `auth.db`, `auth.db-shm`, `auth.db-wal` aside (don't delete — keep as backup).
4. Restart Arc with `ARC_AUTH_BOOTSTRAP_TOKEN` matching the cluster's admin token.
5. Re-issue the service tokens cluster-wide via the API on any leader-eligible node.

The cluster's FSM is the source of truth, so this drain-and-rejoin is non-destructive — the only state at risk is per-node tokens that weren't intended to be cluster-wide, and the release notes already document that they don't carry over.

### Required configuration

In addition to standard cluster mode (`cluster.enabled = true`, `cluster.raft_data_dir`, etc.), token replication requires:

```toml
[cluster]
shared_secret = "..."  # min 32 chars; same value on every node
```

The shared secret authenticates leader-forward HMAC for non-leader nodes proposing token writes. Without it, follower nodes refuse to forward auth proposals and the cluster falls back to OSS-mode bootstrap on every node (you'll see 4 banners again).

```bash
export ARC_CLUSTER_SHARED_SECRET="$(openssl rand -hex 32)"
```

:::caution Same value on every node
If nodes have different secrets, follower-to-leader forward-apply fails HMAC validation and token writes that originate on a non-leader silently fail. There is no graceful fallback — operators must ensure the secret is identical across the cluster (e.g. via Kubernetes Secrets or environment-variable injection from a single source).
:::

## RBAC replication (Enterprise)

:::info Available since v26.06.1
Phase A.1 of Cluster Auth Convergence — every RBAC write (organizations, teams, roles, measurement permissions, token memberships) propagates cluster-wide via the same Raft FSM seam used for tokens. Lands in the same v26.06.1 release as Phase A token replication.
:::

Before v26.06.1, RBAC writes hit only the local node's SQLite — same shape as the token gap Phase A closes. An organization created on the writer was invisible to RBAC checks on every reader; a role grant on one node didn't grant the corresponding permission anywhere else. v26.06.1 routes all 13 RBAC writes through Raft so the cluster converges on a single RBAC state.

### What replicates

| RBAC operation | Replicates cluster-wide? |
|----------------|---|
| `POST /api/v1/rbac/organizations` (create) | Yes |
| `PATCH /api/v1/rbac/organizations/:id` (update) | Yes |
| `DELETE /api/v1/rbac/organizations/:id` (delete + cascade to teams, roles, measurement permissions, memberships) | Yes |
| `POST /api/v1/rbac/organizations/:org_id/teams` (create) | Yes |
| `PATCH /api/v1/rbac/teams/:id` (update) | Yes |
| `DELETE /api/v1/rbac/teams/:id` (delete + cascade to roles, measurement permissions, memberships) | Yes |
| `POST /api/v1/rbac/teams/:team_id/roles` (create) | Yes |
| `PATCH /api/v1/rbac/roles/:id` (update) | Yes |
| `DELETE /api/v1/rbac/roles/:id` (delete + cascade to measurement permissions) | Yes |
| `POST /api/v1/rbac/roles/:role_id/measurements` (create) | Yes |
| `DELETE /api/v1/rbac/measurement-permissions/:id` (leaf delete) | Yes |
| `POST /api/v1/auth/tokens/:id/teams` (add membership) | Yes |
| `DELETE /api/v1/auth/tokens/:id/teams/:team_id` (remove membership) | Yes |

### Cascade-on-delete

Deleting an organization removes every descendant — teams, roles, measurement permissions, and token memberships — under a single Raft log entry. Same for `DeleteTeam` (cascades to roles + measurement permissions + memberships) and `DeleteRole` (cascades to measurement permissions). Concurrent writes targeting a being-cascaded entity are serialised and see the post-cascade state.

When a token is hard-deleted via `DELETE /api/v1/auth/tokens/:id` its memberships are also removed cluster-wide — mirroring the SQLite FK cascade `rbac_token_memberships.token_id REFERENCES api_tokens(id) ON DELETE CASCADE` at the FSM layer so the in-memory state stays consistent across nodes.

### Cascade-on-delete soft cap

:::info Available since v26.06.1
Phase A.2 Item 2 — a configurable cap on the number of descendants `DeleteOrganization` / `DeleteTeam` will cascade through in cluster mode.
:::

The FSM cascade-on-delete runs under `f.mu.Lock()` on the single-threaded Raft apply goroutine. hashicorp/raft runs `runFSM` async of heartbeats, so a long apply does **not** directly cost the leader its lease — but for a pathologically large tenant (~100k+ descendants under one organization), the cascade can hold the apply goroutine long enough to blow past the proposer-side 5 s `proposeTimeout`. The originating client sees an opaque timeout while the apply still completes in the background; meanwhile later commands queue behind the slow apply and risk failing their own timeout budgets. Operators see unclear "propose timeout" diagnostics on a delete that "should have worked," instead of a clear "you tried to delete too much at once."

v26.06.1 ships a configurable proposer-side cap. Before proposing `CommandDeleteOrganization` or `CommandDeleteTeam`, the proposer counts the descendants in local SQLite (`teams + roles + measurement_permissions + token_memberships`). If the total exceeds the cap, the API returns **HTTP 409 Conflict** without spending a Raft log entry on a cascade that would block the apply path.

| Setting | Value |
|---|---|
| Config key (TOML) | `cluster.rbac.max_cascade_descendants` |
| Env var | `ARC_CLUSTER_RBAC_MAX_CASCADE_DESCENDANTS` |
| Default | `50000` |
| Disable | `0` (no cap; escape hatch for operators who know their workload) |
| HTTP code on rejection | `409 Conflict` |
| Metric | `arc_cluster_rbac_cascade_rejected_total` |

The error body includes the actual descendant count, the configured cap, and the operator workaround:

```json
{
  "success": false,
  "error": "cascade exceeds configured limit: 73214 descendants under organization 42 (max 50000); delete child entities (teams, roles, measurement_permissions, token_memberships) first"
}
```

Operator workaround when 409 lands: `DELETE` the affected children first (roles → teams → re-attempt the org delete), or raise the cap if your tenant size justifies it. `DeleteRole`'s cascade is 1-level (only measurement_permissions) and is not capped — it can't plausibly blow up the apply path.

The pre-check costs four small `COUNT(*)` queries against indexed columns — sub-millisecond at realistic cap values, well under the 5-second Raft proposal timeout.

### Pre-existing RBAC rows: auto-seed for orgs, manual re-issue for the rest

On the first leader boot after upgrading to v26.06.1, Arc runs a one-time **upgrade seed** that walks the leader's local `rbac_organizations` table and proposes a `CommandCreateOrganization` for every pre-existing row. The cluster's in-memory FSM learns the org under a fresh log-index ID; the leader's local SQLite keeps the row under its pre-v26.06.1 AUTOINCREMENT ID; both IDs map to the same logical org because the `UNIQUE(name)` constraint is enforced cluster-wide. Followers see the new org via Raft replication and store it under the cluster ID.

**Teams, roles, measurement permissions, and token memberships are NOT auto-seeded.** They reference parent entities by surrogate ID, and the pre-v26.06.1 local AUTOINCREMENT IDs don't generally match the cluster's log-index-stamped IDs after the org seed runs. The seed logs a `Warn` at startup listing the unseeded counts per table:

```
WARN child RBAC rows present in local SQLite are NOT auto-seeded (FK-ID rebase ambiguity);
     re-issue them via the API post-upgrade for cluster-wide replication
     teams_local=3 roles_local=7 measurement_permissions_local=12 token_memberships_local=4
```

Re-issue each affected team, role, measurement permission, and token membership via the API after upgrade. Existing local rows stay readable on the leader (the FK chain in local SQLite is intact) — they just won't replicate to followers until re-created.

The seed runs only on the Raft leader, gated by `WaitForLeader(30s)`. It is idempotent — re-running on the same leader is a no-op (each proposal is rejected as `"organization name already exists"` and the seed counts it as skipped rather than retrying).

### Prometheus counters

Per node, alongside the Phase A token counters:

```
arc_cluster_rbac_apply_create_organization_total
arc_cluster_rbac_apply_update_organization_total
arc_cluster_rbac_apply_delete_organization_total
arc_cluster_rbac_apply_create_team_total
arc_cluster_rbac_apply_update_team_total
arc_cluster_rbac_apply_delete_team_total
arc_cluster_rbac_apply_create_role_total
arc_cluster_rbac_apply_update_role_total
arc_cluster_rbac_apply_delete_role_total
arc_cluster_rbac_apply_create_measurement_permission_total
arc_cluster_rbac_apply_delete_measurement_permission_total
arc_cluster_rbac_apply_add_token_to_team_total
arc_cluster_rbac_apply_remove_token_from_team_total
arc_cluster_rbac_rejected_total
arc_cluster_rbac_cascade_rejected_total
```

`arc_cluster_rbac_rejected_total` is a **single counter aggregating applier-side validation failures across all 13 RBAC command types** — empty names, missing parent IDs, malformed permission strings, UNIQUE collisions. Same security-alerting semantics as `arc_cluster_auth_rejected_total`: non-zero growth means somebody is proposing malformed RBAC commands; alert on growth.

`arc_cluster_rbac_cascade_rejected_total` counts proposer-side cascade-cap refusals (see [Cascade-on-delete soft cap](#cascade-on-delete-soft-cap) above). Non-zero growth means operators are issuing cascades larger than `cluster.rbac.max_cascade_descendants`. Alert if you'd rather raise the cap than have operators retry after manual cleanup.

In a healthy cluster every node sees the same monotonic count for each `apply_*` counter. Per-node divergence indicates a node missing applies (network partition, FSM stall).

### Required configuration

RBAC replication itself requires no new env vars — it is gated by the same `cluster.enabled = true` + Enterprise license + `cluster.shared_secret` that gate Phase A token replication.

One **optional** knob is documented above: `cluster.rbac.max_cascade_descendants` (env `ARC_CLUSTER_RBAC_MAX_CASCADE_DESCENDANTS`, default `50000`) caps cluster-mode `DeleteOrganization` / `DeleteTeam` cascades. See [Cascade-on-delete soft cap](#cascade-on-delete-soft-cap).

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
