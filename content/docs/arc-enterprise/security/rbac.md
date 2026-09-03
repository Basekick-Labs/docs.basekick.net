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
- **Backward compatible** — Existing OSS token permissions continue to work

## Prerequisites

- Authentication must be enabled (`ARC_AUTH_ENABLED=true`)
- Arc Enterprise license with RBAC feature

## Permission model

Permissions are defined at the role level and apply to specific databases:

| Permission | Description |
|-----------|-------------|
| `read` | Query data from the database |
| `write` | Write data to the database |
| `delete` | Delete data from the database |
| `admin` | Full administrative access |

Roles can optionally restrict access to specific measurements within a database using wildcard patterns (e.g., `metrics_*` matches `metrics_cpu`, `metrics_memory`, etc.).

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

## Best practices

1. **Principle of least privilege** — Start with minimal permissions and expand as needed. Use read-only roles as the default for analytics users.

2. **Use measurement restrictions** — When teams only need access to specific data, restrict by measurement pattern rather than granting full database access.

3. **Use wildcard patterns carefully** — Database pattern `*` grants access to all databases. Use specific patterns when possible.

4. **Pair with audit logging** — Enable [audit logging](/arc-enterprise/security/audit-logging/) to track RBAC changes and access patterns.

5. **Plan your hierarchy** — Design your organization and team structure before implementation. A typical pattern is one organization per company, teams per department or function.

## Next steps

- [Audit Logging](/arc-enterprise/security/audit-logging/) — Track all access and changes for compliance
- [Query Governance](/arc-enterprise/query/query-governance/) — Add rate limits and quotas per token
