---
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Kubernetes Installation

Deploy Arc on Kubernetes using Helm for production-grade analytical data management.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.0+
- `kubectl` configured to access your cluster
- Persistent storage (for local storage backend)

## Quick Start

```bash
# Install Arc
helm install arc https://github.com/basekick-labs/arc/releases/latest/download/arc-26.06.1.tgz

# Port forward to access locally
kubectl port-forward svc/arc 8000:8000

# Verify installation
curl http://localhost:8000/health
```

## Get Your Admin Token

```bash
# Get the pod name
kubectl get pods -l app=arc

# View logs to find admin token
kubectl logs -l app=arc | grep -i "admin"
```

You should see:

```
======================================================================
  FIRST RUN - INITIAL ADMIN TOKEN GENERATED
======================================================================
  Initial admin API token: arc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
======================================================================
```

:::warning Save This Token
Copy this token immediately - you won't see it again!
:::

## Installation Methods

<Tabs>
  <TabItem value="quick" label="Quick Install" default>

```bash
helm install arc https://github.com/basekick-labs/arc/releases/latest/download/arc-26.06.1.tgz
```

  </TabItem>
  <TabItem value="custom" label="Custom Values">

```bash
# Download chart
helm pull https://github.com/basekick-labs/arc/releases/latest/download/arc-26.06.1.tgz
tar -xzf arc-26.06.1.tgz

# Edit values
vim arc/values.yaml

# Install with custom values
helm install arc ./arc -f custom-values.yaml
```

  </TabItem>
  <TabItem value="namespace" label="Custom Namespace">

```bash
# Create namespace
kubectl create namespace arc

# Install in namespace
helm install arc \
  https://github.com/basekick-labs/arc/releases/latest/download/arc-26.06.1.tgz \
  --namespace arc
```

  </TabItem>
</Tabs>

## Storage Backends

<Tabs>
  <TabItem value="pvc" label="Local (Peer Replication)" default>

**Local storage** - each Arc node keeps its own PersistentVolume and the cluster
stays in sync via peer-to-peer replication (Pattern 1). No object storage is
required. Set `storage.mode: local` and size each role's PVC.

```yaml
# values.yaml
storage:
  mode: local
  local:
    storageClass: ""        # default storage class

minio:
  enabled: false            # no object storage in local mode

writer:
  replicas: 1
  persistence:
    size: 50Gi              # local Parquet + WAL
reader:
  replicas: 2
  persistence:
    size: 50Gi              # reader needs a full data replica
compactor:
  enabled: true
  replicas: 1
  persistence:
    size: 50Gi
```

```bash
helm install arc-ent helm/arc-enterprise -f values.yaml \
  --set license.key=ARC-ENT-... \
  --set cluster.sharedSecret.value=$(openssl rand -hex 32)
```

  </TabItem>
  <TabItem value="s3" label="AWS S3">

**AWS S3** - Recommended for EKS. Set `storage.mode: shared` and point the
shared block at your bucket. Authenticate with IRSA (preferred) or static keys.

