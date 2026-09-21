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
# operation_timeout = "2h"      # 27.01.1+; how long one backup or restore may run
```

<Callout type="warn" title="Breaking on upgrade to 27.01.1">
Arc now refuses to start when the backup destination overlaps primary storage
or the tiered-storage cold tier. With no target configured the destination is
`local_path`, so a deployment whose `local_path` sits inside
`storage.local_path` -- or whose `storage.local_path` is a parent of it, such
as `./data` -- boots today and will not boot after the upgrade. An empty
`local_path` with no target is refused too, where it used to boot with the
backup API quietly skipped. The defaults above are disjoint and are
unaffected.
</Callout>

## Destinations

By default a backup is written to the local directory in `local_path`. From
27.01.1 a **target** makes the destination configurable, and it may be remote.

```toml
[backup]
enabled = true
default_target = "main"         # local_path above is then ignored entirely

[backup.targets.main]
type = "local"                  # local, s3, minio, azure or azblob
local_path = "/srv/arc-backups"
```

With `default_target` set, `local_path` is not used and the directory is not
even created. An S3 target instead:

```toml
[backup.targets.main]
type = "s3"
s3_bucket = "acme-arc-backups"
s3_prefix = "arc/backups"
s3_region = "us-east-1"
s3_endpoint = ""                # set for MinIO/SeaweedFS
s3_use_ssl = true
s3_path_style = false           # required for MinIO
# prefer the environment for credentials:
#   ARC_BACKUP_TARGETS_MAIN_S3_ACCESS_KEY
#   ARC_BACKUP_TARGETS_MAIN_S3_SECRET_KEY
```

Azure Blob Storage takes `azure_container` and `azure_prefix` with
`type = "azure"`.

### A different target per database

A target that carries `databases` receives those databases; everything else
goes to `default_target`. One compliance database can therefore land in its own
bucket while the rest of the instance goes somewhere cheaper.

```toml
[backup]
default_target = "main"

[backup.targets.main]           # the DEFAULT: everything unrouted goes here
type = "local"
local_path = "/srv/arc-backups"

