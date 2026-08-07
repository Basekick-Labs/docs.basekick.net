
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
```

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

**Nothing is committed until the whole bundle verifies** — the MAC, `entries.jsonl`'s hash, the canonical digest, every file's size and SHA-256, and the absence of any undeclared file. A tampered drive is refused and not one byte reaches storage.

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

### Limitations
- **Bundles are signed, not encrypted.** The manifest gives integrity and authenticity; the Parquet files themselves are readable by anyone holding the drive. Air-gap media is normally handled under physical controls, but if that does not hold for your deployment, encrypt the drive.
