---
title: "Backup & Restore"
description: "Back up Arc's Parquet data, SQLite metadata, and arc.toml through the REST API, track async job progress, and restore selectively from an existing backup."
---

Arc includes a full backup and restore system via REST API. Backups capture parquet data files, SQLite metadata (auth, audit, MQTT config), and the `arc.toml` configuration file -- with async operations, real-time progress tracking, and selective restore.

<Callout type="info" title="Available since v26.03.1">
Backup & Restore is available starting Arc v26.03.1 (March 2026).
</Callout>

<Callout type="warn" title="Admin Required">
All backup and restore endpoints require admin authentication.
</Callout>

## Configuration

```toml
[backup]
enabled = true                  # default: true
local_path = "./data/backups"   # default: ./data/backups
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/backup` | Trigger a backup (async): the whole instance, or the databases named in `databases` (27.01.1+) |
| `GET` | `/api/v1/backup` | List all available backups; an entry carries `skipped_files`, `skipped_metadata_files` and `unaddressable_files` when the backup's manifest has them, and `scope` for a database-scoped backup |
| `GET` | `/api/v1/backup/status` | Progress of active operation |
| `GET` | `/api/v1/backup/:id` | Get backup manifest |
| `DELETE` | `/api/v1/backup/:id` | Delete a backup |
| `POST` | `/api/v1/backup/restore` | Restore from a backup (async) |

## Creating a backup

```bash
curl -X POST "http://localhost:8000/api/v1/backup" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

**Response (202 Accepted):**
```json
{
  "message": "Backup started",
  "status": "running"
}
```

The backup runs asynchronously in the background. Poll the status endpoint to monitor progress.

A backup is a copy of the files on disk at the moment each is read. Rows still
in the ingest buffers are not in it: "point in time" means the last flush.

### Scoping a backup to databases

Since 27.01.1 the request body takes `databases`:

```bash
curl -X POST "http://localhost:8000/api/v1/backup" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"databases": ["audit"]}'
```

```json
{
  "message": "Backup started",
  "status": "running",
  "databases": ["audit"]
}
```

A scoped backup copies the named databases and nothing else: their data files,
their schema anchors under `_schema/` and their compaction state under
`_compaction_state/`. The manifest records the list as `scope`; the backup list
and the status endpoint show it. `backup_type` stays `full`. An empty or absent
list is the whole-instance backup described above.

- `include_metadata` and `include_config` default to `false` for a scoped
  backup. An explicit `include_metadata: true` is refused with `400`: the SQLite
  database holds every database's tier rows, the tokens, the continuous queries
  and the audit log, so it cannot ride along with one database; take an
  unscoped backup for it. `include_config: true` is allowed.
- Each name must be a database this node knows: its hot prefix has a file, or
  `_schema/<db>/` has an anchor, or the tier metadata has rows for it. The last
  rule accepts a fully cold database (an audit database with a long retention,
  say); its backup completes with zero data files, because the cold tier is not
  copied yet. An unknown name, an invalid one (`..`, a separator, an empty
  string), a duplicate, or more than 256 names answers `400` naming the value.
- The body must be JSON (`Content-Type: application/json`). A form-encoded or
  plain-text body answers `400`; an empty body means the defaults.
- The databases' Iceberg namespace directories (`<prefix>_<db>.db/`) are not
  copied. They are counted on the manifest as `iceberg_namespace_files_excluded`
  and `iceberg_namespaces_excluded`: the Iceberg catalog is instance-wide and
  travels with the metadata a scoped backup refuses, so those files would
  restore tables no catalog can resolve.
- The scope is the storage-root segment. Edge-sync spoke data lives under
  `<spoke>/<db>/…`, so `["prod"]` does not include `spoke1/prod`, and
  `["spoke1"]` takes the whole spoke with its anchors and compaction state. A
  spoke namespace below the root segment cannot be named.

Restoring a scoped backup restores only those databases, in either mode. On a
cluster node a restore of a scoped backup that does not name a `mode` runs in
`replace` (see [Restore options](#restore-options)).

### Polling progress

```bash
curl "http://localhost:8000/api/v1/backup/status" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

```json
{
  "operation": "backup",
  "backup_id": "backup-20260211-143022-a1b2c3d4",
  "status": "running",
  "total_files": 1200,
  "processed_files": 450,
  "total_bytes": 5368709120,
  "processed_bytes": 2147483648
}
```

## Listing backups

```bash
curl "http://localhost:8000/api/v1/backup" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

## Viewing a backup manifest

```bash
curl "http://localhost:8000/api/v1/backup/backup-20260211-143022-a1b2c3d4" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

The manifest describes what was inventoried and what was stored. The counts to
check before relying on a backup:

