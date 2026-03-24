---
sidebar_position: 5
---

# Team & Organization Management

Manage teams, roles, and permissions in Arc Cloud -- invite members, assign roles, and control access to your instances.

## Organization Model

Every Arc Cloud account belongs to one or more **organizations**. An organization is the top-level container for:

- **Instances**: All Arc Cloud database instances
- **Members**: Users who can access the organization's resources
- **Billing**: Subscription plans and payment methods
- **Settings**: Organization-wide configuration

When you sign up, Arc Cloud creates a default organization with you as the owner.

### Key Concepts

- A **user** can belong to multiple organizations (e.g., personal projects and company)
- Each **instance** belongs to exactly one organization
- **Roles** determine what a member can do within the organization
- **Billing** is managed at the organization level, not per-user

## Roles and Permissions

Arc Cloud defines four roles with increasing levels of access:

### Role Summary

| Role | Description |
|------|-------------|
| **Owner** | Full control over the organization, billing, and all resources |
| **Admin** | Manage instances, invite members, view billing |
| **Member** | Use instances (query, ingest, manage databases) |
| **Viewer** | Read-only access to instances (query only) |

### Permissions Table

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| Query instances | Yes | Yes | Yes | Yes |
| View dashboards | Yes | Yes | Yes | Yes |
| Ingest data | Yes | Yes | Yes | No |
| Create databases | Yes | Yes | Yes | No |
| Manage retention policies | Yes | Yes | Yes | No |
| Manage continuous queries | Yes | Yes | Yes | No |
| Create instances | Yes | Yes | No | No |
| Delete instances | Yes | Yes | No | No |
| Invite members | Yes | Yes | No | No |
| Remove members | Yes | Yes | No | No |
| Change member roles | Yes | Yes | No | No |
| View billing & invoices | Yes | Yes | No | No |
| Update payment method | Yes | Yes | No | No |
| Change plan tier | Yes | Yes | No | No |
| Transfer ownership | Yes | No | No | No |
| Delete organization | Yes | No | No | No |

## Inviting Team Members

### From the Dashboard

1. Go to [cloud.arc.basekick.net](https://cloud.arc.basekick.net) and select your organization
2. Navigate to **Settings** > **Team**
3. Click **Invite Member**
4. Enter the email address and select a role
5. Click **Send Invite**

The invited user receives an email with a link to join your organization. If they do not have an Arc Cloud account, they will be prompted to create one.

### Invite Behavior

- Invitations expire after **7 days**
- A user can be re-invited if the invitation expires
- The invited user sees the organization in their dashboard after accepting
- You can cancel a pending invitation from the Team settings page

## Managing Members

### Changing a Member's Role

1. Go to **Settings** > **Team**
2. Find the member in the list
3. Click the role dropdown next to their name
4. Select the new role

:::caution
Only owners and admins can change roles. Admins cannot promote other members to owner -- only the current owner can transfer ownership.
:::

### Removing a Member

1. Go to **Settings** > **Team**
2. Find the member in the list
3. Click **Remove** next to their name
4. Confirm the removal

Removed members immediately lose access to all instances in the organization. Their API tokens for this organization are revoked.

## Transferring Ownership

The owner role can be transferred to another member of the organization.

1. Go to **Settings** > **Team**
2. Find the member you want to make the new owner
3. Click **Transfer Ownership**
4. Confirm the transfer

:::warning
Ownership transfer is immediate and irreversible from the dashboard. After transfer, you become an admin. Only the new owner can transfer ownership again.
:::

### Requirements for Ownership Transfer

- You must be the current owner
- The target member must already be in the organization
- The target member must have a verified email address

## Multiple Organizations

A single Arc Cloud account can belong to multiple organizations. This is useful for:

- **Agencies** managing multiple client environments
- **Consultants** who work with different teams
- **Developers** who separate personal projects from work

### Switching Organizations

Use the organization switcher in the top-left corner of the dashboard to switch between organizations. Each organization has its own instances, billing, and team.

### Creating a New Organization

1. Click the organization switcher
2. Click **Create Organization**
3. Enter a name for the new organization
4. You become the owner of the new organization

## Best Practices

### Use the Least Privilege Principle

Assign the minimum role needed for each team member:

- **Developers** who need to query and ingest data: **Member**
- **Dashboard viewers** who only need to read data: **Viewer**
- **DevOps/platform engineers** who manage instances: **Admin**
- **Keep Owner limited** to one or two trusted people

### Audit Team Access Regularly

Review your team roster periodically:

- Remove members who have left the company
- Downgrade roles for members who no longer need elevated access
- Verify that the owner is still the right person

### Use Separate Organizations for Isolation

If you need strict isolation between projects (different billing, different teams, no shared access), create separate organizations rather than putting everything in one.

## Next Steps

- [Quickstart](/arc-cloud/getting-started/quickstart) -- Create your first instance
- [Billing & Usage](/arc-cloud/billing) -- Understand pricing and manage your plan
- [Data Ingestion Patterns](/arc-cloud/guides/data-ingestion) -- Start sending data to your instances
