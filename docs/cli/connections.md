---
sidebar_position: 2
---

# Connection Management

`arcctl` stores connection profiles in `~/.arcctl/config.toml` (mode 0600 — plaintext tokens, same posture as `~/.aws/credentials`). One profile is marked active and used by default; you can override per-command via flags or env vars.

The model is deliberately the same as the InfluxDB v2 CLI's `influx config`, so operators coming from InfluxDB get the same UX.

## Adding a connection

```bash
arcctl config create \
  --name local \
  --endpoint http://localhost:8000 \
  --token YOUR-TOKEN
```

Flags:

| Flag | Required | Description |
|---|---|---|
| `--name` | yes | Profile name (used by `--connection` and `set-active`) |
| `--endpoint` | yes | Arc HTTP base URL — no trailing slash |
| `--token` | yes | Bearer token from Arc's first-run banner |
| `--default-database` | no | Default database for query/write commands |
| `--insecure` | no | Skip TLS verification for this connection |
| `--activate` | no | Make this the active connection |

The first connection you create is auto-activated (saves you one command on first run). Subsequent ones require `--activate` to take over.

## Switching active connection

```bash
arcctl config set-active prod
```

Errors cleanly if the named connection does not exist.

## Listing connections

```bash
$ arcctl config list
┌────────┬─────────┬─────────────────────────────┬─────────┬────────────┐
│ ACTIVE │  NAME   │          ENDPOINT           │  TOKEN  │ DEFAULT_DB │
├────────┼─────────┼─────────────────────────────┼─────────┼────────────┤
│ *      │ prod    │ https://arc.prod.example…   │ abc…xyz │ metrics    │
│        │ local   │ http://localhost:8000       │ dev…123 │ -          │
└────────┴─────────┴─────────────────────────────┴─────────┴────────────┘
```

Tokens are redacted to `first4...last4`; tokens shorter than 12 chars are fully replaced with `*`.

## Inspecting the active connection

```bash
$ arcctl config current
name:             prod
endpoint:         https://arc.prod.example.com
token:            abc…xyz
default_database: metrics
```

## Removing a connection

```bash
arcctl config delete staging
# Delete connection "staging"? [y/N] y
# Deleted connection "staging"
```

Pass `--yes` (or `-y`) to skip the confirmation prompt. If you delete the currently-active profile, the active pointer is cleared so the next command produces a clear "no active connection" error rather than silently falling back to an unrelated profile.

## Per-command overrides

Every command (`query`, `write`, future `db`, `import`, etc.) accepts the same connection overrides:

```bash
# Use a named profile other than the active one
arcctl --connection prod query "SELECT count(*) FROM cpu"

# Full ad-hoc — both flags must be set together
arcctl query --endpoint https://arc.x.example.com --token YOUR-TOKEN "SELECT 1"

# Env var, named profile lookup
ARC_CONNECTION=prod arcctl query "SELECT 1"

# Env var, full ad-hoc — CI-friendly, no config file needed
ARC_ENDPOINT=https://arc.x.example.com ARC_TOKEN=YOUR-TOKEN arcctl query "SELECT 1"
```

## Precedence

When `arcctl` needs to know which connection to use, it checks these sources in order and uses the first that matches:

1. `--connection NAME` flag
2. `--endpoint URL --token TOKEN` flags (both required together)
3. `ARC_CONNECTION` env var
4. `ARC_ENDPOINT` + `ARC_TOKEN` env vars (both required together)
5. The `active` connection in `~/.arcctl/config.toml`

If none of those is set, the command exits with a clear "no active connection" error rather than guessing.

## Config file location

By default `~/.arcctl/config.toml`. Override via `ARCCTL_CONFIG` env var — useful for tests, CI, or per-environment isolation:

```bash
ARCCTL_CONFIG=/etc/arcctl/prod.toml arcctl query "SELECT 1"
```

The file is written atomically (write to temp + rename) so a crash mid-`config create` never leaves a half-written file.

## TLS

For HTTPS endpoints, certificate verification is on by default. To skip verification (lab or self-signed certs only) use either:

- `--insecure` on a single command, or
- `insecure_tls = true` in the connection profile (set once via `arcctl config create --insecure`)

When verification is skipped, a `WARNING:` line is printed to stderr. The flag is a no-op on `http://` endpoints and the warning is suppressed there.

**Never disable TLS verification against a production endpoint.** It exposes the bearer token to any on-path attacker.

## Security notes

- The config file is mode 0600 (owner read/write only). The parent directory `~/.arcctl/` is mode 0700.
- Tokens are stored plaintext. Same posture as `~/.aws/credentials`.
- `arcctl` never logs the token. Help text, error messages, `config list`, and `config current` all use redaction.
- `arcctl` does not phone home. No telemetry. No update checks.