| Field | Meaning |
|-------|---------|
| `total_files` | Data files inventoried at backup time, including any that were skipped. |
| `skipped_files` | Data files counted in `total_files` but not stored: the file vanished between the listing and the copy (compaction or retention), or its backup destination key would have exceeded the storage key limit (v26.09.3+). When non-zero the backup is incomplete; the backup log names each skipped file and `skipped_sample` names up to 32 of them. |
| `skipped_metadata_files` | The same, for Iceberg metadata files under the storage root and compaction recovery state. |
| `skipped_sample` | Up to 32 of the skipped data and Iceberg metadata files, in copy order, whichever the cause (v26.09.3+). A metadata key carries a `/metadata/` segment. Compaction recovery manifests that vanished because their job finished, and files of a warehouse outside the storage root, are counted but not listed; the backup log names them. |
| `skipped_overlong_keys` | How many of the skips were for a destination key over the storage limit (v26.09.3+): the permanent cause, fixed by renaming the file, as opposed to a file that vanished. |
| `unaddressable_files` | Files that exist in source storage but that no listing can return because their key breaks the storage key rules. Not backed up; a sample of their keys is in `unaddressable_sample`. |

A backup stores each data file under `<backup_id>/data/<source key>`, 37 bytes
longer than the source key, against a 1019-byte key limit. A source key of 983
bytes or more is therefore skipped and counted in `skipped_files` rather than
aborting the backup (v26.09.3+; before that it failed every backup until the key
was renamed). Arc's own partition layout stays well under the threshold; the
case arises from keys placed in the storage root by other tools. If more than
10% of a backup's files are skipped for any reason, the backup fails instead,
and the error gives each cause's count: how many files could not be read and
how many have source keys longer than 982 bytes. A failed run writes no
manifest, so its `skipped_sample` is on the status endpoint until the next
operation starts, and the `arc_backup_skipped_files` gauge carries the count
(see [Monitoring](/arc/operations/monitoring/)).

### Backup structure

```text
{backup_id}/
  manifest.json              # metadata: databases, measurements, file counts, sizes; scope (27.01.1+) when the backup was scoped
  data/                      # parquet files preserving partition layout
  data/_schema/              # field schema anchors (v26.09.2+), copied with the data
  data/_compaction_state/    # compaction recovery manifests (v26.09.2+), copied before the data
  iceberg/                   # Iceberg table metadata, only when iceberg.warehouse is outside the storage root
  metadata/arc.db            # SQLite database snapshot
  config/arc.toml            # configuration file
```

Two counts in the manifest describe Arc's own state under the storage root
(v26.09.2+). `auxiliary_files` counts the field schema anchors under `_schema/`:
Parquet objects, so they are inside `total_files` and `total_size_bytes`,
but they belong to no database and are absent from `databases`.
`compaction_state_files` counts the objects under `_compaction_state/`: copied
before the data files, counted in the backup progress but not in
`total_files`. A recovery manifest that cannot be read while it still exists
fails the backup rather than being skipped, because a backup holding a
compacted output and its inputs with no manifest would restore both.

Iceberg table metadata that lives under the storage root (the default warehouse) travels under `data/`. A warehouse configured outside the storage root is walked separately and stored under `iceberg/`; the manifest records it as `iceberg_warehouse` with the source path, file count and size.

## Restoring from a backup

<Callout type="warn" title="Destructive Operation">
Restore overwrites existing data. Existing SQLite and config files are preserved with a `.before-restore` suffix before overwriting.
</Callout>

```bash
curl -X POST "http://localhost:8000/api/v1/backup/restore" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_id": "backup-20260211-143022-a1b2c3d4",
    "restore_data": true,
    "restore_metadata": true,
    "restore_config": false,
    "confirm": true
  }'
```

### Restore options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backup_id` | string | *(required)* | ID of the backup to restore |
| `restore_data` | bool | `true` | Restore parquet data files |
| `restore_metadata` | bool | `true` | Restore SQLite database (auth, audit, MQTT) |
| `restore_config` | bool | `false` | Restore `arc.toml` configuration |
| `mode` | string | `merge`; `replace` for a scoped backup on a cluster node | `merge` adds the backup's files to what is there; `replace` (clusters only, 27.01.1+) first removes the current manifest entries of the databases the backup holds, then writes and registers the backup's files. When the request names no mode and the backup is scoped to databases, a cluster node runs `replace` (the mode a per-database backup is for: an additive restore of an audit database brings back everything retention removed since) and the 202 echoes the effective mode; an explicit `merge` is honoured, and a standalone node is always additive. For a scoped backup the files `replace` removes are selected by the storage path's first segment. `replace` is refused (`400`) when the scoped backup holds no data files for one of its databases (fully cold, or dropped and re-created since): it would only remove the current files; use `merge`, or take the backup again once the database has hot files. See [Clusters](#clusters). |
| `confirm` | bool | *(required)* | Must be `true` to proceed |

