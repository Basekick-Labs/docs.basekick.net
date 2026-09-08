---
title: "Connections and the config file"
description: "How arcli picks the Arc server: the ~/.arcli/config.toml format and modes, precedence of --connection, --endpoint/--token, ARC_CONNECTION and ARC_ENDPOINT/ARC_TOKEN, config commands, TLS and timeouts."
---

Every arcli command that talks to a server resolves one connection: an endpoint, a token, and optionally a default database and a TLS setting. This page is the reference for where those come from.

## The config file

`~/.arcli/config.toml`, created with mode `0600` in a `0700` directory the first time you save a profile. `ARCLI_CONFIG=/path/to/file.toml` points arcli at another file (useful in CI and tests). The file is the only thing arcli ever writes.

```toml
active = "local"
installation_id = "49ae95aa-997f-41ba-89e7-cb0f848e1cec"

[connections.local]
endpoint = "http://localhost:8000"
token = "devtoken-devtoken-devtoken-devtoken-0000"
default_database = "metrics"

[connections.prod]
endpoint = "https://arc.prod.example.com"
token = "3f8a…c91e"
insecure_tls = false
```

Tokens are stored in plain text, the same posture as `~/.aws/credentials`; the file mode is the protection. `installation_id` is explained in [Privacy](/arcli/reference/privacy/). Edit the file by hand if you like; arcli rewrites it atomically (temp file plus rename) so a crash never leaves it half-written.

## Precedence

Highest first. The first source that is present wins; nothing falls through past the active profile:

| Source | Example |
|---|---|
| 1. `--connection NAME` (`-c`) | `arcli query -c prod "…"` |
| 2. `--endpoint URL --token T` | ad-hoc, no profile involved |
| 3. `ARC_CONNECTION=NAME` | a profile from the config file |
| 4. `ARC_ENDPOINT=URL` + `ARC_TOKEN=T` | ad-hoc from the environment |
| 5. `active` in the config file | the default |

Pairs are all-or-nothing: `--endpoint` without `--token`, or `ARC_ENDPOINT` without `ARC_TOKEN`, is an error, never a silent fall-through to the active profile. A `-c` or `ARC_CONNECTION` naming a profile that does not exist is an error too. With no profile and nothing in the environment, every command says so and points at `arcli config create … --activate`.

Commands print the resolved connection where it matters (`ping`, `auth whoami`); an ad-hoc one shows as `(flags)` or `(env)`.

## The database

`--database` on the command, else the profile's `default_database`, else the server's own default database (`default`). `measurement list` and `import` require one and error before any request if none resolves.

## Per-command flags

Every command that reaches a server takes these; command pages refer here rather than repeating them:

| Flag | Description | Default |
|---|---|---|
| `-c`, `--connection` `string` | named connection (overrides active) | |
| `--endpoint` `string` | ad-hoc Arc endpoint URL (with `--token`) | |
| `--token` `string` | ad-hoc bearer token (with `--endpoint`) | |
| `--insecure` | skip TLS certificate verification (logs a warning to stderr) | |
| `--timeout` `duration` | per-request HTTP timeout | `1m0s` (`30m0s` for `delete` and `retention execute`, `10m0s` for `cq execute`) |

`config` subcommands take none of these, and no `-o` either: they only touch the file and always print a table or a line of text.

## TLS

Certificate verification is on for `https://` endpoints. To skip it for a lab server with a self-signed certificate, either pass `--insecure` on the command or store `insecure_tls = true` in the profile (`config create --insecure`, `config update NAME --insecure`, `--insecure=false` to re-enable). Either way arcli prints `WARNING: TLS certificate verification disabled` on stderr before the request. On an `http://` endpoint the flag is a no-op and prints nothing.

## Timeouts and interruption

`--timeout` bounds each HTTP request; the long-running commands have larger defaults (table above), and the `--wait` variants of `backup` and `compaction trigger` have their own `--wait-timeout`. When arcli stops waiting, whether from the timeout or Ctrl-C, the server does not stop: an accepted write, delete, retention run or backup continues there. arcli says so on stderr and exits 1 (timeout) or 130 (interrupt).

## The config commands

| Command | What it does |
|---|---|
| `config create --name N --endpoint URL --token T [--default-database DB] [--insecure] [--activate]` | Add a profile. The first one becomes active automatically. `--token-stdin` reads the token from a pipe instead. |
| `config list` | Table of profiles, active one starred, tokens redacted (`devt...0000`). |
| `config current` | The active profile in full (token redacted) and the installation id. |
| `config set-active N` | Change the default. |
| `config update N [--endpoint …] [--token … \| --token-stdin] [--default-database …] [--insecure[=false]]` | Change fields; `--default-database ""` clears it. |
| `config delete N` | Remove a profile; prompts, `--yes` to skip (see [prompts](/arcli/reference/output/#confirmation-prompts) for the non-terminal behaviour). |

Redaction shows the first and last four characters of a token; anything shorter than twelve characters is shown as twelve asterisks.
