
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

### Limitations

- **The hub-side import is not in this release.** A bundle can be written, verified, and inspected today; importing it lands next.
- **No acknowledgment yet**, so exported files do not reach `synced` and are not pruned. On a long-running air-gap spoke the ledger grows until that ships.
- **Bundles are signed, not encrypted.** The manifest gives integrity and authenticity; the Parquet files themselves are readable by anyone holding the drive. Air-gap media is normally handled under physical controls, but if that does not hold for your deployment, encrypt the drive.
