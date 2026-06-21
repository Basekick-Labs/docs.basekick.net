---
sidebar_position: 3
---

# FIPS 140-3 Mode

Arc ships an optional **FIPS build variant** (`arc-fips`) for US federal, defense,
aerospace, and other regulated environments that require validated cryptography.

The FIPS variant is the **same Arc, at the same version, from the same commit** as
the standard build — it is not a separate product or version line. It is compiled
with a `fips` build tag against the CMVP-certified Go Cryptographic Module and runs
that module in FIPS-only mode.

:::info FIPS is a build variant, not a version
`arc-fips` reports the same version as the standard build (for example `26.06.2`).
You identify it by its artifact name (`arc-fips-…`, image tag `:VERSION-fips`) and
by `"fips_mode":true` in its startup log — never by a different version number.
:::

## What the FIPS build enforces

- **Validated cryptographic module.** Built with `GOFIPS140=v1.0.0`, the
  CMVP-certified Go Cryptographic Module snapshot. The module runs its power-on
  self-tests at process start.
- **FIPS-only runtime.** `GODEBUG=fips140=only` is baked into the binary, so
  non-approved standard-library crypto fails closed. The binary **refuses to
  start** if it is not actually running in FIPS mode.
- **Approved TLS only.** The API, cluster, and MQTT TLS paths are restricted to
  FIPS-approved cipher suites and elliptic curves (TLS 1.2+; AES-GCM; P-256/384/521).
- **Approved password hashing.** API-token hashing uses PBKDF2-HMAC-SHA256
  (FIPS-approved) instead of bcrypt.
- **No non-approved crypto linked.** The FIPS binary contains no bcrypt/Blowfish
  code; this is verified in CI by an import-graph check.

## Cryptographic boundary

All cryptography in Arc is provided by the Go Cryptographic Module. DuckDB and
SQLite perform **no** cryptography — SQLite is used for token *storage*, not
encryption — and are outside the module boundary.

## Installing the FIPS build

The FIPS variant ships alongside the standard build in every release. Pick the
`-fips` artifact instead of the standard one.

### Binary

```bash
# Download arc-fips-linux-amd64 (or -arm64) from the GitHub release, then verify:
cosign verify-blob arc-fips-linux-amd64 \
  --bundle arc-fips-linux-amd64.bundle \
  --certificate-identity-regexp "^https://github.com/Basekick-Labs/arc/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

### Container

```bash
# Same repo as the standard image, with a -fips tag suffix:
docker pull ghcr.io/basekick-labs/arc:VERSION-fips
# or: docker pull basekicklabs/arc:VERSION-fips

cosign verify ghcr.io/basekick-labs/arc:VERSION-fips \
  --certificate-identity-regexp "^https://github.com/Basekick-Labs/arc/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

### Kubernetes (Helm)

Set the image tag to the `-fips` variant:

```yaml
image:
  repository: ghcr.io/basekick-labs/arc
  tag: VERSION-fips
```

### Confirming FIPS mode

On startup the FIPS build logs:

```json
{"level":"info","version":"26.06.2","fips_mode":true,"message":"Starting Arc..."}
```

If `fips_mode` is `false` on an `arc-fips` binary, the process exits — it will not
run outside FIPS mode.

## Token rotation on cutover (required)

API tokens created by a **non-FIPS** build are stored as bcrypt hashes. The FIPS
build **refuses to verify** bcrypt (and legacy SHA-256) hashes — it logs a
"rotate this token" warning and denies the request, because verifying them would
use a non-approved algorithm.

When moving an existing deployment to the FIPS build:

1. Bring up the FIPS build.
2. **Rotate (recreate) every API token.** New tokens are stored as PBKDF2 hashes
   automatically.

Tokens are random 256-bit values that Arc never stores in plaintext, so existing
bcrypt hashes cannot be migrated in place — rotation is the only path.

## Arc Enterprise

Arc Enterprise customers get FIPS by running the `arc-fips` build with their
license key (`ARC_ENTERPRISE_LICENSE`). There is no separate enterprise FIPS
binary — Enterprise FIPS is `arc-fips` + license.

## CMVP status

:::warning Read this before making a compliance claim
Arc's FIPS build is compiled against the **CMVP-certified** Go Cryptographic
Module v1.0.0. This means the *cryptographic module* is validated. **Arc itself is
not a CMVP-listed module**, and this is **not** a statement that "Arc is FIPS 140-3
validated." Confirm the live certificate number on the
[NIST CMVP Validated Modules list](https://csrc.nist.gov/projects/cryptographic-module-validation-program)
before relying on it in an accreditation package.
:::
