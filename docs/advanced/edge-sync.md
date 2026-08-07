---
sidebar_position: 5
---

# Edge Sync

:::info Available in v2026.09.1+
Both sides ship in Arc **v2026.09.1**: register spokes on the hub, enable the spoke on the edge instance, and trigger a sync pass. Passes are **manual** in this release — you decide when one runs. The scheduled agent that runs them automatically is Enterprise and lands in a later release. See the limitations below.
:::

Arc runs at the edge: a single binary with local storage in a vehicle, a factory cell, a mine site, or a forward deployment. **Edge sync** ships the Parquet files it produces to a central Arc — the *hub* — so data collected somewhere with intermittent connectivity ends up somewhere you can query it.

## The model

- A **spoke** is an edge Arc instance. It initiates every transfer; the hub never reaches back into it. That matters because edges usually sit behind NAT with no inbound reachability.
- A **hub** is a central Arc with the receive endpoint enabled.
- The unit of sync is a **file**, not a row. Arc already writes immutable, content-addressed Parquet, so shipping whole files gives end-to-end integrity for free and costs the hub no re-ingestion.

Connectivity is treated as the exception rather than the norm. A transfer interrupted mid-file resumes from a byte offset rather than restarting, and re-delivering a file the hub already holds is a no-op.

## Configuration

```toml
[edge_sync]
enabled = true                 # default false
hub_id = "ground-station"      # required when enabled
max_file_bytes = 536870912     # 512MiB default
max_reconcile_entries = 10000  # ~2MB per discovery batch
```

Environment variables follow the usual pattern: `ARC_EDGE_SYNC_ENABLED`, `ARC_EDGE_SYNC_HUB_ID`, `ARC_EDGE_SYNC_MAX_FILE_BYTES`, `ARC_EDGE_SYNC_MAX_RECONCILE_ENTRIES`.

### `enabled`

Off by default. Enabling it mounts `POST /api/v1/sync/file`, which accepts file writes from registered spokes — so it should be a deliberate decision, not something that appears on upgrade.

### `hub_id`

Names this hub, and is bound into every request's HMAC. A request signed for one hub is rejected at another, even when the spoke legitimately syncs to both and shares a secret with each.

Arc refuses to start if this is empty while `enabled = true`, because an empty value would let a request captured at one hub be replayed at another. It also rejects path separators, NUL bytes, control characters, and values over 128 bytes.

### `max_file_bytes`

Caps a single upload. This is a denial-of-service control rather than a tuning knob: Arc buffers a request body before authentication runs, so without a bound, anyone who can reach the port could pin memory without holding any credential.

It must not exceed `server.max_payload_size` (1GB by default) — the server limit is enforced first, so a larger value would never take effect. Arc refuses to start rather than let you configure a bound that silently does nothing.

### `max_reconcile_entries`

Caps one batch-discovery request. A spoke with a larger backlog sends several requests.

The bound exists for the same reason as `max_file_bytes`: Arc buffers a request body before authentication, so an unbounded batch would be a memory claim by an unauthenticated caller. Capping does not cost the property that matters — discovery is still one request per batch rather than one per file, so 5,000 pending files is a handful of requests instead of 5,000.

A batch above the cap is refused with `413` and the limit, so a spoke knows what to page under.

## Registering a spoke

A hub only accepts files from a spoke it knows about. Registration generates the shared secret:

```bash
curl -X POST https://hub.example.com/api/v1/sync-spokes/ \
  -H "Authorization: Bearer $ARC_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"spoke_id": "rocket-01", "name": "Rocket 07 Telemetry"}'
```

```json
{
  "spoke_id": "rocket-01",
  "name": "Rocket 07 Telemetry",
  "secret": "5db508a4…",
  "warning": "This secret is shown once and cannot be retrieved. Store it now; if it is lost, rotate."
}
```

**Capture the secret from this response.** It is the only time it is readable — the hub stores it encrypted and every later read returns metadata only. If it is lost, rotate rather than trying to recover it.

The `spoke_id` becomes the first path segment of everything that spoke writes, so it cannot contain a path separator, a dot prefix, or a NUL byte.

### Managing spokes

| Endpoint | Effect |
|---|---|
| `GET /api/v1/sync-spokes/` | List spokes with their file and byte counters, and when each last reported in |
| `GET /api/v1/sync-spokes/{id}` | One spoke's metadata — never its secret |
| `POST /api/v1/sync-spokes/{id}/rotate` | Issue a new secret, returned once. The old one stops working **immediately** |
| `POST /api/v1/sync-spokes/{id}/disable` | Cut the spoke off, reversibly. History and counters survive |
| `POST /api/v1/sync-spokes/{id}/enable` | Restore it, no re-provisioning needed |
| `DELETE /api/v1/sync-spokes/{id}` | Remove the registration. Files it already sent are **kept** |