**IRSA (recommended) — no static keys.** Set `credentials.useIRSA: true` so the
chart omits the access/secret-key env vars and Arc authenticates via the AWS
credential chain (the pod's IAM role), then attach the role to the
ServiceAccount:

```yaml
# values.yaml
storage:
  mode: shared
  shared:
    external: true                 # use your own S3 (not bundled MinIO)
    bucket: arc-production
    region: us-east-1
    endpoint: https://s3.us-east-1.amazonaws.com
    useSSL: true
    usePathStyle: false
    credentials:
      useIRSA: true                # authenticate via the pod IAM role

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/arc-s3

minio:
  enabled: false                   # don't deploy bundled MinIO
```

```bash
helm install arc ./arc -f values.yaml
```

:::tip IRSA requires Arc 26.06.2 for query reads
Primary-S3 **query** reads via the credential chain require the Arc **26.06.2**
binary. On 26.06.1 IRSA authenticates writes but not query reads — set
`image.tag: "26.06.2"` (once released) for full IRSA support. The IAM role's
trust policy must permit the cluster OIDC provider + this ServiceAccount, and
the role needs `s3:GetObject`/`PutObject`/`ListBucket` on the bucket. When the
chart creates the ServiceAccount, the install fails if the
`eks.amazonaws.com/role-arn` annotation is missing.
:::

**Static keys** (when IRSA is not available). Provide them inline or, better, via
an existing Secret with `access-key` / `secret-key` entries:

```yaml
storage:
  mode: shared
  shared:
    external: true
    bucket: arc-production
    region: us-east-1
    endpoint: https://s3.us-east-1.amazonaws.com
    useSSL: true
    credentials:
      existingSecret: arc-s3-credentials   # keys: access-key, secret-key
      # or inline: accessKey / secretKey
minio:
  enabled: false
```

  </TabItem>
  <TabItem value="minio" label="MinIO">

**MinIO** - Bundled S3-compatible storage (default for `storage.mode: shared`).

```yaml
# values.yaml
storage:
  mode: shared
  shared:
    external: false                # bundled MinIO (default)
    bucket: arc-data
    usePathStyle: true
    useSSL: false

minio:
  enabled: true
  credentials:
    rootUser: arcminio
    rootPassword: <strong-random>  # or set credentials.existingSecret
```

```bash
helm install arc ./arc -f values.yaml
```

:::note
`useIRSA` is only valid with external S3 (`external: true`). The bundled MinIO
needs static credentials — the chart rejects `useIRSA: true` with bundled MinIO.
:::

  </TabItem>
</Tabs>

The chart emits S3 config only (`ARC_STORAGE_BACKEND=s3`); point `endpoint` at
any S3-compatible service. For local-disk + peer replication instead of shared
object storage, use `storage.mode: local` (see
[Deployment Patterns](../configuration/deployment-patterns)).

## Configuration Profiles

The Enterprise chart ships two ready-to-deploy presets in the chart root:
`values-shared-storage.yaml` (shared object storage via bundled MinIO) and
`values-local-storage.yaml` (per-node PVCs + peer replication). Both require a
license key and a cluster shared secret.

<Tabs>
  <TabItem value="shared" label="Shared Storage (MinIO)" default>

Shared object storage with the bundled MinIO — the recommended cloud-native
layout. All writer pods accept writes concurrently (Pattern 2 multi-writer) and
read/write the same bucket; the bucket is the durability layer, so the writer
and compactor PVCs hold only WAL/scratch.

```yaml
# values-shared-storage.yaml (excerpt)
storage:
  mode: shared
  shared:
    external: false        # bundled MinIO
    bucket: arc-data
    usePathStyle: true
    useSSL: false

minio:
  enabled: true
  replicas: 1
  persistence:
    size: 100Gi

writer:
  replicas: 1              # 1 = single writer; 3 = HA (2 is refused)
  persistence:
    size: 20Gi            # WAL only; bucket holds Parquet

reader:
  replicas: 2             # emptyDir in shared mode (no PVC)

compactor:
  enabled: true
  replicas: 1
  persistence:
    size: 20Gi            # scratch only; bucket holds Parquet
```

```bash
helm install arc-ent helm/arc-enterprise \
  -f helm/arc-enterprise/values-shared-storage.yaml \
  --set license.key=ARC-ENT-... \
  --set cluster.sharedSecret.value=$(openssl rand -hex 32) \
  --set minio.credentials.rootUser=arcminio \
  --set minio.credentials.rootPassword=$(openssl rand -hex 32)
```

:::warning Required overrides
`license.key`, `cluster.sharedSecret.value`, and (for bundled MinIO)
`minio.credentials.rootUser` / `minio.credentials.rootPassword` are mandatory —
the chart refuses to install if any of them is empty.
:::

  </TabItem>
  <TabItem value="local" label="Local Storage (Peer Replication)">

Per-node PersistentVolumes with peer-to-peer replication (Pattern 1). Each node
keeps its own copy of the Parquet files; the Raft-backed cluster manifest is the
source of truth. Use this for bare metal, VMs, edge, or anywhere shared object
storage is unavailable. No MinIO is deployed.

```yaml
# values-local-storage.yaml (excerpt)
storage:
  mode: local

minio:
  enabled: false

writer:
  replicas: 1
  persistence:
    size: 50Gi            # local Parquet + WAL

reader:
  replicas: 2
  persistence:
    size: 50Gi            # reader needs a full data replica

compactor:
  enabled: true
  replicas: 1
  persistence:
    size: 50Gi            # local Parquet + scratch
```

```bash
helm install arc-ent helm/arc-enterprise \
  -f helm/arc-enterprise/values-local-storage.yaml \
  --set license.key=ARC-ENT-... \
  --set cluster.sharedSecret.value=$(openssl rand -hex 32)
```

:::tip Replication tuning
`cluster.replication.*` (pull workers, fetch/serve timeouts, startup catch-up)
applies **only** in local mode. In shared mode the bucket is the durability
layer and peer replication is disabled.
:::

  </TabItem>
  <TabItem value="external-s3" label="External S3">

Point shared mode at your own S3 (or any S3-compatible service) instead of the
bundled MinIO. See the [Storage Backends](#storage-backends) tabs above for the
full IRSA vs static-key options.

```yaml
storage:
  mode: shared
  shared:
    external: true                 # use your own S3 (not bundled MinIO)
    bucket: arc-production
    region: us-east-1
    endpoint: https://s3.us-east-1.amazonaws.com
    useSSL: true
    usePathStyle: false
    credentials:
      useIRSA: true                # authenticate via the pod IAM role

minio:
  enabled: false                   # don't deploy bundled MinIO

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/arc-s3
```

```bash
helm install arc-ent helm/arc-enterprise -f values.yaml \
  --set license.key=ARC-ENT-... \
  --set cluster.sharedSecret.value=$(openssl rand -hex 32)
```

  </TabItem>
</Tabs>

## Helm Values Reference

### Image & Service Account

```yaml
# Container image (tag defaults to the chart appVersion)
image:
  repository: ghcr.io/basekick-labs/arc
  tag: ""                # set "26.06.2" for full IRSA query-read support
  pullPolicy: IfNotPresent

imagePullSecrets: []

# ServiceAccount shared by all Arc pods (writer/reader/compactor).
# Attach an AWS IAM role via the role-arn annotation for IRSA.
serviceAccount:
  create: false          # true = chart creates the ServiceAccount
  name: ""
  annotations: {}        # eks.amazonaws.com/role-arn: arn:aws:iam::...:role/arc-s3
```

### License & Authentication

```yaml
license:
  existingSecret: ""     # Secret with key "license-key"
  key: ""                # your ARC-ENT-... license key (REQUIRED)

auth:
  bootstrapToken:
    existingSecret: ""   # Secret with key "bootstrap-token"
    value: ""            # leave empty to let the Raft leader generate one
```

### Cluster

```yaml
cluster:
  name: arc-prod

  # HMAC peer authentication — REQUIRED (chart refuses to install if empty).
  sharedSecret:
    existingSecret: ""   # Secret with key "shared-secret"
    value: ""            # REQUIRED — e.g. $(openssl rand -hex 32)

  # TLS between cluster nodes (recommended for multi-writer / production).
  tls:
    enabled: false
    existingSecret: ""   # tls.crt, tls.key (and optionally ca.crt)

  # Single switch governing writer + compactor failover.
  failover:
    enabled: true

  # Peer replication tuning — consulted ONLY when storage.mode=local.
  replication:
    pullWorkers: 4
    fetchTimeoutMs: 60000
    serveTimeoutMs: 120000
    catchup:
      enabled: true
      barrierTimeoutMs: 10000
```

### Storage

The chart supports two modes via `storage.mode`. It emits S3 config only
(`ARC_STORAGE_BACKEND=s3`); there is no Azure path.

```yaml
storage:
  mode: shared           # "shared" or "local"

  # Shared mode — S3-compatible object storage (bundled MinIO or external S3).
  shared:
    external: false      # false = bundled MinIO; true = your own S3
    bucket: arc-data
    region: us-east-1
    endpoint: ""         # auto-set for bundled MinIO; set for external S3
    prefix: ""           # optional key prefix (multi-tenant bucket sharing)
    usePathStyle: true   # true for MinIO and many S3-compatible services
    useSSL: false        # true for production S3
    credentials:
      useIRSA: false     # true = AWS credential chain (external S3 only)
      existingSecret: "" # keys: access-key, secret-key (ignored if useIRSA)
      accessKey: ""
      secretKey: ""

  # Local mode — per-node PVCs + peer replication.
  local:
    storageClass: ""     # fallback for roles that don't set their own
```

### Bundled MinIO

Rendered only when `storage.mode=shared` and `storage.shared.external=false`.

```yaml
minio:
  enabled: true
  replicas: 1
  persistence:
    size: 100Gi
    storageClass: ""
  credentials:
    existingSecret: ""   # keys: root-user, root-password
    rootUser: ""         # REQUIRED (no weak defaults)
    rootPassword: ""     # REQUIRED
```

### Roles (writer / reader / compactor)

Each role is a StatefulSet with its own replica count, resources, persistence,
and scheduling.

```yaml
writer:
  replicas: 1            # 3 = HA; 2 is REFUSED (no failure tolerance)
  resources:
    requests: { cpu: 500m, memory: 1Gi }
    limits:   { cpu: 4000m, memory: 8Gi }
  persistence:
    size: 20Gi           # shared mode: WAL only; local mode: WAL + Parquet
    storageClass: ""
  wal:
    enabled: true
    syncMode: fdatasync  # fdatasync | fsync | async
  nodeSelector: {}
  tolerations: []
  affinity: {}
  extraEnv: []           # extra env vars passed through to Arc

reader:
  replicas: 2            # scale horizontally for query throughput
  resources:
    requests: { cpu: 500m, memory: 1Gi }
    limits:   { cpu: 4000m, memory: 8Gi }
  persistence:
    size: 50Gi           # shared mode: emptyDir (no PVC); local mode: PVC
    storageClass: ""
  nodeSelector: {}
  tolerations: []
  affinity: {}
  extraEnv: []

compactor:
  enabled: true
  replicas: 1            # exactly one active compactor — failover replaces it
  resources:
    requests: { cpu: 1000m, memory: 4Gi }
    limits:   { cpu: 4000m, memory: 16Gi }
  persistence:
    size: 50Gi           # scratch space for compaction jobs
    storageClass: ""
  nodeSelector: {}
  tolerations: []
  affinity: {}
  extraEnv: []
```

### Services & Telemetry

```yaml
service:
  writer:
    type: ClusterIP
    port: 8000
    annotations: {}
  reader:
    type: ClusterIP      # expose via Ingress / annotated LoadBalancer
    port: 8000
    annotations: {}

# Disable for air-gapped / defense deployments.
telemetry:
  enabled: true
```

## Operations

### View Logs

```bash
# Follow logs
kubectl logs -l app=arc -f

# Last 100 lines
kubectl logs -l app=arc --tail=100

# Logs from last hour
kubectl logs -l app=arc --since=1h
```

### Check Status

```bash
# Pod status
kubectl get pods -l app=arc

# Describe pod
kubectl describe pod -l app=arc

# Check events
kubectl get events --field-selector involvedObject.name=arc-0
```

### Scale (Restart)

The Enterprise chart deploys each role as a StatefulSet (`writer`, `reader`,
`compactor`).

```bash
# Restart a role
kubectl rollout restart statefulset arc-ent-writer

# Or delete a pod (will be recreated)
kubectl delete pod -l app.kubernetes.io/component=writer
```

### Port Forward

```bash
kubectl port-forward svc/arc 8000:8000
```

### Access Shell

```bash
kubectl exec -it $(kubectl get pod -l app=arc -o jsonpath='{.items[0].metadata.name}') -- /bin/sh
```

## Upgrade

```bash
# Upgrade to new version
helm upgrade arc https://github.com/basekick-labs/arc/releases/latest/download/arc-26.06.1.tgz

# With custom values
helm upgrade arc ./arc -f values-prod.yaml
```

## Uninstall

```bash
# Uninstall Arc
helm uninstall arc

# Delete PVCs (optional - removes all data!)
kubectl delete pvc -l app=arc

# Delete namespace (if dedicated)
kubectl delete namespace arc
```

## Monitoring

### Prometheus Metrics

Arc exposes Prometheus metrics at `/metrics`:

```yaml
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: arc
spec:
  selector:
    matchLabels:
      app: arc
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

### Readiness/Liveness Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Troubleshooting

### Pod Won't Start

```bash
# Check pod status
kubectl describe pod -l app=arc

# Check events
kubectl get events --sort-by='.lastTimestamp'

# Common issues:
# - ImagePullBackOff: Check image name/tag
# - Pending: Check PVC status, node resources
# - CrashLoopBackOff: Check logs
```

### Storage Issues

```bash
# Check PVC status
kubectl get pvc -l app=arc

# Check PV
kubectl get pv

# Describe PVC for errors
kubectl describe pvc -l app=arc
```

### Connection Issues

```bash
# Check service
kubectl get svc arc

# Test from within cluster
kubectl run curl --image=curlimages/curl -it --rm -- curl http://arc:8000/health
```

### Memory Issues

```bash
# Check resource usage
kubectl top pod -l app=arc

# Increase limits in values.yaml
resources:
  limits:
    memory: "16Gi"
```

## High Availability (EKS)

In **shared mode** the Enterprise chart runs Arc as a Pattern 2 multi-writer
cluster: every writer pod accepts writes concurrently behind a Kubernetes
Service, and each writer PUTs to the same S3 bucket independently. Singleton
background tasks (retention, continuous queries, deletes) run on whichever pod
is the cluster Raft leader, so they execute exactly once.

Failover is Service-based: clients always talk to the writer Service, which
load-balances across healthy pods. If a writer pod dies, the Service stops
routing to it and Raft re-elects a leader for the singleton tasks — no client
URL changes.

Set `writer.replicas` to control the topology:

| `writer.replicas` | Behaviour |
|---|---|
| `1` | Single writer (lowest cost). The Service still fronts it, so client URLs are identical to the multi-writer case. No failure tolerance. |
| `3` | HA + horizontal scale. Raft quorum tolerates one pod failure; writes round-robin across all healthy pods. |
| `2` | **Refused by chart validation** — a quorum of 2 stalls Raft writes on any single-pod loss, so it offers no failure tolerance over `1`. |

In shared mode the reader uses `emptyDir` (no PVC — the bucket holds Parquet),
and writer/compactor PVCs are WAL/scratch only (~20Gi). In **local mode**
(Pattern 1), HA instead relies on per-node PVCs and peer replication, and the
reader needs a full data replica (~50Gi); `cluster.replication.*` tuning applies
only in this mode.

For the full topology comparison see
[Deployment Patterns](../configuration/deployment-patterns), and for the cluster
shared secret and inter-node TLS see
[Cluster Security](../security/cluster-security).

## Next Steps

- [Write your first data](/arc-enterprise/getting-started#write-your-first-data)
- [Configure storage backends](/arc-enterprise/configuration/overview)
- [Set up monitoring](/arc-enterprise/operations/monitoring)
- [Enable WAL for durability](/arc-enterprise/advanced/wal)
