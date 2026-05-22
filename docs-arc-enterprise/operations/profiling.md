---
sidebar_position: 3
---

# Profiling with pprof

Arc exposes Go's built-in `net/http/pprof` profiler — heap, goroutine, CPU, allocations, blocking, mutex, and execution-trace endpoints — for diagnosing memory pressure, hot CPU paths, goroutine leaks, and deadlocks in production. The endpoints are **opt-in** and bound to `localhost` by default; exposing them anywhere else requires a deliberate two-step configuration.

:::info Available since v26.06.1
The opt-in pprof listener ships in Arc v26.06.1 ([PR #443](https://github.com/Basekick-Labs/arc/pull/443), [GHSA-j93g-rp6m-j32m](https://github.com/Basekick-Labs/arc/security/advisories/GHSA-j93g-rp6m-j32m)). Prior versions registered pprof on the public API port without authentication — upgrade and adopt the env-var gate below.
:::

:::danger Production exposure is hostile by default
A reachable `/debug/pprof/*` endpoint leaks process internals: in-flight SQL strings and msgpack records (via heap dumps), goroutine stacks, environment variables on some Go versions, and lets any caller pin a CPU core for arbitrary seconds via `/debug/pprof/profile?seconds=N`. Treat the pprof listener like a root shell — bind to loopback, restrict by firewall, and turn it off when you're done debugging.
:::

## Why pprof Is Off by Default

Pre-v26.06.1, `/debug/pprof/*` was mounted on Arc's public Fiber app — no token, no allowlist. An unauthenticated network caller could fetch heap dumps containing recent query text and ingested records. The hardening PR removed pprof from the public app entirely and moved it to a separate listener that only starts when the `ARC_DEBUG_PPROF` env var is set.

The new design has three properties:

1. **Off by default** — `ARC_DEBUG_PPROF` unset means no socket is opened, no goroutine is spawned, the endpoints don't exist on Arc's process.
2. **Loopback-bound by default** — even with `ARC_DEBUG_PPROF=1`, the listener binds to `127.0.0.1:6060` unless you explicitly override.
3. **Two-step opt-in for non-loopback** — binding to any non-loopback address (`0.0.0.0:6060`, a public IP, etc.) requires both `ARC_DEBUG_PPROF_ADDR` AND `ARC_DEBUG_PPROF_ALLOW_NON_LOOPBACK=1`, so a typo in the bind address can't accidentally expose the endpoint cross-host.

## Configuration

All configuration is via environment variables — pprof is a debugging surface, not a runtime feature, so there's no `[debug]` block in `arc.toml`.

| Variable | Default | Description |
|---|---|---|
| `ARC_DEBUG_PPROF` | unset (off) | Set to `1`, `true`, `yes`, or `on` to enable the pprof listener. Any other value (including unset) leaves it off. |
| `ARC_DEBUG_PPROF_ADDR` | `127.0.0.1:6060` | Bind address for the pprof listener. Accepts any form `net.Listen("tcp", …)` accepts — `127.0.0.1:6060`, `localhost:6060`, `[::1]:6060`, `0.0.0.0:6060`, etc. |
| `ARC_DEBUG_PPROF_ALLOW_NON_LOOPBACK` | unset (off) | Required when `ARC_DEBUG_PPROF_ADDR` is non-loopback. Set to `1`/`true`/`yes`/`on`. Without it, Arc logs an error and refuses to start the pprof listener. |

## Enabling pprof on a Single Node

The common case — investigate a single production node from the same host via SSH and a local port-forward:

```bash
# On the node you want to profile:
ARC_DEBUG_PPROF=1 ./arc
```

Arc emits a startup warning:

```
WARN ARC_DEBUG_PPROF is set — pprof endpoints are exposed on this address.
     Restrict access via firewall or unset ARC_DEBUG_PPROF in production.
     addr=127.0.0.1:6060
```

From your laptop, SSH-tunnel the port:

```bash
ssh -L 6060:127.0.0.1:6060 user@node
```

Then point `go tool pprof` at `localhost:6060` on your laptop. See [Profiling Workflows](#profiling-workflows) below.

### With docker-compose

```yaml
services:
  arc-writer:
    image: basekick/arc:latest
    environment:
      ARC_DEBUG_PPROF: "1"
    # No host port mapping for 6060 — the listener stays inside the container.
    # Use `docker exec` or a sidecar to reach it.
```

To reach the in-container listener:

```bash
docker exec -it arc-writer wget -qO heap.pprof http://127.0.0.1:6060/debug/pprof/heap
docker cp arc-writer:/heap.pprof ./
go tool pprof -http=:8080 heap.pprof
```

### With Kubernetes

```yaml
env:
  - name: ARC_DEBUG_PPROF
    value: "1"
```

Then port-forward:

```bash
kubectl port-forward arc-writer-0 6060:6060
```

`kubectl port-forward` only listens on the local machine, so the pprof endpoint stays loopback-bound on the Arc pod AND on your laptop simultaneously. No cluster-network exposure.

## Exposing pprof Cross-Host (Discouraged)

There are cases where loopback isn't enough — for example, a remote profiler that can't open an SSH tunnel, or a multi-tenant box where the operator workstation isn't on the Arc host. Arc supports this with a deliberate two-step opt-in:

```bash
ARC_DEBUG_PPROF=1 \
ARC_DEBUG_PPROF_ADDR=0.0.0.0:6060 \
ARC_DEBUG_PPROF_ALLOW_NON_LOOPBACK=1 \
./arc
```

Without `ARC_DEBUG_PPROF_ALLOW_NON_LOOPBACK=1`, Arc logs an **error** and refuses to start the pprof listener — the rest of Arc continues to run normally, but pprof stays off:

```
ERROR ARC_DEBUG_PPROF=1 with a non-loopback ARC_DEBUG_PPROF_ADDR requires
      ARC_DEBUG_PPROF_ALLOW_NON_LOOPBACK=1; refusing to start pprof listener
      addr=0.0.0.0:6060
```

When the second opt-in IS set and Arc binds to a non-loopback address, the startup log line is escalated to **error** level (instead of warn) so default alerting policies notice the cross-host exposure on this node:

```
ERROR ARC_DEBUG_PPROF is set — pprof endpoints are exposed on this address.
      Restrict access via firewall or unset ARC_DEBUG_PPROF in production.
      addr=0.0.0.0:6060
```

:::danger Firewall is mandatory in this mode
The pprof listener has no authentication. Anyone who can reach `0.0.0.0:6060` (or whatever address you bound) can fetch heap dumps containing recent query text and ingested records, dump goroutine stacks, and pin CPU cores. Restrict by network ACL, security group, or iptables before turning this on. Unset all three env vars the moment you're done.
:::

## Profiling Workflows

Once the listener is reachable at `http://localhost:6060` (whether direct or via SSH/kubectl port-forward), `go tool pprof` does the rest. The recipes below assume Go 1.20+.

### Heap (Memory)

The most common case — Arc's RSS is high and you want to know what's holding it.

```bash
# Live snapshot:
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap

# Save for later analysis:
curl -o heap.pprof http://localhost:6060/debug/pprof/heap
go tool pprof -http=:8080 heap.pprof
```

The `-http=:8080` flag launches the interactive web UI at `http://localhost:8080` — flame graph, top callers, source view. Without it you get the CLI prompt.

Common starting commands at the pprof CLI prompt:

```
(pprof) top20         # 20 largest in-use allocations by bytes
(pprof) top20 -cum    # 20 largest by cumulative (function + callees)
(pprof) list <func>   # source-level breakdown of one function
```

### CPU Profile

Capture 30 seconds of CPU activity:

```bash
go tool pprof -http=:8080 'http://localhost:6060/debug/pprof/profile?seconds=30'
```

The `seconds` parameter is configurable — 30s is a reasonable default. **Don't go above ~300s** unless you know what you're doing: each in-flight capture holds a connection open and consumes scheduler overhead. Arc's pprof listener has a 10-minute write timeout as the hard ceiling.

### Goroutines

Diagnose a goroutine leak or deadlock:

```bash
# Summary (top goroutine call sites + counts):
curl -s 'http://localhost:6060/debug/pprof/goroutine?debug=1' | head -50

# Full stacks for every goroutine (text):
curl -s 'http://localhost:6060/debug/pprof/goroutine?debug=2' > goroutines.txt

# Or via pprof for the UI:
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/goroutine
```

A healthy idle Arc writer typically has ~50–200 goroutines (Fiber workers, WAL writer, ingest shards, compaction scheduler, Raft loops). Thousands of goroutines stuck on the same `chan receive` or `sync.Mutex.Lock` is the diagnostic signature of a stall.

### Execution Trace

Captures every scheduler event for `N` seconds — useful for diagnosing latency spikes:

```bash
curl -o trace.out 'http://localhost:6060/debug/pprof/trace?seconds=5'
go tool trace -http=:8080 trace.out
```

The trace UI shows per-goroutine timelines, GC pauses, and network/syscall waits. Use sparingly — even 5 seconds of trace produces ~10–50 MB of data on a busy writer.

### Block & Mutex Profiles

By default these profiles are zero-rate (Go runtime samples nothing). To enable, you'd need to call `runtime.SetBlockProfileRate` / `runtime.SetMutexProfileFraction` from inside Arc — currently not exposed via env var. If you need block/mutex profiles, open an issue describing the problem you're chasing and we'll add the knobs.

## Operational Notes

### Startup Logging

When `ARC_DEBUG_PPROF` is unset, Arc emits nothing at startup about pprof. The listener is genuinely absent — no port, no handlers, no log noise.

When set, a single warn-level (loopback) or error-level (non-loopback) line names the bind address and reminds you to restrict access. Grep for `ARC_DEBUG_PPROF is set` in your logs to find nodes that left it on accidentally.

### Shutdown Behavior

Arc registers pprof with the same shutdown priority as the main HTTP server. On `SIGTERM` / `SIGINT`, the pprof listener closes **immediately** — in-flight captures (especially long `/debug/pprof/profile?seconds=N` requests) are aborted. This is deliberate: a long pprof capture would otherwise hold the cluster's shared shutdown budget and risk skipping downstream hooks (WAL flush, storage close, auth close), which is a data-loss path on what the operator expected to be a graceful exit.

If your capture was killed by shutdown, just re-run it after Arc restarts.

### Port Conflicts

If the configured bind address is already in use, Arc logs an **error** and continues without the pprof listener — Arc itself doesn't fail to start. Look for:

```
ERROR ARC_DEBUG_PPROF=1 but failed to bind pprof listener; continuing without pprof
      addr=127.0.0.1:6060 error="listen tcp 127.0.0.1:6060: bind: address already in use"
```

Common causes:
- A previous Arc process didn't release the port (`lsof -nP -iTCP:6060`).
- Another Go service on the host already runs pprof on `:6060` (the Go-runtime convention).
- A non-Arc service grabbed the port.

Resolve the conflict and restart Arc, or set `ARC_DEBUG_PPROF_ADDR` to a different port.

## Security Checklist

Before enabling pprof on a production node:

- [ ] `ARC_DEBUG_PPROF_ADDR` is loopback (default) **or** the host is firewalled to allow only your jumphost / operator workstation.
- [ ] If non-loopback, `ARC_DEBUG_PPROF_ALLOW_NON_LOOPBACK=1` is set deliberately (not by env-var inheritance from a parent process).
- [ ] You have a plan to unset `ARC_DEBUG_PPROF` when the investigation is done — pprof should not be left on indefinitely.
- [ ] On Kubernetes / docker-compose, the pprof port is **not** in the service's port list or compose `ports:` block — only reachable via `kubectl port-forward` or `docker exec`.
- [ ] Heap dumps you save (`heap.pprof`, `goroutines.txt`, `trace.out`) are treated as sensitive: they contain in-flight query text and ingested records. Don't paste them into public issues; share via your team's secure channel.

## Reference

- Source: [`cmd/arc/debug_pprof.go`](https://github.com/Basekick-Labs/arc/blob/main/cmd/arc/debug_pprof.go) — the listener and the two-step gate.
- PR that introduced the gate: [#443](https://github.com/Basekick-Labs/arc/pull/443).
- Advisory: [GHSA-j93g-rp6m-j32m](https://github.com/Basekick-Labs/arc/security/advisories/GHSA-j93g-rp6m-j32m).
- Upstream Go docs: [`net/http/pprof`](https://pkg.go.dev/net/http/pprof) and [`runtime/pprof`](https://pkg.go.dev/runtime/pprof).
