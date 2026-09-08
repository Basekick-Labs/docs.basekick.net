---
title: "arcli write"
description: "Write to Arc with arcli write: line protocol from stdin or a file with --precision, a prepared MessagePack document streamed as is, or a JSON document validated and converted to MessagePack first."
---

`arcli write` posts a body to the write endpoint for the format you choose. The body comes from stdin or from `-f FILE`, the database from `--database` or the profile's `default_database`, and the token needs the `write` permission.

## Quick reference

```bash
# Line protocol (default format)
echo "cpu,host=web-1,region=us-east usage=0.63 $(date +%s)000000000" | arcli write --database metrics
arcli write --database metrics -f cpu.lp --precision ms

# A JSON document, validated locally and sent as MessagePack
echo '{"m":"cpu","columns":{"time":[1757203380000000],"host":["web-4"],"usage":[0.39]}}' \
  | arcli write --database metrics --format json

# A MessagePack file (optionally gzip or zstd compressed), streamed unchanged
arcli write --database metrics --format msgpack -f batch.msgpack
```

```text
$ arcli write --database metrics -f cpu.lp
OK
$ echo '{"m":"cpu","columns":{...}}' | arcli write --database metrics --format json
OK: 1 measurement(s), 1 row(s), 75 bytes as MessagePack
```

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | target database (defaults to connection's default_database) |  |
| `-f`, `--file` `string` | read the body from a file instead of stdin |  |
| `--format` `string` | input format: lp\|msgpack\|json | `"lp"` |
| `--precision` `string` | line-protocol timestamp precision: ns\|us\|ms\|s (default: server-side default = ns) |  |

Plus the [connection flags](/arcli/reference/connections/#per-command-flags).

## Line protocol

The default. Each line is `measurement,tag=value field=value timestamp`; the body is streamed to `POST /api/v1/write/line-protocol` as read, so a large file is not held in memory. `--precision ns|us|ms|s` tells the server the unit of the timestamps; without it the server applies its default (nanoseconds). An empty body is rejected by the server (`Error: arc: Empty request body (HTTP 400)`).

## MessagePack

`--format msgpack` sends a prepared MessagePack document to `POST /api/v1/write/msgpack` exactly as given. Arc accepts three shapes:

- **Columnar**: `{"m": "cpu", "columns": {"time": [...], "host": [...], "usage": [...]}}`. Fastest, but every column is a field: it carries no tag metadata.
- **Row**: `{"m": "cpu", "t": <time>, "h": "web-1", "fields": {...}, "tags": {...}}`. Tags stay tags (so compaction can de-duplicate); `h` defaults to `unknown` server-side.
- **Batch**: `{"batch": [ <row or columnar items> ]}`.

A file is sent with its exact length; stdin is streamed chunked, up to the server's 1 GiB limit. Gzip and zstd bodies pass straight through, since the server sniffs the magic bytes. Timestamps carry their own unit, inferred from their magnitude, so `--precision` is rejected with this format. arcli checks only the first byte (a MessagePack map or array, or a compression header) and refuses a text file with a clear message.

<Callout type="warn" title="Arc drops undecodable batch items silently">
When one item in a `batch` or array fails to decode, the server skips it and still answers 204. For hand-written documents use `--format json`, which rejects such mistakes before anything is sent.
</Callout>

## JSON

`--format json` reads the same document as JSON, validates it, converts it to MessagePack in memory and posts that. The validation covers what the server would reject and what it would fail on later or drop silently: ragged or empty columns, a column mixing types, integers beyond int64, a `time` column mixing units, nested values, the unsupported compact `f` array. Integer literals become int64 (a column mixing integers and floats is promoted to float64); tags may be strings, numbers or booleans. The document is capped at 64 MiB because the conversion holds several copies; use MessagePack for bulk data. `--precision` is rejected here too.

## Bulk loads

For files of any size, or for CSV, Parquet and TLE, use [arcli import](/arcli/commands/import/): it uploads the file to Arc's import endpoints, which parse server-side and report rows and partitions written.