All of these require an admin token, including the read paths: the spoke list is a map of which edge deployments exist and when each last checked in.

:::warning Spoke registration is unauthenticated when `auth.enabled = false`
With Arc's authentication disabled there are no admin tokens, so **anyone who can reach the port can register a spoke and obtain working write credentials** for this hub. That is true of every Arc admin endpoint in that mode, but the consequence is sharper here. A hub logs a warning at startup when this applies. Enable authentication, or restrict network access to the hub.
:::

Registering the same `spoke_id` twice is refused with `409` rather than treated as an update — silently reissuing a secret would lock out a live edge box with no signal.

### `ARC_ENCRYPTION_KEY` is required

Spoke secrets are encrypted at rest using the same key MQTT uses for broker passwords. A hub with `edge_sync.enabled = true` and no `ARC_ENCRYPTION_KEY` **refuses to start**.

There is no plaintext fallback on purpose: the sync database also holds audit logs, and a silent downgrade would leave every spoke's write credential readable to anyone who copied the file.

Encrypted rather than hashed because the hub must *recompute* an HMAC from the secret — unlike an API token, which is only ever checked against a value the caller presents.

## Discovery: one round-trip

`POST /api/v1/sync/reconcile` takes a spoke's pending set and answers which files the hub already holds:

```json
{
  "missing":   ["metrics/cpu/2026/08/07/14/a.parquet"],
  "present":   ["metrics/cpu/2026/08/07/14/b.parquet"],
  "conflicts": [{"path": "…/c.parquet", "their_sha256": "…"}]
}
```

- **`missing`** — send these.
- **`present`** — the hub already has this exact content. This is the lost-acknowledgment path: a transfer that completed but whose acknowledgment never arrived is discovered here in bulk, and the spoke advances without re-sending a byte.
- **`conflicts`** — the hub holds that path with *different* content. Surfaced for the whole backlog at once rather than discovered one `409` at a time during transfer.

The answer comes from a hub-side index of received files, not from reading Parquet, so it costs the same whether the hub holds a thousand files or a million.

## How a transfer is handled

1. The request is authenticated twice: an Arc API token, then a per-spoke HMAC binding the spoke, the hub, the path, and the content digest.
2. Bytes stream into a staging area while Arc hashes them.
3. The hash is compared against the digest the spoke declared.
4. **Only on a match** is the file promoted to its final location.

A mismatch is discarded at step 4, so corrupt bytes never appear where a reader would find them.

Files are stored under the spoke's namespace — `{spoke_id}/{original path}` — so two edges producing the same measurement for the same hour do not collide. The rewrite happens on the hub, so a spoke stays unaware of it and can sync to several hubs unmodified.

## Response codes

| Code | Meaning | What the spoke does |
|---|---|---|
| `200` | Committed, or already present with identical content | Marks it synced |
| `206` | Partial — the body ended early | Resumes from the returned offset |
| `409` | Same path, **different** content | Stops and raises an alarm; never retries |
| `413` | Above `max_file_bytes` | Configuration problem, not transient |
| `422` | Checksum mismatch; the upload was discarded | Retries from its own copy |
| `401` | Authentication failed | Checks its secret, and its clock |
| `503` | Hub-side failure, e.g. a manifest write during a Raft election | Retries later |

A `409` is deliberately not retryable. It means either two spokes are writing the same namespaced path or one side's bytes are corrupt — both need a human, and overwriting would destroy whichever copy is correct.

## Storage backend support

| | Local | S3 / Azure |
|---|---|---|
| Verify before commit | Yes | Yes |
| Byte-offset resume | Yes | **No** — restarts from zero |

Object storage cannot append to a block object, so a dropped transfer starts over. That is a throughput cost, not a correctness problem, and it only bites when a connectivity window is shorter than a single file transfer.

