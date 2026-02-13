---
sidebar_position: 1
---

# Role-Based Access Control (RBAC)

Manage access to your Arc deployment with organizations, teams, and granular permissions down to the measurement level.

## Overview

Arc Enterprise RBAC builds on top of Arc's token-based authentication to add organizational structure and fine-grained permissions:

```
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
- **Backward compatible** — Existing OSS token permissions continue to work

## Prerequisites

- Authentication must be enabled (`ARC_AUTH_ENABLED=true`)
- Arc Enterprise license with RBAC feature

## Permission Model

Permissions are defined at the role level and apply to specific databases:

| Permission | Description |
|-----------|-------------|
| `read` | Query data from the database |
| `write` | Write data to the database |
| `delete` | Delete data from the database |
| `admin` | Full administrative access |

Roles can optionally restrict access to specific measurements within a database using wildcard patterns (e.g., `metrics_*` matches `metrics_cpu`, `metrics_memory`, etc.).

## API Reference

All RBAC endpoints require admin authentication.

### Organizations

#### Create Organization

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

#### List Organizations

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/organizations
```

#### Get Organization

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/organizations/1
```

#### Update Organization

```bash
curl -X PATCH http://localhost:8000/api/v1/rbac/organizations/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'
```

#### Delete Organization

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/organizations/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Teams

#### Create Team

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

#### List Teams

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/organizations/1/teams
```

#### Get Team

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/teams/1
```

#### Update Team

```bash
curl -X PATCH http://localhost:8000/api/v1/rbac/teams/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated team description"}'
```

#### Delete Team

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/teams/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Roles

#### Create Role

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

:::tip Database Wildcards
Use `*` as the database pattern to grant permissions across all databases. For example, `"database_pattern": "*"` with `"permissions": ["read"]` grants read access to every database.
:::

#### List Roles

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/teams/1/roles
```

#### Get Role

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/roles/1
```

#### Update Role

```bash
curl -X PATCH http://localhost:8000/api/v1/rbac/roles/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissions": ["read", "write", "delete"]}'
```

#### Delete Role

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/roles/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Measurement Permissions

Restrict a role to specific measurements within its database pattern.

#### Add Measurement Permission

```bash
curl -X POST http://localhost:8000/api/v1/rbac/roles/1/measurements \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "measurement_pattern": "metrics_*"
  }'
```

#### List Measurement Permissions

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/rbac/roles/1/measurements
```

#### Remove Measurement Permission

```bash
curl -X DELETE http://localhost:8000/api/v1/rbac/roles/1/measurements/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Walkthrough: Setting Up RBAC

This example sets up a typical organization with two teams and different access levels.

### Step 1: Create the Organization

```bash
curl -X POST http://localhost:8000/api/v1/rbac/organizations \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'
```

### Step 2: Create Teams

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

### Step 3: Create Roles

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

### Step 4: Restrict Measurements (Optional)

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

## Best Practices

1. **Principle of least privilege** — Start with minimal permissions and expand as needed. Use read-only roles as the default for analytics users.

2. **Use measurement restrictions** — When teams only need access to specific data, restrict by measurement pattern rather than granting full database access.

3. **Use wildcard patterns carefully** — Database pattern `*` grants access to all databases. Use specific patterns when possible.

4. **Pair with audit logging** — Enable [audit logging](/arc-enterprise/audit-logging) to track RBAC changes and access patterns.

5. **Plan your hierarchy** — Design your organization and team structure before implementation. A typical pattern is one organization per company, teams per department or function.

## Next Steps

- [Audit Logging](/arc-enterprise/audit-logging) — Track all access and changes for compliance
- [Query Governance](/arc-enterprise/query-governance) — Add rate limits and quotas per token
