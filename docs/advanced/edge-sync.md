---
sidebar_position: 5
---

# Edge Sync

:::info Available in v2026.09.1+
Both sides ship in Arc **v2026.09.1**, over two transports: a **network** link (spoke pushes to hub) and an **air gap** (a signed bundle carried on removable media, with a receipt on the return leg). Passes are **manual** in this release — you decide when one runs. The scheduled agent that runs them automatically is Enterprise and lands in a later release. See the limitations below.
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

A batch above the cap is refused with `413` and the limit, so a spoke knows what to page under — the spoke's agent reads the limit from the refusal and re-pages under it automatically.

### `staging_sweep_max_age_hours`

How old an abandoned partial upload must be before the hourly sweep reclaims its staging space. Default `72` — deliberately longer than a plausible contact gap, because a staged partial is also the spoke's resume checkpoint, and sweeping it early forces a full re-send on exactly the links resume exists for. `0` disables the sweep.

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

## Querying spoke data on the hub

Each spoke's data appears on the hub as a database named after the spoke. Spoke IDs typically contain hyphens, so quote them:

```sql
SELECT count(*), min(temp), max(temp)
FROM "rocket-01".engine_temp
WHERE time > now() - INTERVAL 1 HOUR;
```

(Requires Arc 26.09.1+ — earlier versions had a query-layer bug where quoted identifiers resolved to nonexistent storage paths and returned zero rows.)

## Response codes

| Code | Meaning | What the spoke does |
|---|---|---|
| `200` | Committed, or already present with identical content | Marks it synced |
| `206` | Partial — the body ended early | Resumes from the returned offset |
| `409` | Same path, **different** content | Stops and raises an alarm; never retries |
| `413` | Above `max_file_bytes` | Configuration problem, not transient |
| `422` | Checksum mismatch; the upload was discarded | Retries from its own copy |
| `401` | Authentication failed | Checks `ARC_EDGE_SYNC_HUB_TOKEN`, then its secret and its clock |
| `503` | Hub-side failure, e.g. a manifest write during a Raft election | Retries later |

A `409` is deliberately not retryable. It means either two spokes are writing the same namespaced path or one side's bytes are corrupt — both need a human, and overwriting would destroy whichever copy is correct.

## Storage backend support

| | Local | S3 / Azure |
|---|---|---|
| Verify before commit | Yes | Yes |
| Byte-offset resume | Yes | **No** — restarts from zero |

Object storage cannot append to a block object, so a dropped transfer starts over. That is a throughput cost, not a correctness problem, and it only bites when a connectivity window is shorter than a single file transfer.

