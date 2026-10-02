---
title: "Role-Based Access Control (RBAC)"
description: "Model Arc Enterprise access with organizations, teams, and roles, granting read, write, delete, or admin permissions per database and measurement, then binding them to API tokens."
---

Manage access to your Arc deployment with organizations, teams, and granular permissions down to the measurement level.

## Overview

Arc Enterprise RBAC builds on top of Arc's token-based authentication to add organizational structure and fine-grained permissions:

```text
Organization (e.g., "Acme Corp")
  └── Team (e.g., "Data Engineering")
        └── Role (e.g., "production-readwrite")
              ├── Database: "production" → [read, write, delete]
              └── Database: "analytics" → [read]
                    └── Measurements: ["metrics_*", "events_*"]
```

**Key capabilities:**

- **Organizations** — Top-level grouping for your company or division
- **Teams** — Group users by function (engineering, analytics, operations)
- **Roles** — Define permissions per database with optional measurement restrictions
- **Measurement-level permissions** — Restrict access to specific measurements using wildcard patterns
- **Backward compatible** — A token with no team memberships keeps using its own coarse permissions, exactly as before RBAC existed

## Prerequisites

- Authentication must be enabled (`ARC_AUTH_ENABLED=true`)
- An Arc Enterprise license with the RBAC feature, **to create and change grants**

The license gates RBAC *management* — the endpoints below. It does not gate
*enforcement*: see [How enforcement is decided](#how-enforcement-is-decided).

## How enforcement is decided

Three cases, resolved in this order for every read and write Arc authorizes:

1. **The token carries the coarse `admin` permission** → allowed. This is
   deliberate break-glass: without it, putting an admin token into a team
   could lock that token out of its own deployment.
2. **The token belongs to at least one team** → its grants are authoritative,
   and **a denial is final**. There is no fall-back to the token's coarse
   permission list.
3. **The token belongs to no team** → its coarse permissions apply, unchanged.
   This is the backward-compatibility case, and it is what every token in a
   deployment that does not use RBAC falls into.

So a token is restricted by RBAC exactly when it has team memberships. Adding
an existing token to a team narrows it; removing it from every team widens it
back to its coarse permissions.

### Enforcement does not depend on the license

A licence is valid only while it is active or inside its grace period, and
Arc drops the licence client entirely if validation fails at startup. If
enforcement consulted the licence, a lapsed trial, a revoked key or a long
outage to the activation service would switch enforcement **off** — silently
widening every tenant token to full read at whatever hour the licence expired.

Enforcement therefore never consults the licence. A lapse costs you the
ability to *change* grants; it never changes what existing grants do.

### A failure to load grants denies

If Arc cannot read a token's grants — a broken or unreadable metadata
database — it refuses the request rather than falling through to the token's
coarse permissions. The refusal is an HTTP 403 whose message is
`permission data unavailable`, which is a server-side fault and says nothing
about the token. Check the Arc server log.

## Permission model

Permissions are defined at the role level and apply to specific databases:

| Permission | Description |
|-----------|-------------|
| `read` | Query data from the database |
| `write` | Write data to the database |
| `delete` | Delete data from the database |
| `admin` | Full administrative access |

Roles can optionally restrict access to specific measurements within a database using wildcard patterns (e.g., `metrics_*` matches `metrics_cpu`, `metrics_memory`, etc.). Both leading and trailing wildcards are matched (`metrics_*`, `*_metrics`, `prod*`).

A role carrying measurement grants is restricted to them for **every**
request, including requests that name no measurement at all. The role-level
permission list underneath them is the set of actions the grants may convey,
not a database-wide grant that applies when no measurement is named.

## API reference

All RBAC endpoints require admin authentication.

### Organizations

#### Create organization

```bash
curl -X POST http://localhost:8000/api/v1/rbac/organizations \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "description": "Main organization"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Acme Corp",
    "description": "Main organization",
    "created_at": "2026-02-13T10:00:00Z",
    "updated_at": "2026-02-13T10:00:00Z"
  }
}
```

#### List organizations

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/organizations
```

#### Get organization

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/organizations/1
```

#### Update organization

```bash
curl -X PATCH http://localhost:8000/api/v1/rbac/organizations/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'
```

#### Delete organization

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/organizations/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Teams

#### Create team

```bash
curl -X POST http://localhost:8000/api/v1/rbac/organizations/1/teams \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Data Engineering",
    "description": "Data engineering team"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "organization_id": 1,
    "name": "Data Engineering",
    "description": "Data engineering team",
    "created_at": "2026-02-13T10:00:00Z",
    "updated_at": "2026-02-13T10:00:00Z"
  }
}
```

#### List teams

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/organizations/1/teams
```

#### Get team

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/teams/1
```

#### Update team

```bash
curl -X PATCH http://localhost:8000/api/v1/rbac/teams/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated team description"}'
```

#### Delete team

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/teams/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Roles

#### Create role

```bash
curl -X POST http://localhost:8000/api/v1/rbac/teams/1/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production-readwrite",
    "database_pattern": "production",
    "permissions": ["read", "write"]
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "team_id": 1,
    "name": "production-readwrite",
    "database_pattern": "production",
    "permissions": ["read", "write"],
    "created_at": "2026-02-13T10:00:00Z",
    "updated_at": "2026-02-13T10:00:00Z"
  }
}
```

<Callout type="idea" title="Database Wildcards">
Use `*` as the database pattern to grant permissions across all databases. For example, `"database_pattern": "*"` with `"permissions": ["read"]` grants read access to every database.
</Callout>

#### List roles

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/teams/1/roles
```

#### Get role

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/roles/1
```

#### Update role

```bash
curl -X PATCH http://localhost:8000/api/v1/rbac/roles/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissions": ["read", "write", "delete"]}'
```

#### Delete role

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/roles/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Measurement permissions

Restrict a role to specific measurements within its database pattern.

#### Add measurement permission

```bash
curl -X POST http://localhost:8000/api/v1/rbac/roles/1/measurements \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "measurement_pattern": "metrics_*"
  }'
```

#### List measurement permissions

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/roles/1/measurements
```

#### Remove measurement permission

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/roles/1/measurements/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Walkthrough: Setting up RBAC

This example sets up a typical organization with two teams and different access levels.

### Step 1: create the organization

```bash
curl -X POST http://localhost:8000/api/v1/rbac/organizations \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'
```

### Step 2: create teams

```bash
# Data Engineering team — full access
curl -X POST http://localhost:8000/api/v1/rbac/organizations/1/teams \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Data Engineering"}'

# Analytics team — read-only access
curl -X POST http://localhost:8000/api/v1/rbac/organizations/1/teams \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Analytics"}'
```

### Step 3: create roles

```bash
# Data Engineering: read/write/delete on production database
curl -X POST http://localhost:8000/api/v1/rbac/teams/1/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production-full",
    "database_pattern": "production",
    "permissions": ["read", "write", "delete"]
  }'

