---
title: "arcli auth"
description: "Arc API token lifecycle from arcli: auth whoami, then auth token create, list, show, update, permissions, rotate, revoke and delete, with expiry, the one-time secret, and --save for stored profiles."
---

`arcli auth` is the token lifecycle over `/api/v1/auth`. `whoami` works with any token; everything under `auth token` needs an **admin** token. Tokens are addressed by numeric id or exact name (the id is tried first).

## Quick reference

```bash
arcli auth whoami
arcli auth token create --name grafana --permission read --description "Grafana dashboards"
arcli auth token list
arcli auth token show grafana
arcli auth token update grafana --permission read,write --expires-in 90d
arcli auth token permissions grafana
arcli auth token rotate grafana
arcli auth token revoke grafana
arcli auth token delete grafana
```

## whoami

```text
$ arcli auth whoami
connection:  local
endpoint:    http://localhost:8000
id:          1
name:        admin
description: Initial admin token (set via ARC_AUTH_BOOTSTRAP_TOKEN)
permissions: read,write,delete,admin
enabled:     true
expires:     never
last used:   never
created:     2026-09-08T00:05:05Z
```

The first line names the profile in use, or `(flags)` / `(env)` for an ad-hoc connection.

## token create

```text
$ arcli auth token create --name grafana --permission read --description "Grafana dashboards"
0qEKaNAjm3CDkNt_TDk8jypxITWUZ9jpMzFwxqpmeKE=
Created token "grafana" (id 2). Store the secret securely; it cannot be retrieved again.
```

The secret is the **only** thing on stdout, so `TOKEN=$(arcli auth token create …)` captures it cleanly; the id and the reminder go to stderr. Arc never shows it again. Permissions are `read`, `write`, `delete`, `admin` (repeat the flag or comma-join); omitted, the server applies its default of `read,write`; `--no-permissions` creates a token whose access comes from RBAC rules only (Arc Enterprise). `--expires-in` takes a Go duration (`720h`) or days (`30d`).

| Flag | Description | Default |
|---|---|---|
| `--description` `string` | free-text description |  |
| `--expires-in` `string` | relative expiry: Go duration (24h, 90m) or days (7d) |  |
| `--name` `string` | token name (required, unique) |  |
| `--no-permissions` | grant no OSS permissions (RBAC-only token) |  |
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--permission` `strings` | permission to grant (read\|write\|delete\|admin); repeat or comma-join |  |

## token list, token show, token permissions

```text
$ arcli auth token list
┌────┬─────────┬─────────────────────────┬─────────┬─────────┬──────────────────────┬──────────────────────┐
│ ID │  NAME   │       PERMISSIONS       │ ENABLED │ EXPIRES │      LAST USED       │       CREATED        │
├────┼─────────┼─────────────────────────┼─────────┼─────────┼──────────────────────┼──────────────────────┤
│ 1  │ admin   │ read,write,delete,admin │ true    │ -       │ 2026-09-08T00:05:05Z │ 2026-09-08T00:05:05Z │
│ 2  │ grafana │ read                    │ true    │ -       │ never                │ 2026-09-08T00:05:36Z │
└────┴─────────┴─────────────────────────┴─────────┴─────────┴──────────────────────┴──────────────────────┘
```

`permissions` shows the effective permissions per database and measurement, including any RBAC rules on an Enterprise server:

```text
$ arcli auth token permissions grafana
token:        grafana (id 2)
rbac_enabled: false
┌──────────┬─────────────┬─────────────┬────────┐
│ DATABASE │ MEASUREMENT │ PERMISSIONS │ SOURCE │
├──────────┼─────────────┼─────────────┼────────┤
│ *        │ *           │ read        │ token  │
└──────────┴─────────────┴─────────────┴────────┘
```

None of these ever print a token secret.

## token update

`--permission` **replaces** the whole list; `--description ""` clears the description; `--expires-in` moves the expiry but cannot remove one once set.

| Flag | Description | Default |
|---|---|---|
| `--description` `string` | new description ("" clears) |  |
| `--expires-in` `string` | new relative expiry: Go duration (24h) or days (7d) |  |
| `--name` `string` | new token name |  |
| `--no-permissions` | clear all OSS permissions (RBAC-only token) |  |
| `--permission` `strings` | replacement permission list; repeat or comma-join |  |

## token rotate

```text
$ arcli auth token rotate grafana
Rotate token "grafana" (id 2, read)? The current secret stops working immediately. [y/N] y
9dWkkBPQ0DYuIgqpGNPNjG7ggiZQVCymqYMr3VS_2r4=
Rotated token "grafana" (id 2). Store the new secret securely; it cannot be retrieved again.
```

A new secret for the same id, name and permissions; the old one stops working at once. Revoked or expired tokens cannot be rotated. As with `create`, only the secret is on stdout.

`--save` rotates the token of a **stored profile** and writes the new secret into the config file in one step: it requires a named profile (`-c NAME`, `ARC_CONNECTION` or the active one, not `--endpoint/--token` or `ARC_ENDPOINT/ARC_TOKEN`), confirms through `/api/v1/auth/verify` that the profile's token is the one being rotated, and checks the config directory is writable, all before the rotation; the secret is printed before the file is touched, so a failed write never loses it.

| Flag | Description | Default |
|---|---|---|
| `-o`, `--output` `string` | output format: table\|json | `"table"` |
| `--save` | write the new secret into every config profile that held the old one (own token only) |  |
| `-y`, `--yes` | skip the confirmation prompt |  |

## token revoke, token delete

```text
$ arcli auth token revoke grafana --yes
Revoked token "grafana" (id 2)
$ arcli auth token delete grafana --yes
Deleted token "grafana" (id 2)
```

`revoke` disables the token but keeps its row for the audit trail; Arc has no API to re-enable a revoked token, so treat it as final. `delete` removes the row. Both prompt on stderr unless `--yes`, and both refuse to act on the **last enabled admin token** unless `--force` is given, since that would lock every client out.

| Flag | Description | Default |
|---|---|---|
| `--force` | allow revoking the last enabled admin token |  |
| `-y`, `--yes` | skip the confirmation prompt |  |

All subcommands take the [connection flags](/arcli/reference/connections/#per-command-flags).

<Callout type="idea" title="Least privilege">
Give each consumer its own token with only the permissions it needs and a description that says what it is for. Rotating a compromised dashboard token then touches nothing else, and `token list` tells you which one was last used when.
</Callout>