[backup.targets.audit]          # a ROUTED target: it carries `databases`
type = "s3"
databases = ["audit", "compliance"]
s3_bucket = "acme-arc-audit-backups"
s3_prefix = "arc/backups"
s3_region = "us-east-1"
```

The names are storage-root segments, exactly as a [scoped
backup](#scoping-a-backup-to-databases) names them, so an edge-sync spoke is
named as the **spoke**: `["prod"]` does not mean `spoke1/prod`. Only the comma
separates names -- a database name may contain a space, so
`databases = "my db"` is one name and `databases = ["a", "b"]` is two.

A database goes to exactly one target; naming it on two is refused at startup.
Naming databases on `default_target` is allowed and does nothing, since
everything unrouted goes there already.

What a routed backup looks like on the wire:

- one manifest and one file sidecar **per target**, each describing its own
  slice and each naming the whole run, plus an index at
  `<backup_id>/index.json` on the default target naming every target the run
  touched;
- the listing returns **one entry per backup id**, with `targets` naming every
  destination holding a slice of it. A target that will not answer is named in
  `unreachable_targets`, `partial_view` says the counts are summed over fewer
  legs than `targets` names, and the rest of the listing still answers;
- `GET /api/v1/backup/:id` adds a `targets` array with each leg's own counts;
- a delete sweeps every target, and can report partial success;
- a restore reads **every** target of the run and refuses before writing
  anything if one of them is not configured, will not answer, or holds no
  manifest for the id. Restoring only the reachable part would report success
  over a set it did not restore.

Instance-wide state always goes to `default_target` whatever the routing says,
because it belongs to no one database: the SQLite database, the Iceberg SQL
catalog and table metadata, and `arc.toml`. A database's own field schema
anchors and compaction recovery state do travel with its data to its target.

### Rules Arc enforces at startup

- **A destination may not overlap primary storage, the cold tier, or another
  backup target.** A destination inside the storage root is inventoried by the
  next backup, so each backup copies the previous one in full; two targets that
  contain one another are one listing, so deleting one backup id would reach
  both. The same applies to a prefix that is a parent of, or sits under,
  another, and every spelling of one endpoint counts as one store -- leaving
  `s3_endpoint` empty for AWS on one side and writing out
  `s3.us-east-1.amazonaws.com` on the other does not make them two places. One
  bucket with **disjoint prefixes** is fine and is the intended shape.
- **Target names are letters, digits and underscore only, and are lowercased.**
  The rule that matters is the hyphen: it cannot appear in an environment
  variable name, so a hyphenated target could be set in the file and never
  afterwards overridden from the environment -- which is how a credential stays
  in a config file for good. `audit-bucket` is refused; `audit_bucket` is not.
- **A target nothing is routed to is inert**, and a warning at startup names
  it. Not a refusal, because adding the target block and its `databases` in
  separate commits is ordinary.
- **With any remote target configured, `include_config` defaults to `false`**
  for every backup -- not only when the *default* target is remote, because
  `arc.toml` carries every target's credentials. A request may ask for it
  explicitly and is warned, naming every remote target whose keys the backup
  then carries.

### From the environment alone

With nothing in the file, a target takes one extra variable, because a name
cannot be discovered from a map that does not exist:

```bash
ARC_BACKUP_TARGET_NAMES=main,audit
ARC_BACKUP_DEFAULT_TARGET=main
ARC_BACKUP_TARGETS_MAIN_TYPE=s3
ARC_BACKUP_TARGETS_MAIN_S3_BUCKET=acme-arc-backups
ARC_BACKUP_TARGETS_AUDIT_TYPE=s3
ARC_BACKUP_TARGETS_AUDIT_S3_BUCKET=acme-arc-audit-backups
ARC_BACKUP_TARGETS_AUDIT_DATABASES=audit,compliance
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/backup` | Trigger a backup (async): the whole instance, or the databases named in `databases` (27.01.1+) |
| `GET` | `/api/v1/backup` | List all available backups; an entry carries `skipped_files`, `skipped_metadata_files` and `unaddressable_files` when the backup's manifest has them, `scope` for a database-scoped backup, `cold_files` and `cold_files_excluded` when tiered storage is in play, and `targets`/`partial_view`/`unreachable_targets` for a backup split across destinations |
| `GET` | `/api/v1/backup/status` | Progress of active operation |
| `GET` | `/api/v1/backup/:id` | Get backup manifest; adds a `targets` array with each destination's own counts when the backup was split across more than one |
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
that window, on a primary that has already pulled the output, carries both. The
compaction pause that restores take (below) does not cover backups.

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
when a large share of the node's files were skipped as unregistered. On
shared-storage clusters the primary deletes the replaced objects itself.

**Compaction pause.** Every cluster restore, `merge` and `replace`, pauses
compaction cluster-wide for its duration (#1087): compaction commits its output
and the removal of its inputs in two Raft steps, and a job finishing mid-restore
could remove files the restore had just registered. The restoring primary
proposes the pause through Raft; every node stops starting compaction batches,
lets the batch it is running finish, applies the manifest commits it still has
pending, and acknowledges. The restore starts once every node in the cluster
node table has acknowledged and fails after 10 minutes naming the nodes that
did not: a long compaction batch may still be running there, the node holds a
pending commit its completion watcher is not applying (a node that lost the
compactor lease with one pending; move the lease back or restart it), or the
node is not on 27.01.1. **Every node must run 27.01.1 for a cluster restore.**
A node the restoring node has marked unhealthy or dead is not waited for,
except the compactor lease holder and, while no lease is assigned, every node
whose role can compact; a node in the cluster node table the restoring node has
never heard from (right after it restarted, or a node whose leave never reached
the leader) is waited for until an operator removes it from the cluster.

The pause expires six minutes after the requester's last refresh (it refreshes
every 30 seconds), so a restore whose process dies releases compaction on its
own; during those minutes a restore from another node is refused as `already
paused by <node>`. If the pause stops being the restore's own while it runs,
the restore ends `failed` and says so: take a fresh backup and restore again.
Restore progress carries `compaction_pause` (`waiting`, `paused`, `released`,
`lost`); `GET /api/v1/cluster` carries a `compaction_pause` object with the
requesting node, the reason, the expiry, `acks` and `pending_acks`;
`POST /api/v1/compaction/trigger` answers `409` while a pause is in force, and
a scheduled compaction tick inside one is skipped. Backups do not pause
compaction, and there is no operator endpoint to pause it by hand.

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

## Tiered storage: the cold tier in a backup

A backup **carries the cold tier** (27.01.1+). With
[tiered storage](/docs/arc-enterprise/data-lifecycle/tiered-storage) on and a cold
backend this node can read, the backup copies migrated objects alongside hot
files, and a restore puts each file back on the tier it came from. Earlier
releases copied hot storage only.

Cold files are counted in `total_files`, `total_size_bytes` and the
per-database inventory like any other data. Two extra fields say how much of it
came from cold:

```json
{
  "backup_id": "backup-20261007-141500",
  "total_files": 1400,
  "cold_files": 412,
  "cold_size_bytes": 8830452192
}
```

The per-file tier lives in the backup's `manifest-files.json` sidecar, which is
what a restore reads; `cold_files` is the aggregate for an operator.

### What a backup reports about the cold tier

| Field | Meaning |
|---|---|
| `cold_files`, `cold_size_bytes` | files read from the cold tier, and their total size |
| `cold_files_excluded` | tier rows whose data this backup does **not** carry, with `cold_files_excluded_databases` as the per-database breakdown |
| `cold_objects_unrecorded` | cold objects the listing returned that this node holds no tier row for. They **are** in the backup -- the listing is the authority on what exists -- and the count is a report about the node's metadata, not about the backup |
| `cold_dedup_skipped` | paths found in both listings, where the cold copy was taken and the hot one dropped. One path, one copy, one sidecar row |
| `cold_rows_stale_but_hot` | rows that say cold, have no cold object, and whose file the backup carried from hot storage anyway. Not a gap -- the data is in the backup -- but a metadata disagreement worth seeing |

`cold_files_excluded` means the same thing in both configurations, which is
why it reads differently depending on yours:

- **with a readable cold tier**, the backup carries the cold objects, so the
  only rows it cannot carry are those whose object is **missing from the cold
  store** -- data that is genuinely gone;
- **with no cold tier on this node**, every cold row qualifies, which is what
  the field meant when it was introduced.

It blocks nothing, and joins no refusal: a replace-mode restore of a
partly-cold backup still succeeds.

<Callout type="warn" title="A backup only ever sees this node">
Every cold figure comes from the node taking the backup -- its tier metadata
and its cold listing. On a cluster where one node migrates and the others learn
about it through the cold-tier metadata sync, a node whose sync has not run
reports fewer cold files, without an error. Take the backup on the primary
writer.
</Callout>

The cold fields are absent in four cases, which the JSON cannot tell apart:
tiering is off, nothing has been migrated, the figure could not be taken (the
backup still completes and a warning names the failure), and **this node has no
tiered-storage licence**.

<Callout type="warn" title="An absent field is not proof nothing was migrated">
Tiered storage is licence-gated at startup, so a node without the licence
reports no cold fields at all -- even though its cold objects and tier metadata
are still there and its migrations have stopped. A licence that lapses while
Arc is running keeps reporting; the next restart goes quiet.
</Callout>

## Restoring a backup that holds cold files

A restore puts each file back on the tier the sidecar recorded, and writes the
tier row that makes it queryable -- no manual tiering scan is needed. What
happens to a cold-tier file depends on the node you restore onto:

| Field on `/status` | Meaning |
|---|---|
| `cold_files_restored_to_cold` | put back in this node's cold tier with its tier row recorded |
| `cold_files_restored_to_hot` | the backup read these from cold and this node has **no** cold tier (or has one configured but disabled), so they landed in hot storage and their rows were moved to hot. The data is here and queryable -- it is simply all hot now |
| `cold_restore_quarantine_skipped` | the bytes were written, but the path's tier row is quarantined and was left alone. Those files are not queryable until an operator clears the quarantine |
| `cold_rows_not_recorded` | the bytes reached the cold store but the tier row could not be written. Same unqueryable outcome, different cause |
| `backup_cold_files_excluded` | mirrors the restored backup's own `cold_files_excluded`, so you can tell data the backup never held from data the restore lost |

<Callout type="warn" title="Restore on the primary writer when the backup holds cold files">
A restored cold file is stamped as migrated now, deliberately, so that any
stale hot copy at the same key falls inside the orphan-reconciliation window
and gets cleaned up. That cleanup is **role gated** -- it runs on the primary
writer -- while a restore is not, so a restore performed on a follower writes
rows whose cleanup never runs on that node, and those rows live in that node's
own metadata.
</Callout>

If `cold_rows_not_recorded` is non-zero, the files it counts are in the cold
store and unreadable until a row exists. On a cluster with shared storage or
replication the cold-tier metadata sync writes those rows on its next cycle. On
a standalone node, or a cluster without either, **nothing writes them later** --
re-run the restore.

## Key behaviors

- **Async operations** -- backup and restore run in background goroutines with a 2-hour timeout. Clients poll `/status` for progress.
- **Serialized operations** -- only one backup, restore, or delete can run at a time. Attempting a concurrent operation returns `409 Conflict`.
- **Pre-restore safety** -- existing SQLite and config files are copied with `.before-restore` suffix before overwriting.
- **Destructive restore protection** -- restore requires explicit `confirm: true` in the request body.
- **Incomplete restores fail** -- a restore that could not restore every data file ends `failed`, with `skipped_files` and `missing_files` on the status endpoint; the files that could be restored stay in place.
- **What gets backed up** -- parquet data files, SQLite database (with WAL checkpoint for consistency), Iceberg table metadata when Iceberg export is enabled, and `arc.toml` config. A backup scoped with `databases` holds only those databases' data files, schema anchors and compaction state (27.01.1+).
- **Iceberg warehouse outside the storage root** -- its metadata is restored into this node's configured `iceberg.warehouse` whenever `restore_data` or `restore_metadata` is set. The Iceberg catalog stores absolute paths, so the target node's `iceberg.warehouse` must be the same path the backup was taken from (a symlink to it works); a node with no such warehouse skips those files and reports them as `iceberg_warehouse_files_skipped` on the status endpoint. Restart promptly after a restore that includes Iceberg: the catalog snapshot is applied on the next start, and a reconciler still running on the old catalog can expire metadata the restore just wrote.
- **Clusters** -- Iceberg export runs on one node; a backup taken on any other node carries no Iceberg catalog or warehouse.
- **The cold tier is backed up** (27.01.1+) -- a backup carries migrated objects alongside hot files and a restore puts each one back on the tier it came from, with the tier row that makes it queryable. `cold_files` counts what came from cold; `cold_files_excluded` counts tier rows whose data the backup could not carry. See [Tiered storage: the cold tier in a backup](#tiered-storage-the-cold-tier-in-a-backup).
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
