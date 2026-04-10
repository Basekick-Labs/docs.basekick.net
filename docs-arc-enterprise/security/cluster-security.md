---
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Cluster Security

Secure inter-node communication in Arc Enterprise clusters with shared secret authentication and TLS encryption.

## Overview

Arc Enterprise clustering supports two complementary security layers:

- **Shared secret authentication** — Prevents unauthorized nodes from joining the cluster using HMAC-SHA256 challenge-response
- **TLS encryption** — Encrypts all inter-node traffic including coordinator messages, WAL replication, shard replication, and Raft consensus

Both features are opt-in and can be used independently or together. When disabled, cluster behavior is unchanged from previous versions.

:::tip Recommended Configuration
For production deployments, enable **both** shared secret and TLS. The shared secret prevents unauthorized joins, while TLS encrypts all traffic between nodes. Using shared secret without TLS means the HMAC tokens are visible on the network.
:::

## Shared Secret Authentication

When a shared secret is configured, every node joining the cluster must prove it knows the secret. The joining node computes an HMAC-SHA256 signature over a random nonce, its node ID, the cluster name, and a timestamp. The leader validates the signature before accepting the join.

- Timestamps are checked within a 5-minute tolerance to prevent replay attacks
- The shared secret itself is never sent over the network — only the HMAC signature
- All nodes in the cluster must be configured with the same secret

### Configuration

<Tabs>
<TabItem value="toml" label="TOML">

```toml
[cluster]
enabled = true
cluster_name = "production"
shared_secret = "my-secure-cluster-secret-key"
```

</TabItem>
<TabItem value="env" label="Environment Variables">

```bash
ARC_CLUSTER_ENABLED=true
ARC_CLUSTER_CLUSTER_NAME=production
ARC_CLUSTER_SHARED_SECRET=my-secure-cluster-secret-key
```

</TabItem>
</Tabs>

:::warning Secret Management
Use a strong, randomly generated secret (at least 32 characters). Store it securely using environment variables or a secrets manager — avoid committing it to version control. In Kubernetes, use a Secret resource and reference it in your pod spec.
:::

### What Happens on Join

1. The joining node generates a cryptographically random nonce (32 bytes)
2. It computes `HMAC-SHA256(secret, nonce:nodeID:clusterName:timestamp)`
3. The nonce, timestamp, and HMAC are included in the join request
4. The leader recomputes the HMAC with its own copy of the secret
5. If the HMACs match and the timestamp is within tolerance, the join is accepted
6. If not, the join is rejected with an authentication error

## TLS Encryption

When TLS is enabled, all inter-node TCP connections are encrypted. This covers:

| Connection | Description |
|-----------|-------------|
| Coordinator listener | Accepts join requests, heartbeats, and leave notifications |
| Coordinator dialer | Connects to seed nodes during cluster discovery |
| WAL replication | Streams write-ahead log entries from writer to reader nodes |
| Shard replication sender | Sends shard data to replica nodes |
| Shard replication receiver | Receives shard data from primary nodes |
| Raft consensus | Leader election and log replication between voters |
| Shard Raft | Per-shard leader election and consensus |

### Configuration

<Tabs>
<TabItem value="toml" label="TOML">

```toml
[cluster]
enabled = true
cluster_name = "production"
shared_secret = "my-secure-cluster-secret-key"

# TLS for inter-node communication
tls_enabled = true
tls_cert_file = "/etc/arc/cluster-cert.pem"
tls_key_file = "/etc/arc/cluster-key.pem"
tls_ca_file = "/etc/arc/cluster-ca.pem"    # Optional: for mutual TLS
```

</TabItem>
<TabItem value="env" label="Environment Variables">

```bash
ARC_CLUSTER_ENABLED=true
ARC_CLUSTER_CLUSTER_NAME=production
ARC_CLUSTER_SHARED_SECRET=my-secure-cluster-secret-key

# TLS for inter-node communication
ARC_CLUSTER_TLS_ENABLED=true
ARC_CLUSTER_TLS_CERT_FILE=/etc/arc/cluster-cert.pem
ARC_CLUSTER_TLS_KEY_FILE=/etc/arc/cluster-key.pem
ARC_CLUSTER_TLS_CA_FILE=/etc/arc/cluster-ca.pem
```

</TabItem>
</Tabs>

