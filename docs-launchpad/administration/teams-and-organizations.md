---
sidebar_position: 1
---

# Teams & organizations

Launchpad is multi-tenant: users belong to **organizations**, and connections (Arc servers) are shared within an organization. This lets a team share access to the same instances with role-based permissions.

![Launchpad organizations](/img/launchpad/launchpad-teams-orgs.png)

## Organizations

An **organization** is a tenant: a group of members who share a set of Arc connections. The first admin gets a personal organization automatically; you can create more from the **Orgs** page.

- **Create organization**: give it a name; you become the owner. You can invite a different owner from the org's member list afterward.
- **All organizations**: each org lists its members, their roles, and how many instances it holds.

Switch the active organization from the selector at the top of the sidebar. Connections and console access are scoped to the active org.

## Members and roles

Invite people into an organization from its card: enter an email, pick a role, and send the invite.

| Role | Can do |
|---|---|
| **Owner** | Full control of the organization, including members and connections. |
| **Member** | Access the org's instances per the operations they're allowed. |

Read-only members can query and explore; admins get the operational surface (tokens, retention, alerts, and the other admin-gated tabs). What a member can actually do on a given Arc instance also depends on the **token** registered for that connection; see [Connecting to Arc](/launchpad/getting-started/connecting-to-arc#getting-the-arc-admin-token).

![Launchpad team management](/img/launchpad/launchpad-team.png)

## Platform users & super-admins

The **Platform users** section (Orgs page) manages accounts across the whole deployment:

- **Invite a new user by email**: a personal organization is created for the new user on acceptance.
- **Super-admin**: super-admins can manage all organizations, not just their own. Grant this only to operators who should see everything.

## Signup and invitations

The **first account you create becomes the admin.** After that, self-service signup is closed by default; additional users join **by invitation only**. It's your deployment; you decide who's in it.

Invitations are delivered by email if you've configured a provider (Mailgun or SMTP). Without one, invitation links are printed to the server console instead; copy them from the logs and share them directly. See [First-run setup](/launchpad/getting-started/first-run-setup#configure-email-optional).

## Authentication

Launchpad uses local authentication, with no external identity provider required:

- **Email + password**: bcrypt-hashed, with strength requirements.
- **MFA (TOTP)**: optional time-based one-time-password second factor.
- **Passkeys (WebAuthn)**: optional passwordless / hardware-key sign-in.
- **Google OAuth**: optional, if you configure `GOOGLE_CLIENT_ID` / secret.

Auth endpoints (signup, login, reset) are rate-limited. Manage your own MFA and passkeys from **Settings**.

:::note Passkeys need a correct base URL
WebAuthn is bound to an origin. Make sure `LAUNCHPAD_BASE_URL` matches the URL users actually visit, or passkey registration/authentication will fail. See [Configuration](/launchpad/administration/configuration).
:::
