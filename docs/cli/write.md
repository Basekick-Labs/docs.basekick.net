---
sidebar_position: 4
---

# Writing Line Protocol

`arcctl write` POSTs line-protocol records to Arc's `/api/v1/write/line-protocol` endpoint. Body is streamed — large files / pipes never buffer in memory — so `cat huge.lp | arcctl write` works at line-rate.

## Quick reference

```bash
# Stdin pipe — most common in CI / log forwarders / quick experiments
echo "cpu,host=server-1 value=42.5 $(date +%s)000000000" | arcctl write

# From a file
arcctl write -f payload.lp --database metrics

# Explicit precision (default is nanoseconds)
echo "cpu v=1 1700000000" | arcctl write --precision s
```

## Input

`arcctl write` reads its body from one of:

1. **`-f file.lp` flag** — opens the file with `os.Open` and streams it through to the POST body. The file handle is closed when the write completes.
2. **Stdin** — used when `-f` is not given. No buffering; bytes flow through as they arrive.

Unlike `arcctl query`, `arcctl write` does **not** error on an empty TTY stdin — typing line protocol interactively is a (rare) supported workflow. An empty body is accepted by the server as a no-op (`OK`, exit 0).

## Line protocol

Arc accepts the standard InfluxDB line protocol:

```
<measurement>,<tag1>=<value>,<tag2>=<value> <field1>=<value>,<field2>=<value> <timestamp>
```

- **Measurement** — required, the "table" name in Arc
- **Tags** — optional, comma-separated key=value pairs (string-only, schemas inferred)
- **Fields** — required, at least one numeric/string/bool value
- **Timestamp** — optional; if omitted, Arc applies wall-clock-at-receive

Example:

```
cpu,host=server-1,region=us-east value=42.5,temp=68.0 1700000000000000000
mem,host=server-1 used=8.5,total=16.0 1700000000000000000
```

## Precision

`--precision` tells the server how to interpret bare-integer timestamps:

| Value | Unit |
|---|---|
| `ns` (default) | nanoseconds since epoch |
| `us` | microseconds |
| `ms` | milliseconds |
| `s` | seconds |

```bash
echo "cpu v=1 1700000000" | arcctl write --precision s
echo "cpu v=1 1700000000000" | arcctl write --precision ms
```

`arcctl` validates the precision flag client-side before the request goes out, so a typo like `--precision furlong` fails fast:

```
$ arcctl write --precision furlong < x.lp
Error: invalid --precision "furlong" (must be one of ns, us, ms, s)
```

## Database selection

The default database comes from the active connection's `default_database`. Override per-call:

```bash
arcctl write -f payload.lp --database metrics
```

If neither the connection default nor `--database` is set, Arc applies its own server-side default (`default`).

## Streaming behavior

`arcctl write` does NOT buffer the body. This matters for:

- **Large files** — `arcctl write -f /var/log/lp/all-day.lp` streams without loading the file into RAM.
- **Continuous pipes** — `tail -F app.log | parser | arcctl write` keeps memory flat while ingesting at line-rate.
- **HTTP timeout** — `--timeout` applies to the **whole request**. A 10 GB file + the default 60s timeout will time out before completion. For large writes, raise `--timeout`:

```bash
arcctl write -f huge.lp --timeout 30m
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Server returned 204 No Content (success) |
| 1 | Any failure: bad flags, network error, server error (4xx/5xx) |

On success, `arcctl write` prints `OK` to stdout. On failure, the server's error message is surfaced:

```bash
$ echo "garbage" | arcctl write
Error: arc: malformed line at offset 0 (HTTP 400)
```

## Common patterns

### Backfill from a file

```bash
arcctl write -f historical.lp --database backfill --precision ms
```

### Continuous ingestion from a log tail

```bash
tail -F /var/log/app.log | \
  awk '{ printf("log,host=%s msg=\"%s\" %d000000000\n", "myhost", $0, systime()) }' | \
  arcctl write --database logs
```

### Ad-hoc connection (no profile)

```bash
echo "metric v=1" | arcctl write \
  --endpoint https://arc.staging.example.com \
  --token YOUR-TOKEN \
  --database metrics
```

### CI-friendly with env vars

```bash
ARC_ENDPOINT=https://arc.x.example.com ARC_TOKEN=YOUR-TOKEN \
  arcctl write -f payload.lp --database metrics
```

See [Connection management](/arc/cli/connections#precedence) for the full precedence rules.