If you run a hub on object storage over intermittent links, lower [`compaction.max_files_per_batch`](./compaction.md#files-per-batch) on the **spokes** so individual files stay small enough to cross a window.

## Current limitations

- **Passes are manual.** A pass runs when you trigger one, via `POST /api/v1/spoke-sync/run` or a scheduler of your own (cron, a systemd timer, a link-up hook). The built-in scheduled agent is Enterprise and not in this release.
- **Uploads are buffered, not streamed.** A transfer is bounded by `max_file_bytes` and held in memory for its duration.
- **Abandoned partial uploads are not swept automatically.** The mechanism exists but is not yet scheduled, so a spoke that abandons transfers leaves staging files behind.
- **Deleting a synced file from hub storage is reconciled lazily.** Reconcile confirms that files its index claims are still in storage, and forgets the ones that are gone, so a spoke re-sends them on the next pass. Note that a retention policy whose database matches a spoke's namespace **will** delete that spoke's files — the namespace is the spoke ID, and retention operates on whatever database name it is given.
- **Hub-side corruption after commit is not detected by reconcile.** Files are verified before they are committed, but reconcile then answers from the index rather than re-hashing storage — re-reading every received file on every pass is exactly the cost the index exists to avoid. Corruption at rest is a storage-integrity concern, not a sync one.

## The spoke side

A spoke is an edge Arc instance that pushes its files to a hub. Enable it in `arc.toml`:

```toml
[edge_sync.spoke]
enabled = true                        # default false
hub_url = "https://hub.example.com"   # required when enabled
spoke_id = "rocket-01"                # this spoke's ID, as registered on the hub
hub_id = "ground-station"             # the REMOTE hub's edge_sync.hub_id
max_attempts = 5                      # attempts before a file is marked failed
max_concurrent = 2                    # simultaneous transfers
batch_size = 0                        # files per reconcile round-trip; 0 = hub default
```

The secret goes in the environment, never the file:

```bash
export ARC_EDGE_SYNC_SPOKE_SECRET="<the secret the hub returned at registration>"
```

Arc **refuses to start** if a secret appears in the config file. One that is ignored still leaks, and leaving it in place makes the committed copy — the one that gets backed up and committed to a repo — look load-bearing.

`hub_id` must match the hub's own `edge_sync.hub_id` exactly. It is bound into every request MAC, so a mismatch fails *every* request with a `400` that looks like a hub problem; Arc validates it at startup instead of letting you discover it during a contact window.

### Running a pass

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/spoke-sync/run` | Run one pass and return what it did |
| `GET /api/v1/spoke-sync/status` | Pending/synced/failed counts, and sync lag |
| `GET /api/v1/spoke-sync/ledger` | Per-file state, attempts, and last error |

All three require an admin token: triggering a pass moves data off the box and spends whatever link budget it has.

```bash
curl -X POST https://edge.local:8000/api/v1/spoke-sync/run \
  -H "Authorization: Bearer $ARC_TOKEN"
```

```json
{
  "discovered": 20,
  "recovered": 0,
  "already_present": 0,
  "sent": 20,
  "bytes_sent": 22015,
  "partial": 0,
  "failed": 0,
  "conflicts": [],
  "duration_ms": 19
}
```

A pass recovers transfers interrupted by a crash, discovers new files, reconciles the backlog in one round-trip, then streams what the hub lacks — **newest first**, so a contact window that closes mid-backlog has already delivered the freshest telemetry. It **pages until the backlog drains**: one pass on a spoke returning from a long outage moves everything, not just the first `batch_size` files.

Files are hashed once at discovery and the ledger is on disk, so a spoke restarted mid-backlog neither re-hashes nor re-sends what already landed. **Nothing is deleted from the spoke** — sync is a copy, and local retention stays yours to configure.

### Reading the results

`conflicts` is reported in full rather than counted, because each one needs a decision about which copy is right:

```json
{
  "sent": 0,
  "conflicts": [
    {"path": "default/cpu/2026/08/07/18/cpu_001.parquet", "their_sha256": "04ed50c9…"}
  ],
  "warning": "Some paths hold different content on the hub. These are not retried; investigate before re-syncing."
}
```

Conflicts are never retried and never overwrite: the same path holding different content means a spoke-ID collision or corruption, and re-sending would either be refused or destroy the evidence.

For anything stuck, `GET /api/v1/spoke-sync/ledger` shows attempt counts and the last error per file, so you do not have to open the SQLite database to answer "why is this not syncing?".

### Scheduling it yourself

Until the Enterprise scheduled agent ships, a timer is enough:

```bash
# Every 15 minutes, and on link-up.
*/15 * * * * curl -fsS -X POST http://127.0.0.1:8000/api/v1/spoke-sync/run \
  -H "Authorization: Bearer $ARC_TOKEN" >> /var/log/arc-sync.log 2>&1
```

A pass is safe to trigger concurrently with ingest and safe to re-run — one that finds nothing to do returns immediately.
