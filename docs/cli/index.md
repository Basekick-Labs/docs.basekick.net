---
sidebar_position: 1
---

# arcctl

`arcctl` is the operator-facing CLI for Arc. It replaces hand-crafted `curl` calls with a familiar workflow modeled on `influx`, `kubectl`, and `clickhouse-client`.

```bash
# Add a connection profile
arcctl config create --name local --endpoint http://localhost:8000 --token YOUR-TOKEN

# Run a query
arcctl query "SELECT count(*) FROM cpu"

# Write line protocol
echo "cpu,host=server-1 value=42.5 $(date +%s)000000000" | arcctl write
```

## Why arcctl

Operating Arc without arcctl means:

- Reading the bootstrap token from a stderr banner once, then copying it into every `curl` (or losing it and forcing a restart with `ARC_AUTH_FORCE_BOOTSTRAP=true`).
- Building JSON query bodies by hand, setting `Authorization: Bearer`, remembering the `x-arc-database` header.
- Decoding `{"columns":[...],"data":[...]}` responses by eye.
- Juggling endpoints and tokens across dev / staging / prod via shell-var swaps.

`arcctl` handles all of that and adds named connection profiles, multiple output formats (table, JSON, CSV, Arrow IPC), file/stdin input for both query and write, and consistent error messages.

## Status

| Version | Surface |
|---|---|
| v0.1.0 (PR1) | `config` subcommand tree, multi-connection store at `~/.arcctl/config.toml` |
| v0.2.0 (PR2) | `query`, `write` — table / JSON / CSV / Arrow IPC output, stdin / file input |
| v0.3.0+ | `db`, `import`, `auth`, `cluster` subcommands (in development) |
| v1.0.0 | release workflow + Homebrew tap + multi-arch Docker |

## Compatibility

`arcctl` 0.x and 1.x talk to Arc 26.06 or newer. Arc < 26.06 lacks the Phase A cluster auth replication that makes token admin behave consistently across nodes; an older Arc server may work for `query`/`write` but is not supported.

## Installation

Pre-built binaries land in v1.0. For now, build from source:

```bash
git clone https://github.com/Basekick-Labs/arcctl
cd arcctl
go build -o arcctl ./cmd/arcctl
./arcctl --version
```

Requires Go 1.25+.

## Next

- [Connection management](/arc/cli/connections) — adding, switching, and overriding connection profiles
- [Querying](/arc/cli/query) — running SQL with table / JSON / CSV / Arrow output
- [Writing line protocol](/arc/cli/write) — stdin and file ingestion with precision control