# Analytics: read-only on production, restricted to specific measurements
curl -X POST http://localhost:8000/api/v1/rbac/teams/2/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production-readonly",
    "database_pattern": "production",
    "permissions": ["read"]
  }'
```

### Step 4: restrict measurements (optional)

```bash
# Analytics team can only see metrics_* and events_* measurements
curl -X POST http://localhost:8000/api/v1/rbac/roles/2/measurements \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"measurement_pattern": "metrics_*"}'

curl -X POST http://localhost:8000/api/v1/rbac/roles/2/measurements \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"measurement_pattern": "events_*"}'
```

## What a scoped token can and cannot list

Arc asks a **different question of each listing**, and that is what decides
whether you get a refusal or a filtered answer.

- **Listing every database** asks for a grant covering every database. A
  token scoped to particular ones is **refused**, not given a partial list.
- **Listing inside one named database** asks the weaker question *"may this
  caller read anything in here?"*. A token with any grant inside it is
  allowed — and the names it gets back are then **filtered per name**, so the
  listing never discloses a measurement the caller cannot read.

| Request | Token granted `production` (whole database) | Token granted `production.cpu` only |
|---|---|---|
| `SHOW DATABASES` | `403` — refused | `403` — refused |
| `GET /api/v1/databases` | `403` — refused | `403` — refused |
| `GET /api/v1/databases/production` | `200` | `200` |
| `SHOW TABLES FROM production` | every measurement | `["cpu"]` |
| `GET /api/v1/databases/production/measurements` | every measurement | `["cpu"]` |
| `GET /api/v1/measurements?database=production` | every measurement | `["cpu"]` |
| `GET /api/v1/databases/analytics` | `403` — no grant inside it | `403` — no grant inside it |
| `GET /api/v1/databases/nonexistent` | `403` — see below | `403` — see below |

### Why the list-everything routes refuse instead of filtering

A filtered list of *databases* leaks the shape of the deployment — how many
exist, and by elimination which names are taken — and it makes a partial
answer indistinguishable from a complete one. A scoped tenant names its
database explicitly, which is the bar every other scoped operation applies.
This is deliberate and will not change.

Filtering *within* a database does not carry that problem: the caller already
had to name the database and prove it can read something in it.

### A missing grant answers 403, not 404

On `GET /api/v1/databases/:name` the permission check runs **before** the
existence check, so "no grant inside it" and "does not exist" both answer
`403` for a database the token has nothing in. A `404` therefore only ever
comes back for a database the token *can* read inside — which is what stops
the endpoint being used to enumerate names.

A database that exists and that the caller can enumerate, but where every
measurement is filtered out, answers `200` with an empty list rather than
`404`.

### Telling the refusals apart

Arc answers `403` for several different reasons, and the status code alone
does not distinguish them. The message does:

| Message | Meaning | What fixes it |
|---|---|---|
| `no permission for read on database '<db>'` | the token's grants do not cover `<db>` | name a database it is granted |
| `access denied: no read permission for database '<db>'` | same, from the query-path gates | name a database it is granted |
| `access denied: no read permission to list databases` | `SHOW DATABASES` from a scoped token | name a database it is granted |
| `token does not have 'read' permission` | the token has no coarse `read` and no grants | a token with read permission |
| `Permission denied: read required` | same, on a deployment with no RBAC configured | a token with read permission |
| `permission data unavailable` | Arc could not load the grants | nothing client-side — a server fault, check the log |

The first three are a normal state for a tenant-scoped token, not a failure,
and must not be retried: an identical request is refused identically. The
database name is **empty** on the list-everything route, because that request
names none.

## What the client tools do

Arc's own tooling distinguishes these and tells you which one you hit, rather
than printing a bare status code:

- **arcli** — `db list` reports that the token is scoped and points at
  `arcli db show <database>` / `arcli measurement list --database <database>`.
  `db show` on a database you lack a grant for says so and names it. See
  [arcli db](/arcli/commands/db/).
- **Arc Launchpad** — connects with an instance **admin** token, which takes
  the break-glass path above, so the console is unaffected by scoping. A
  read-scoped instance token is not supported. See
  [Connecting to Arc](/launchpad/getting-started/connecting-to-arc/).
- **arc-client-python** — raises `ArcScopedAccessError` (carrying the refused
  database), `ArcPermissionError`, or
  `ArcPermissionDataUnavailableError`, so the three cases can be handled
  separately. See [Python SDK](/arc/sdks/python/data-management/#error-handling).
- **VS Code extension** — uses the connection's configured database when Arc
  will not list them, and otherwise says the token is scoped and that a
  database has to be set. See [VS Code](/arc/integrations/vscode/).
- **arc-mcp** — returns a structured "scoped" result telling the model to ask
  which database to use, instead of reporting a tool failure the model would
  retry.

## Best practices

1. **Principle of least privilege** — Start with minimal permissions and expand as needed. Use read-only roles as the default for analytics users.

2. **Use measurement restrictions** — When teams only need access to specific data, restrict by measurement pattern rather than granting full database access.

3. **Use wildcard patterns carefully** — Database pattern `*` grants access to all databases. Use specific patterns when possible.

4. **Pair with audit logging** — Enable [audit logging](/arc-enterprise/security/audit-logging/) to track RBAC changes and access patterns.

5. **Plan your hierarchy** — Design your organization and team structure before implementation. A typical pattern is one organization per company, teams per department or function.

6. **Review grants before adding an existing token to a team** — a token with
   no memberships uses its coarse permissions; the moment it has one, its
   grants become authoritative and a denial is final. That can narrow a token
   an integration is already relying on.

7. **Keep a break-glass admin token outside every team** — a coarse `admin`
   token is allowed regardless of grants, which is what lets you fix a
   misconfigured hierarchy. Putting every admin token into a team removes
   that escape hatch.

## Next steps

- [Audit Logging](/arc-enterprise/security/audit-logging/) — Track all access and changes for compliance
- [Query Governance](/arc-enterprise/query/query-governance/) — Add rate limits and quotas per token
