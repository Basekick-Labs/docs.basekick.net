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

:::info Arc Enterprise cluster mode (v26.06.1+)
In a multi-pod Arc Enterprise cluster, **only one pod prints the banner** — the Raft leader that wins the bootstrap election. Other pods log `INFO Deferring initial token bootstrap until cluster Raft proposer is wired` during startup and then `INFO Cluster auth state replication enabled — token writes now propagate via Raft` once the leader is elected. The non-leader pods silently no-op the bootstrap (they get an "already exists" response from the leader's FSM) and converge on the leader's token via Raft. The `kubectl logs -l app=arc | grep -i "admin"` command above still works — it just returns the single banner from whichever pod won the election. See [Cluster auth replication](/docs/configuration/authentication#cluster-auth-replication-enterprise) for the full semantics, including token-propagation behaviour and the divergence-detection error log.
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

The OSS chart selects the backend with `arc.storageBackend` (`local`, `s3`, or
`minio`). The chart auto-sets `ARC_STORAGE_BACKEND` and `ARC_STORAGE_LOCAL_PATH`;
everything else (bucket, region, keys, endpoint) is passed through as
`ARC_STORAGE_*` environment variables via the free-form `arc.env[]` list.

<Tabs>
  <TabItem value="pvc" label="Persistent Volume" default>

**Local disk on a Persistent Volume** - the default. The chart provisions a PVC
mounted at `/app/data/arc`.

```yaml
# values.yaml
arc:
  storageBackend: local

persistence:
  enabled: true
  size: 100Gi
  accessMode: ReadWriteOnce
  storageClass: ""        # default storage class
```

```bash
helm install arc ./arc -f values.yaml
```

  </TabItem>
  <TabItem value="s3" label="AWS S3">

**AWS S3** - recommended for EKS. Pass the S3 settings through `arc.env[]`.

```yaml
# values.yaml
arc:
  storageBackend: s3
  env:
    - name: ARC_STORAGE_S3_BUCKET
      value: arc-production
    - name: ARC_STORAGE_S3_REGION
      value: us-east-1
    - name: ARC_STORAGE_S3_USE_SSL
      value: "true"
```

```bash
helm install arc ./arc -f values.yaml
```

:::tip IRSA (recommended) — no static keys
The OSS chart never auto-injects S3 keys, so IRSA works by simply **omitting**
`ARC_STORAGE_S3_ACCESS_KEY` / `ARC_STORAGE_S3_SECRET_KEY` from `arc.env[]` and
attaching an IAM role to the ServiceAccount. Arc's AWS credential chain then
resolves the pod role automatically.

```yaml
arc:
  storageBackend: s3
  env:
    - name: ARC_STORAGE_S3_BUCKET
      value: arc-production
    - name: ARC_STORAGE_S3_REGION
      value: us-east-1
    # no access/secret key — resolved via the pod IAM role

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/arc-s3
```

Primary-S3 **query** reads via the credential chain require the Arc **26.06.2**
binary; on 26.06.1 IRSA authenticates writes but not query reads. Set
`image.tag: "26.06.2"` (once released) for full IRSA support.
:::

With static keys (not recommended — prefer IRSA):

```yaml
arc:
  storageBackend: s3
  env:
    - name: ARC_STORAGE_S3_BUCKET
      value: arc-production
    - name: ARC_STORAGE_S3_REGION
      value: us-east-1
    - name: ARC_STORAGE_S3_ACCESS_KEY
      value: your_key
    - name: ARC_STORAGE_S3_SECRET_KEY
      value: your_secret
```

  </TabItem>
  <TabItem value="minio" label="MinIO">

**MinIO** - self-hosted S3-compatible storage.

```yaml
# values.yaml
arc:
  storageBackend: minio
  env:
    - name: ARC_STORAGE_S3_ENDPOINT
      value: minio.minio-system.svc.cluster.local:9000
    - name: ARC_STORAGE_S3_BUCKET
      value: arc
    - name: ARC_STORAGE_S3_ACCESS_KEY
      value: minioadmin
    - name: ARC_STORAGE_S3_SECRET_KEY
      value: minioadmin123
    - name: ARC_STORAGE_S3_USE_SSL
      value: "false"
    - name: ARC_STORAGE_S3_PATH_STYLE
      value: "true"
```

Deploy with in-cluster MinIO:

```bash
# Install MinIO first
helm repo add minio https://charts.min.io/
helm install minio minio/minio --namespace minio-system --create-namespace

# Then install Arc
helm install arc ./arc -f values.yaml
```

  </TabItem>
</Tabs>

## Configuration Profiles

The OSS chart is a single Deployment. Arc's own settings (auth, WAL, log level,
ingest buffers, etc.) are passed as environment variables through `arc.env[]`,
not a structured `config:` block.

<Tabs>
  <TabItem value="dev" label="Development" default>

Minimal resources for development/testing:

```yaml
# values-dev.yaml
replicaCount: 1

resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1"

arc:
  storageBackend: local
  env:
    - name: ARC_AUTH_ENABLED
      value: "false"
    - name: ARC_LOG_LEVEL
      value: "debug"

persistence:
  enabled: true
  size: 10Gi
```

```bash
helm install arc ./arc -f values-dev.yaml
```

  </TabItem>
  <TabItem value="prod" label="Production">

Production-ready configuration backed by S3:

```yaml
# values-prod.yaml
replicaCount: 1

resources:
  requests:
    memory: "4Gi"
    cpu: "2"
  limits:
    memory: "16Gi"
    cpu: "8"

arc:
  storageBackend: s3
  env:
    - name: ARC_STORAGE_S3_BUCKET
      value: arc-production
    - name: ARC_STORAGE_S3_REGION
      value: us-east-1
    - name: ARC_AUTH_ENABLED
      value: "true"
    - name: ARC_LOG_LEVEL
      value: "info"

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/arc-s3

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: arc.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: arc-tls
      hosts:
        - arc.example.com
```

```bash
helm install arc ./arc -f values-prod.yaml --namespace arc
```

  </TabItem>
  <TabItem value="high-durability" label="High Durability">

Local disk on fast storage with WAL enabled:

```yaml
# values-durable.yaml
replicaCount: 1

resources:
  requests:
    memory: "8Gi"
    cpu: "4"
  limits:
    memory: "32Gi"
    cpu: "16"

arc:
  storageBackend: local
  env:
    - name: ARC_AUTH_ENABLED
      value: "true"
    - name: ARC_WAL_ENABLED
      value: "true"
    - name: ARC_LOG_LEVEL
      value: "info"

persistence:
  enabled: true
  size: 500Gi
  storageClass: fast-ssd     # use a fast storage class

nodeSelector:
  node-type: high-memory

tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "arc"
    effect: "NoSchedule"
```

```bash
helm install arc ./arc -f values-durable.yaml --namespace arc
```

:::note Env var names
Arc reads its configuration from `ARC_*` environment variables. Confirm exact
names against the [configuration reference](/arc/configuration/overview) before
relying on a specific key.
:::

  </TabItem>
</Tabs>

## Helm Values Reference

### Core Settings

```yaml
# Number of pod replicas (single Deployment).
replicaCount: 1

# Container image (tag defaults to the chart appVersion).
image:
  repository: ghcr.io/basekick-labs/arc
  tag: ""                # set "26.06.2" for full IRSA query-read support
  pullPolicy: IfNotPresent

imagePullSecrets: []

# Service configuration
service:
  type: ClusterIP
  port: 8000
```

### Resources

```yaml
resources: {}            # empty by default; set requests/limits as needed
  # requests:
  #   memory: "2Gi"
  #   cpu: "1"
  # limits:
  #   memory: "8Gi"
  #   cpu: "4"
```

### Storage

```yaml
arc:
  # local | s3 | minio. The chart sets ARC_STORAGE_BACKEND from this and
  # ARC_STORAGE_LOCAL_PATH automatically.
  storageBackend: local

  # Free-form env vars passed straight to the Arc container. Use ARC_STORAGE_*
  # for bucket/region/keys/endpoint, plus any other ARC_* settings.
  env: []
    # - name: ARC_STORAGE_S3_BUCKET
    #   value: arc-production
    # - name: ARC_STORAGE_S3_REGION
    #   value: us-east-1
    # - name: ARC_STORAGE_S3_ENDPOINT
    #   value: https://s3.us-east-1.amazonaws.com
    # - name: ARC_STORAGE_S3_ACCESS_KEY   # omit for IRSA
    #   value: ""
    # - name: ARC_STORAGE_S3_SECRET_KEY   # omit for IRSA
    #   value: ""
    # - name: ARC_STORAGE_S3_USE_SSL
    #   value: "true"
    # - name: ARC_STORAGE_S3_PATH_STYLE
    #   value: "false"

# PVC used when storageBackend is local (mounted at /app/data/arc).
persistence:
  enabled: true
  accessMode: ReadWriteOnce
  size: 10Gi
  storageClass: ""
  # existingClaim: ""
```

### Ingress

```yaml
ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: arc.local
      paths:
        - path: /
          pathType: Prefix
  tls: []
```

### Service Account

```yaml
serviceAccount:
  create: true
  automount: true
  name: ""
  annotations: {}        # eks.amazonaws.com/role-arn for IRSA on EKS
```

:::note Clustering & HA are Enterprise features
The OSS chart runs Arc as a single Deployment with no writer/reader/compactor
roles, Raft clustering, or multi-writer failover. For high availability,
multi-writer ingest, and peer replication see the
[Arc Enterprise Kubernetes guide](/arc-enterprise/installation/kubernetes).
:::

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

```bash
# Restart pod
kubectl rollout restart deployment arc

# Or delete pod (will be recreated)
kubectl delete pod -l app=arc
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

## Next Steps

- [Write your first data](/arc/getting-started#write-data)
- [Configure storage backends](/arc/configuration/overview)
- [Set up monitoring](/arc/operations/telemetry)
- [Enable WAL for durability](/arc/advanced/wal)