### Selective restore examples

```bash
# Restore only data (keep current auth tokens and config)
curl -X POST "http://localhost:8000/api/v1/backup/restore" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_id": "backup-20260211-143022-a1b2c3d4",
    "restore_data": true,
    "restore_metadata": false,
    "restore_config": false,
    "confirm": true
  }'

# Restore everything including config
curl -X POST "http://localhost:8000/api/v1/backup/restore" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_id": "backup-20260211-143022-a1b2c3d4",
    "restore_data": true,
    "restore_metadata": true,
    "restore_config": true,
    "confirm": true
  }'
```

### Compaction state

A backup taken while a compaction job was between uploading its output and
deleting its inputs holds both. Since v26.09.2 the restore reads the
backed-up recovery manifests first and does not restore the inputs of any
manifest whose output the backup holds intact (present, and of the size the
manifest recorded), so the restored store serves each row once from the
moment the restore finishes. The status endpoint reports them:

| Field | Meaning |
|-------|---------|
| `consumed_inputs_skipped` | Input files the backup held next to the compacted output that replaced them; deliberately not restored. |
| `compaction_state_restored` | Recovery manifests put back. The next compaction cycle retires each one after firing its receipt hooks. |

A manifest whose output the backup does not hold, or holds damaged, keeps
its inputs; recovery then discards the manifest (and a damaged output) so
compaction retries. If
metadata was restored as well, restart before the next compaction cycle so
the staged metadata is applied first. A restored manifest older than seven
days logs compaction's stale warning once when processed; that is expected.
Backups taken by earlier releases carry no manifests to reconcile with.

### Incomplete restores

A restore that could not restore every data file ends with `status: failed`,
even though every file it could read was written and stays in place. The status
endpoint says what is absent:

```json
{
  "operation": "restore",
  "backup_id": "backup-20260913-175728-541f0e8c",
  "status": "failed",
  "total_files": 3,
  "processed_files": 2,
  "skipped_files": 1,
  "skipped_sample": [
    "backup-20260913-175728-541f0e8c/data/smoke/cpu/2026/09/13/16/cpu_20260913_175727_441274000.parquet"
  ],
  "error": "restore incomplete: 1 objects could not be read from backup storage (skipped_sample); the files that could be restored are in place"
}
```

| Field | Meaning |
|-------|---------|
| `skipped_files` | Backup objects that could not be read. Up to 32 of their paths are listed in `skipped_sample`. |
| `unaddressable_files` | Data files present in backup storage under names its listing cannot return, such as a dot-prefixed key an object store handed back at backup time. Up to 32 are listed in `unaddressable_sample`; rename them in the backup and re-run to recover them. |
| `missing_files` | Data files the backup's manifest inventoried that are neither listed nor unaddressable in backup storage: they are gone, for example after a partial sync or a deleted object. |
| `backup_skipped_files`, `backup_unaddressable_files` | Files the backup itself lacked when it was taken (see its manifest). Reported so a gap that predates the restore is not mistaken for one it caused; they do not fail the restore. |

There is no tolerated fraction: any skipped, unaddressable, or missing file fails the restore.
A write into data storage that fails (a full or read-only volume) aborts the
restore immediately rather than being skipped. Treat `failed` as final and read
the counts; re-running against the same backup reproduces the same gap until
the backup is repaired.

## Clusters