### Configuration Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `tls_enabled` | `false` | Enable TLS for all inter-node communication |
| `tls_cert_file` | — | Path to the TLS certificate file (PEM format). Required when `tls_enabled=true`. |
| `tls_key_file` | — | Path to the TLS private key file (PEM format). Required when `tls_enabled=true`. |
| `tls_ca_file` | — | Optional CA certificate for verifying peer certificates. When set, enables mutual TLS (mTLS) — each node verifies the other's certificate against this CA. |

### Certificate Requirements

- TLS 1.2 minimum is enforced
- Certificates must be in PEM format
- Arc validates certificates at startup:
  - **Expired certificates** generate a warning but do not block startup, allowing operators to rotate without downtime
  - **Certificates expiring within 30 days** generate an early warning
- When `tls_ca_file` is set, both client and server sides verify peer certificates against the CA

## Generating Certificates

For testing or internal deployments, you can generate self-signed certificates:

```bash
# Generate a CA key and certificate
openssl genrsa -out cluster-ca-key.pem 4096
openssl req -new -x509 -key cluster-ca-key.pem -sha256 \
  -subj "/CN=arc-cluster-ca" -days 3650 -out cluster-ca.pem

# Generate a node certificate signed by the CA
openssl genrsa -out cluster-key.pem 4096
openssl req -new -key cluster-key.pem \
  -subj "/CN=arc-cluster-node" -out cluster.csr

# Sign with the CA (include SANs for all node addresses)
openssl x509 -req -in cluster.csr \
  -CA cluster-ca.pem -CAkey cluster-ca-key.pem -CAcreateserial \
  -days 365 -sha256 \
  -extfile <(printf "subjectAltName=DNS:*.arc-cluster.svc.cluster.local,DNS:localhost,IP:127.0.0.1") \
  -out cluster-cert.pem
```

:::tip Kubernetes Deployments
Use a wildcard SAN like `*.arc-cluster.svc.cluster.local` to cover all pods in a headless Service. This way, certificates remain valid when pods are rescheduled to different Kubernetes nodes. Avoid using pod IPs in SANs — they change on every reschedule.
:::

For production, use your organization's PKI or a tool like [cert-manager](https://cert-manager.io/) to automate certificate issuance and rotation.

## Kubernetes Deployment Example

In Kubernetes, store the shared secret and TLS certificates as Secrets and mount them into the pod:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: arc-cluster-secret
type: Opaque
stringData:
  shared-secret: "your-strong-random-secret-here"
---
apiVersion: v1
kind: Secret
metadata:
  name: arc-cluster-tls
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
  ca.crt: <base64-encoded-ca>
```

Reference in your StatefulSet or Deployment:

```yaml
containers:
  - name: arc
    env:
      - name: ARC_CLUSTER_SHARED_SECRET
        valueFrom:
          secretKeyRef:
            name: arc-cluster-secret
            key: shared-secret
      - name: ARC_CLUSTER_TLS_ENABLED
        value: "true"
      - name: ARC_CLUSTER_TLS_CERT_FILE
        value: "/etc/arc-tls/tls.crt"
      - name: ARC_CLUSTER_TLS_KEY_FILE
        value: "/etc/arc-tls/tls.key"
      - name: ARC_CLUSTER_TLS_CA_FILE
        value: "/etc/arc-tls/ca.crt"
    volumeMounts:
      - name: cluster-tls
        mountPath: /etc/arc-tls
        readOnly: true
volumes:
  - name: cluster-tls
    secret:
      secretName: arc-cluster-tls
```

## Troubleshooting

### Join rejected: shared secret required

The leader has `shared_secret` configured but the joining node does not. Ensure all nodes use the same `shared_secret` value.

### Join rejected: authentication failed

The joining node's shared secret does not match the leader's, or the system clocks are more than 5 minutes apart. Verify the secret is identical on all nodes and that NTP is configured.

### TLS handshake failure

- Verify certificate and key files exist and are readable by the Arc process
- Check that certificates are not expired (`openssl x509 -in cert.pem -noout -dates`)
- If using mutual TLS (`tls_ca_file`), ensure all nodes' certificates are signed by the same CA

### Certificate expiration warnings at startup

Arc logs a warning if the cluster TLS certificate expires within 30 days. Rotate the certificate before it expires to avoid connection failures. If using cert-manager, configure automatic renewal.

## Next Steps

- [Clustering & High Availability](/arc-enterprise/configuration/clustering) — Node roles, Raft consensus, and deployment patterns
- [RBAC](/arc-enterprise/security/rbac) — Role-based access control for API authentication
- [Audit Logging](/arc-enterprise/security/audit-logging) — Track cluster operations for compliance
