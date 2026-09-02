---
title: "Edge Sync with a Clustered Hub"
description: "What changes when an edge sync hub is an Arc Enterprise cluster: which node accepts the import, how Raft forwards the manifest command, and pinning a stable import endpoint."
---

[Edge sync](/arc/advanced/edge-sync/) ships Parquet files from an edge Arc (the *spoke*) to a central Arc (the *hub*). The spoke is normally a single node. The hub, in an Enterprise deployment, is usually not — and the two transports touch a cluster at different points.

This page covers what changes when the hub is a cluster. Everything in the [OSS edge sync guide](/arc/advanced/edge-sync/) still applies.

## The short version

| | Network transport | Air-gap transport |
|---|---|---|
| Which node handles it | **Any node** | **One designated node** |
| Why | Manifest writes forward to the Raft leader | The received-files index and dedup ledger are node-local |
| If you get it wrong | Nothing — it just works | Files are still correct, but replay protection and history are per-node |

## Network transport: any node works

A spoke has a single `hub_url`, and every request goes to whatever that resolves to. There is **no writer-role gate** on the receive path — unlike retention or continuous queries, which check `IsPrimaryWriter()` on every tick, a node receiving a file simply accepts it.

That is safe because the manifest write forwards:

```text
receiving node is the Raft leader   → applies locally
receiving node is a follower        → forwards the command to the current leader
```

So a spoke can push at any node and the file still lands in the shared Raft manifest, becoming queryable from your readers.

### Which node should a spoke point at?

Any of them. In practice:

- **A writer** is the natural choice — it already holds storage credentials and is sized for write throughput.
- **A load balancer across the writers** works and survives a node going down. The spoke retries on the next pass regardless, and re-delivery of an already-received file is a no-op, so a mid-transfer failover costs one repeated transfer at worst.
- **A reader** works too, though it means a follower forwarding every manifest write to the leader — an extra hop for no benefit.

The **compactor is invisible** to edge sync. Synced files land as ordinary Parquet under `{spoke_id}/{database}/{measurement}/...` and are compacted like anything else.

### Cluster TLS

If `cluster.tls_enabled` is set, that governs Raft RPC and peer fetch — **not** the spoke's connection. A spoke connects over the public API listener, so its transport security keys off `server.tls_enabled`. These are independent flags; see [Cluster Security](/arc-enterprise/security/cluster-security/).

## Air-gap transport: designate one import node

This is the part that needs an operational decision.

Two pieces of edge-sync state live in **node-local SQLite** (the shared metadata database), not in the Raft manifest:

- **`sync_received`** — the index reconcile answers from, so it can respond without re-hashing storage.
- **`sync_imported_bundles`** — the air-gap dedup ledger, keyed `(spoke_id, bundle_id)`.

Neither is replicated. So on a multi-node hub:

| Scenario | Outcome |
|---|---|
| Every drive imported on node A | Correct. Dedup works, import history is complete |
| Bundle 1 on node A, bundle 2 on node B | Both import correctly — **the files are fine** — but each node only knows its own imports |
| Bundle 1 re-imported on B after A | **Not refused.** B has no dedup row for it |

That last row is worth being precise about: the re-import is **safe, not harmful**. Every file resolves to `already_present`, the [§6.1 identity rule](/arc/advanced/edge-sync/) still refuses to overwrite differing content, and nothing is corrupted. What you lose is the refusal — and `GET /api/v1/bundle-import/history/{spoke_id}` on node B will not show what node A imported.

<Callout type="idea" title="Pick an import node and write it down">
Designate **one** node as the drive-import node — a writer, since it already has storage credentials — and put it in your runbook. Nothing in Arc enforces this today, so it is an operational convention rather than a configured one.
</Callout>

### Raft proposal batching

Import registers manifest entries in **batches of 1000 operations per Raft proposal**.

This matters more than it might sound. The network path is naturally rate-limited to one proposal per HTTP request; an import is a tight loop over a whole drive. Without batching, a 10,000-file bundle would fire 10,000 individual proposals at your leader as fast as the disk allows. Batching makes that 10 proposals.

If a batch fails — a quorum loss, say — the import **aborts** rather than continuing. Files already committed to storage stay there, but the bundle is not recorded as imported, so re-importing it re-registers everything. That is the intended recovery.

### One import at a time

Imports are serialized per node by a mutex. A second concurrent import returns `409` with `"reason": "import in progress"` rather than queuing behind the first — an import can legitimately run for hours, and a request hanging that long is indistinguishable from a dead hub.

## Failover

Nothing in edge sync pins to a particular writer, so a writer failover needs no spoke-side change:

- **Network** — if the spoke's `hub_url` points at a load balancer, the next pass simply lands on a healthy node. If it points at a specific node that goes down, the pass fails and retries on the next trigger; the ledger keeps its state, so nothing is lost or double-sent.
- **Air gap** — if your designated import node is down, import on another node. You lose dedup and history *for that bundle*, per the table above; the data itself is correct.

## What is not cluster-aware yet

Stated plainly so it is not a surprise:

- **The received-files index and dedup ledger are node-local.** Replicating them would make any node a valid import target and give fleet-wide dedup. It is a candidate for a later release, not a defect — the current behaviour is safe, just node-scoped.
- **There is no automatic reconciliation between the manifest and storage.** Orphaned manifest entries are logged, not self-healed.
- **The scheduled sync agent is not in this release.** Passes are triggered manually; a cron job or a link-up hook on the spoke is the current answer.