Since 27.01.1 (#1083) backup and restore are cluster-aware. Everything in this
section applies only when `cluster.enabled` is set; a standalone node behaves as
described above, plus the sidecar file.

**Where it runs.** Backups and restores run on the primary writer. Any other
role (a standby writer, a reader, the compactor) answers `503` with a message
telling you to route the request to the primary writer; the check is made on
every request, so a failover between two calls changes which node answers.

**What a backup contains.** The backup walks the node's local storage and
compares it with the cluster manifest, after waiting for this node's copy of the
manifest to catch up with the Raft leader:

- A manifest entry this node does not hold yet (typically right after a
  failover) is counted as `manifest_only_files`, sampled in
  `manifest_only_sample`, re-checked once at the end of the run, and marks the
  backup INCOMPLETE.
- A local Parquet file the manifest does not list is **not** backed up and is
  counted as `unregistered_skipped` (`unregistered_sample`). The cluster does
  not consider such a file data: a compaction input awaiting removal, a
  dropped registration, or a file from before the cluster existed.
- A file copied during the run that the manifest dropped before the end of the
  run is removed from the backup again and counted as
  `left_manifest_during_run`.
- A backup started while the manifest is empty but the disk holds data files
  fails rather than backing up nothing.

A sidecar file `<backup_id>/manifest-files.json` lists every data file in the
backup with its SHA-256, size, database, measurement, partition time and
created-at. A cluster restore needs it; a backup taken before 27.01.1 cannot be
restored on a cluster.

One window remains: compaction registers its output and deletes its inputs in
two separate Raft steps about a second apart. A backup whose listing lands in
that window, on a primary that has already pulled the output, carries both. See
#1087.

**What a restore does.** Every restored data file is registered in the cluster
manifest from the sidecar, in batches, so the other nodes pull it; a file that
already exists at a different checksum makes every peer re-pull it. A restore
of many files can hold the readers' catch-up gate (`cluster.query_gate_on_catchup`)
red until they converge. The size and checksum of each file are verified
against the sidecar before anything is overwritten; mismatches are counted as
`sidecar_mismatches` and the live copy is left alone. If registration fails
part-way (a lost Raft quorum), the restore stops and reports the files that
were written but not registered; run the restore again. Until then those files
are orphan storage: an enabled reconciliation sweep removes them after its
grace window, and nothing else does.

**Modes.** `merge` (the default) adds the backup's files to what the cluster
has, which also brings back any file deleted since the backup was taken.
`replace` removes the current manifest entries of every database the backup
holds (the delete workers unlink the files on each node), then writes and
registers the backup's files. `replace` is refused for an INCOMPLETE backup and
when a large share of the node's files were skipped as unregistered. Pause
compaction, or stop the compactor, for the duration of a `replace`: a
compaction job finishing mid-restore can remove the files you just restored
(#1087). On shared-storage clusters the primary deletes the replaced objects
itself.

**What a cluster restore refuses.** `restore_metadata` defaults to `false` on a
cluster and an explicit `true` is rejected with `400`: the SQLite holds
Raft-replicated tokens and per-node tier metadata, and restoring one node's
copy would diverge it from the cluster. `restore_config` is rejected for the
same reason: `arc.toml` carries the node identity, role and seeds.

**Tiering.** Restored data files are recorded in the node's tier metadata, so
they are routed to by queries without waiting for the next tier scan.

**Operational notes.** A primary demoted during a long backup or restore
finishes its run; do not start another on the new primary until it has
finished. `replace` leaves files the manifest does not list untouched.
`cluster.role = "standalone"` inside a non-shared-storage cluster is not a
primary writer and gets `503`, as the delete API and retention do.

## Deleting a backup

```bash
curl -X DELETE "http://localhost:8000/api/v1/backup/backup-20260211-143022-a1b2c3d4" \
  -H "Authorization: Bearer $ARC_TOKEN"
```

Deletion is refused with `409 Conflict` while a backup or restore is running -- deleting the backup a restore is reading would tear files out from under it. Retry once the operation finishes.

## Key behaviors

- **Async operations** -- backup and restore run in background goroutines with a 2-hour timeout. Clients poll `/status` for progress.
- **Serialized operations** -- only one backup, restore, or delete can run at a time. Attempting a concurrent operation returns `409 Conflict`.
- **Pre-restore safety** -- existing SQLite and config files are copied with `.before-restore` suffix before overwriting.
- **Destructive restore protection** -- restore requires explicit `confirm: true` in the request body.
- **Incomplete restores fail** -- a restore that could not restore every data file ends `failed`, with `skipped_files` and `missing_files` on the status endpoint; the files that could be restored stay in place.
- **What gets backed up** -- parquet data files, SQLite database (with WAL checkpoint for consistency), Iceberg table metadata when Iceberg export is enabled, and `arc.toml` config. A backup scoped with `databases` holds only those databases' data files, schema anchors and compaction state (27.01.1+).
- **Iceberg warehouse outside the storage root** -- its metadata is restored into this node's configured `iceberg.warehouse` whenever `restore_data` or `restore_metadata` is set. The Iceberg catalog stores absolute paths, so the target node's `iceberg.warehouse` must be the same path the backup was taken from (a symlink to it works); a node with no such warehouse skips those files and reports them as `iceberg_warehouse_files_skipped` on the status endpoint. Restart promptly after a restore that includes Iceberg: the catalog snapshot is applied on the next start, and a reconciler still running on the old catalog can expire metadata the restore just wrote.
- **Clusters** -- Iceberg export runs on one node; a backup taken on any other node carries no Iceberg catalog or warehouse.
- **All storage backends** -- works with local filesystem, S3, and Azure Blob Storage.

## Error responses

| Status | Description |
|--------|-------------|
| `400` | Invalid request: a body that is not JSON, an unknown, invalid or duplicate name in `databases`, `include_metadata: true` on a scoped backup, an invalid restore `mode`, or `replace` on a scoped backup that holds no data files for one of its databases |
| `401` | Authentication required |
| `403` | Admin role required |
| `404` | Backup not found |
| `409` | Another operation is already running (returned by backup, restore, and delete) |
| `500` | Backup or restore execution error |
