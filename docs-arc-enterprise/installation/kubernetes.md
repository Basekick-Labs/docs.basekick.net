---
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Kubernetes Installation

Deploy Arc on Kubernetes using Helm for production-grade time-series data management.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.0+
- `kubectl` configured to access your cluster
- Persistent storage (for local storage backend)

## Quick Start

```bash
# Install Arc
helm install arc https://github.com/basekick-labs/arc/releases/latest/download/arc.tgz

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
helm install arc https://github.com/basekick-labs/arc/releases/latest/download/arc.tgz
```

  </TabItem>
  <TabItem value="custom" label="Custom Values">

```bash
# Download chart
helm pull https://github.com/basekick-labs/arc/releases/latest/download/arc.tgz
tar -xzf arc-25.12.1.tgz

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
  https://github.com/basekick-labs/arc/releases/latest/download/arc.tgz \
  --namespace arc
```

  </TabItem>
</Tabs>

## Storage Backends

<Tabs>
  <TabItem value="pvc" label="Persistent Volume" default>

**Persistent Volume Claim** - Default for Kubernetes.

```yaml
# values.yaml
storage:
  backend: local
  persistence:
    enabled: true
    size: 100Gi
    storageClass: ""  # Use default storage class
```

```bash
helm install arc ./arc -f values.yaml
```

  </TabItem>
  <TabItem value="s3" label="AWS S3">

**AWS S3** - Recommended for EKS deployments.

```yaml
# values.yaml
storage:
  backend: s3
  s3:
    bucket: arc-production
    region: us-east-1

# Use IAM Roles for Service Accounts (IRSA)
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/arc-s3-role
```

```bash
helm install arc ./arc -f values.yaml
```

:::tip IRSA (Recommended)
Use IAM Roles for Service Accounts instead of access keys for better security on EKS.
:::

With access keys (not recommended):

```yaml
storage:
  backend: s3
  s3:
    bucket: arc-production
    region: us-east-1
    accessKey: your_key
    secretKey: your_secret
```

  </TabItem>
  <TabItem value="minio" label="MinIO">

**MinIO** - Self-hosted S3-compatible storage.

```yaml
# values.yaml
storage:
  backend: minio
  s3:
    endpoint: minio.minio-system.svc.cluster.local:9000
    bucket: arc
    accessKey: minioadmin
    secretKey: minioadmin123
    useSSL: false
    pathStyle: true
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
  <TabItem value="azure" label="Azure Blob">

**Azure Blob Storage** - For AKS deployments.

```yaml
# values.yaml
storage:
  backend: azure
  azure:
    container: arc-data
    accountName: your_account
    accountKey: your_key
    # Or use managed identity:
    # useManagedIdentity: true
```

:::tip Managed Identity
Use Azure Workload Identity for keyless authentication on AKS.
:::

  </TabItem>
</Tabs>

## Configuration Profiles

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

storage:
  backend: local
  persistence:
    enabled: true
    size: 10Gi

config:
  auth:
    enabled: false
  compaction:
    enabled: false
  wal:
    enabled: false
  log:
    level: debug
```

```bash
helm install arc ./arc -f values-dev.yaml
```

  </TabItem>
  <TabItem value="prod" label="Production">

Production-ready configuration:

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

storage:
  backend: s3
  s3:
    bucket: arc-production
    region: us-east-1

config:
  auth:
    enabled: true
  compaction:
    enabled: true
    hourlyEnabled: true
    dailyEnabled: true
  wal:
    enabled: false  # S3 provides durability
  log:
    level: info
    format: json
  ingest:
    maxBufferSize: 100000
    maxBufferAgeMs: 10000

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/arc-s3-role

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

podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

```bash
helm install arc ./arc -f values-prod.yaml --namespace arc
```

  </TabItem>
  <TabItem value="high-durability" label="High Durability">

Zero data loss configuration with WAL:

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

storage:
  backend: local
  persistence:
    enabled: true
    size: 500Gi
    storageClass: fast-ssd  # Use fast storage class

config:
  auth:
    enabled: true
  compaction:
    enabled: true
    hourlyEnabled: true
    dailyEnabled: true
  wal:
    enabled: true
    syncMode: fdatasync
    maxSizeMb: 1000
    maxAgeSeconds: 3600
  log:
    level: info
    format: json

# Separate volume for WAL (recommended)
walVolume:
  enabled: true
  size: 100Gi
  storageClass: ultra-fast-ssd  # NVMe if available

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

  </TabItem>
</Tabs>

## Helm Values Reference

### Core Settings

```yaml
# Number of replicas (only 1 supported currently)
replicaCount: 1

# Container image
image:
  repository: ghcr.io/basekick-labs/arc
  tag: "25.12.1"
  pullPolicy: IfNotPresent

# Service configuration
service:
  type: ClusterIP
  port: 8000
```

### Resources

```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1"
  limits:
    memory: "8Gi"
    cpu: "4"
```

### Storage

```yaml
storage:
  backend: local  # local, s3, minio, azure

  # For local storage
  persistence:
    enabled: true
    size: 100Gi
    storageClass: ""
    accessModes:
      - ReadWriteOnce

  # For S3/MinIO
  s3:
    bucket: ""
    region: ""
    endpoint: ""
    accessKey: ""
    secretKey: ""
    useSSL: true
    pathStyle: false

  # For Azure
  azure:
    container: ""
    accountName: ""
    accountKey: ""
    useManagedIdentity: false
```

### Arc Configuration

```yaml
config:
  server:
    port: 8000

  log:
    level: info    # debug, info, warn, error
    format: json   # json, console

  database:
    maxConnections: 28
    memoryLimit: "8GB"
    threadCount: 14

  auth:
    enabled: true

  compaction:
    enabled: true
    hourlyEnabled: true
    hourlyMinAgeHours: 0
    hourlyMinFiles: 5
    dailyEnabled: false

  wal:
    enabled: false
    syncMode: fdatasync
    maxSizeMb: 500
    maxAgeSeconds: 3600

  ingest:
    maxBufferSize: 50000
    maxBufferAgeMs: 5000

  retention:
    enabled: true

  continuousQuery:
    enabled: true
```

### Ingress

```yaml
ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts:
    - host: arc.example.com
      paths:
        - path: /
          pathType: Prefix
  tls: []
```

### Service Account

```yaml
serviceAccount:
  create: true
  name: ""
  annotations: {}
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
helm upgrade arc https://github.com/basekick-labs/arc/releases/latest/download/arc.tgz

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

- [Write your first data](/arc-enterprise/getting-started#write-your-first-data)
- [Configure storage backends](/arc-enterprise/configuration/overview)
- [Set up monitoring](/arc-enterprise/operations/monitoring)
- [Enable WAL for durability](/arc-enterprise/advanced/wal)