If you run a hub on object storage over intermittent links, lower [`compaction.max_files_per_batch`](./compaction.md#files-per-batch) on the **spokes** so individual files stay small enough to cross a window.

## Network-transport limitations

These apply to the network path described above. The air-gap transport has its own, at the end of this page.

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
batch_size = 1000                     # files per reconcile round-trip; 0 = whole backlog at once
ledger_retention_days = 90            # prune synced/skipped ledger rows; 0 = never
```

A reconcile page the hub refuses as too large (over its `max_reconcile_entries` or its byte limit) is split and retried within the same pass, so no `batch_size` value can leave a backlog undrainable.

Both credentials go in the environment, never the file:

```bash
export ARC_EDGE_SYNC_SPOKE_SECRET="<the secret the hub returned at registration>"
export ARC_EDGE_SYNC_HUB_TOKEN="<an Arc API token on the hub with write permission>"
```

The secret drives the per-spoke HMAC; the token satisfies the hub's API-token middleware, which fronts the sync endpoints at write level. Without the token, every request against a hub running with authentication enabled (the default) fails with a `401` whose error text names the variable — only a hub with authentication disabled needs none. Arc **refuses to start** if the secret or token appears in the config file. One that is ignored still leaks, and leaving it in place makes the committed copy — the one that gets backed up and committed to a repo — look load-bearing.

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

### When a tracked file vanishes before delivery

Compaction (on by default) rewrites raw Parquet and deletes the sources; retention deletes whole partitions. A file caught by either after discovery but before delivery has nothing left to send. The ledger marks it `skipped` — reported in `/status` and in each pass or export result — instead of retrying it into a permanent `failed` row, or (on the air-gap path) failing the whole export. Only a storage backend positively reporting the file gone triggers the skip; a transient storage error never does. Terminal rows (`synced`, `skipped`) are pruned after `ledger_retention_days`.

:::warning Compaction on a syncing spoke duplicates rows on the hub
Raw files synced before compaction stay on the hub; the compacted file carrying the same rows then syncs as a new path, and hub queries over that partition double-count. Until hub-side supersede logic ships, either disable compaction on databases a spoke syncs, or account for duplicates in hub queries.
:::

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

## Air-gap bundles

Some spokes have no network path at all — a submarine, a classified facility, a vehicle whose data comes off on a physical drive. For those, a spoke writes a **signed bundle** to removable media and someone carries it to the hub.

```toml
[edge_sync.spoke.bundle]
enabled = true                        # default false
allowed_dirs = ["/mnt/usb"]           # REQUIRED; an empty list refuses every export
max_files = 10000                     # per bundle
max_bytes = 68719476736               # 64 GiB per bundle
```

This is **independent of `edge_sync.spoke.enabled`**. A fully air-gapped spoke sets only the bundle block — it needs no `hub_url`, and the network endpoints return `503`. A spoke that has both intermittent connectivity and a drive courier enables both and uses whichever is available.

You still need `spoke_id` and `hub_id`: both are bound into the bundle's signature, and the hub rejects a bundle that names a different one.

### Writing a bundle

```bash
curl -X POST https://edge.local:8000/api/v1/spoke-sync/export \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -d '{"path": "/mnt/usb"}'
```

```json
{
  "exported": true,
  "bundle_id": "06FXVSQXJ2C0EBDFDQ9D24S1E8",
  "dir": "/mnt/usb/bundle-submarine-01-06FXVSQXJ2C0EBDFDQ9D24S1E8",
  "files": 3,
  "bytes": 3285,
  "note": "Files are marked exported, not synced. They advance to synced when the hub acknowledges the bundle."
}
```

Optional `"limit": N` caps one bundle below `max_files`. A spoke with nothing new returns `{"exported": false, "reason": "nothing to export"}` — not an error, so a scheduled export does not look broken when the backlog is drained.

### What a bundle looks like

```
bundle-submarine-01-06FXVSQXJ2C0EBDFDQ9D24S1E8/
  manifest.json     signed header: bundle ID, spoke, hub, entry digest, MAC
  entries.jsonl     one JSON object per file: path, sha256, size
  data/             the Parquet files, under their original paths
  ack.json          on a RETURNED drive only: the hub's signed receipt
```

`ack.json` appears after the drive has been to the hub. It is not covered by the manifest's digest — it cannot be, since it is created after the manifest is signed — but it is independently signed with the same per-spoke secret, so a replaced one is refused when the spoke reads it.

A directory rather than an archive, for two reasons:

- **Resume is free.** An interrupted copy leaves whole files, and the manifest's per-file SHA says exactly which landed — so resuming re-copies the mismatches instead of restarting. A truncated tar offers no such granularity.
- **It is auditable.** Someone has to inspect what crosses an air gap. `ls` and `sha256sum entries.jsonl` answer that without special tooling:

```bash
sha256sum /mnt/usb/bundle-*/entries.jsonl
python3 -c "import json;print(json.load(open('/mnt/usb/bundle-.../manifest.json'))['entries_sha256'])"
```

Bundle IDs are time-prefixed, so a directory listing sorts into creation order. They use Crockford base32 (no `I`, `L`, `O`, or `U`) because operators read them off screens.

### Where bundles may be written

`allowed_dirs` is **required**, and an empty list refuses every export. Every other Arc write path is confined to the storage root by its storage backend, but a USB mount is outside that root by definition — so this is the only thing bounding where an operator-supplied path can land.

- Paths are resolved through symlinks **before** the check, so a link inside an allowed directory cannot point outside it.
- Containment is compared at a path-segment boundary, so `/mnt/usb-other` is not treated as inside `/mnt/usb`.
- Arc **refuses to export into its own storage root**. The next discovery pass would otherwise find the exported copies and queue them for sync, fanning out on every export.

A refused path returns `400` and names the reason.

### Exported is not synced

Exported files move to a distinct ledger state. They leave `pending`, so a later bundle or contact window does not re-send them, but they are **not** `synced` — no hub has confirmed anything yet. `GET /api/v1/spoke-sync/status` reports them separately:

```json
{"pending": 12, "exported": 3, "synced": 40, "pending_bytes": 15728640}
```

`pending_bytes` still includes exported bytes. A file on a drive in transit has not arrived, and excluding it would make the backlog appear to shrink at exactly the moment nothing was delivered.

They advance to `synced` when the hub's acknowledgment comes back — which ships with the import side.

### When a drive does not arrive

```bash
curl -X POST https://edge.local:8000/api/v1/spoke-sync/export/06FXVSQXJ2C0EBDFDQ9D24S1E8/revert \
  -H "Authorization: Bearer $ARC_TOKEN"
```

Returns just that bundle's files to `pending`, so the next bundle or contact window carries them. Other drives in transit are untouched. `GET /api/v1/spoke-sync/ledger` shows each file's `exported_bundle_id`, which is how you find the ID to revert.

### Importing a drive on the hub

The other half. Enable it on the hub:

```toml
[edge_sync.import]
enabled = true                        # default false
allowed_dirs = ["/mnt/usb"]           # REQUIRED; an empty list refuses every import
max_files = 10000                     # refuses a manifest declaring more
```

Independent of `edge_sync.enabled`. A hub that only ever takes drives exposes **no** network-writable surface — `/api/v1/sync/file` returns 404. A hub that does both enables both.

```bash
curl -X POST https://hub.example.com/api/v1/bundle-import \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -d '{"path": "/mnt/usb/bundle-submarine-01-06FXW4H1BHR3XHWK2J826G28JG"}'
```

```json
{
  "imported": true,
  "bundle_id": "06FXW4H1BHR3XHWK2J826G28JG",
  "spoke_id": "submarine-01",
  "committed": 5,
  "already_present": 0,
  "bytes_written": 5475,
  "conflicts": []
}
```

**Nothing is committed until the whole bundle verifies** — the MAC, `entries.jsonl`'s hash, the canonical digest, every file's size and SHA-256, and the absence of any undeclared file (`ack.json` excepted on a returned drive; it carries its own signature). A tampered drive is refused and not one byte reaches storage.

| Situation | Response |
|---|---|
| Already imported | `409`, with when it arrived and how many files |
| Tampered, truncated, wrong hub, unknown or disabled spoke | `422`, naming what failed |
| Path outside `allowed_dirs` | `400` |

A **refused** bundle is never recorded as imported, so a corrected drive still works.

Conflicts are reported in full and never overwritten, exactly as on the network path: the same path holding different content means a spoke-ID collision or corruption, and one of the two copies is wrong.

### Why a duplicate drive is refused

Replay protection here is a **dedup ledger**, not a timestamp window. The online endpoints bind a nonce and a five-minute freshness check, which works because a request is in flight. A bundle legitimately sits on a drive for weeks, so the hub records every import keyed `(spoke_id, bundle_id)` instead — durable state that survives a restart, as a nonce cache does not.

Keyed by spoke as well as bundle, so a compromised spoke cannot burn IDs in another spoke's namespace and block its future drives.

There is no cleanup job: 200 spokes shipping weekly for five years is about 52,000 rows.

### Import history

```bash
curl https://hub.example.com/api/v1/bundle-import/history/submarine-01 \
  -H "Authorization: Bearer $ARC_TOKEN"
```

Answers "did last month's drive ever arrive?" — which, on a link with no telemetry, nothing else can.

### Cluster mode

Manifest registrations are **batched at 1000 operations per Raft proposal**. The network path is naturally rate-limited to one proposal per HTTP request, but an import is a tight loop: a 2,500-file bundle costs 3 proposals rather than 2,500.

If a batch fails, the import aborts rather than continuing — a Raft quorum loss is not transient. The bundle is not recorded, so re-importing re-registers everything.

### The return leg: acknowledgments

On a successful import the hub writes a signed `ack.json` **into the bundle directory**, so the drive going back carries its own receipt and it cannot be separated from the bundle it answers.

Plug the drive back into the spoke:

```bash
curl -X POST https://edge.local:8000/api/v1/spoke-sync/ack \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -d '{"path": "/mnt/usb/bundle-submarine-01-06FXWFA2NYJHJJFAJAXBDV4PKC"}'
```

```json
{
  "applied": true,
  "bundle_id": "06FXWFA2NYJHJJFAJAXBDV4PKC",
  "hub_id": "shore-station",
  "imported_at": "2026-08-07T21:59:56Z",
  "synced": 4,
  "conflicts": []
}
```

Those files move from `exported` to `synced`. **This is what makes them prunable** — without it `synced` is unreachable on an air-gapped spoke, so the ledger grows forever on the box least able to receive a site visit.

A full cycle looks like this:

```
after export:   pending 0   exported 4   synced 0
after import:   (hub holds 4 files, writes ack.json to the drive)
after ack:      pending 0   exported 0   synced 4
```

### What the acknowledgment guarantees

The ack is signed with the **same per-spoke secret** the spoke signs bundles with. The secret is symmetric, so the key that lets a spoke prove authorship lets the hub prove receipt — no new key material to distribute.

The spoke **recomputes** the path digest rather than trusting the one in the file. The MAC binds the digest, so a tampered path list carrying a stale digest would otherwise validate and license marking files synced that the hub never received.

Refused, with a `400`:

- an ack signed by a different hub, or naming a different spoke
- any path added to or removed from the acknowledged list
- a changed MAC, bundle ID, or import time
- an acknowledged path that escapes the spoke's namespace

**Conflicted paths are not acknowledged.** A conflict means the hub holds *different* content at that path, so your copy was never delivered — those entries stay `exported` and are reported for you to look at.

Re-applying an ack is harmless: already-synced entries are a no-op, so a drive plugged in twice changes nothing. A bundle that has not yet been to the hub returns `{"applied": false, "reason": "this bundle carries no acknowledgment yet"}` rather than an error.

Like the bundle it answers, an ack carries **no freshness window** — it rides the same drive back, over the same weeks.

### Air-gap limitations

- **Bundles are signed, not encrypted.** The manifest gives integrity and authenticity; the Parquet files themselves are readable by anyone holding the drive. Air-gap media is normally handled under physical controls, but if that does not hold for your deployment, encrypt the drive.
