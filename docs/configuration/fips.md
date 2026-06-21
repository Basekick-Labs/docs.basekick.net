---
sidebar_position: 3
---

# FIPS 140-3 Mode

Arc ships an optional **FIPS build variant** (`arc-fips`) for US federal, defense,
aerospace, and other regulated environments that require validated cryptography.

:::info Availability
The `arc-fips` build variant is available **since Arc 26.06.2**. Every release from
26.06.2 onward publishes `arc-fips` artifacts alongside the standard ones.
:::

## Why it exists

Many US government, defense, and regulated deployments are contractually required
(under FIPS 140-2/3, FedRAMP, NIST SP 800-171 / CMMC, and similar) to run software
whose cryptography comes from a **validated cryptographic module**. The standard
Arc build uses Go's cryptography, which is correct and modern but is not, by
default, operated as a FIPS-validated module. The `arc-fips` variant closes that
gap: it is compiled against the **CMVP-certified Go Cryptographic Module** and runs
it in FIPS-only mode, so an auditor can trace every cryptographic operation to a
validated module. If you have no FIPS/compliance requirement, use the standard
build — it is the right default for everyone else.

The FIPS variant is the **same Arc, at the same version, from the same commit** as
the standard build — it is not a separate product, a different feature set, or a
separate version line. Only the build is different.

:::info FIPS is a build variant, not a version
`arc-fips` reports the same version as the standard build (for example `26.06.2`).
You identify it by its artifact name (`arc-fips-…`, image tag `:VERSION-fips`) and
by `"fips_mode":true` in its startup log — never by a different version number.
:::

## Standard build vs `arc-fips`

| | Standard `arc` | `arc-fips` |
|---|---|---|
| Features / API / wire format | identical | identical |
| Version string | `26.06.2` | `26.06.2` (same) |
| Performance build tag | `duckdb_arrow` | `duckdb_arrow` (same) |
| Cryptographic module | Go crypto (not operated as validated) | **CMVP-certified Go Cryptographic Module**, FIPS-only |
| TLS cipher suites / curves | Go defaults (incl. X25519) | FIPS-approved only (AES-GCM, NIST P-curves; no X25519) |
| API-token hashing | bcrypt (and legacy SHA-256) | **PBKDF2-HMAC-SHA256** only |
| Startup if not in FIPS mode | n/a | **refuses to start** (fails closed) |
| Artifact name | `arc-linux-*`, image `:26.06.2` | `arc-fips-linux-*`, image `:26.06.2-fips` |
| Who it's for | everyone (default) | FIPS / regulated deployments only |

Both are signed (cosign) with SLSA provenance, and both ship `.deb`/`.rpm`
packages, container images, and SBOMs.

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

:::note GODEBUG: `fips140=only` vs `fips140=on`
The `arc-fips` binary bakes in `GODEBUG=fips140=only` (the strict mode — calls to
non-approved algorithms fail). The startup check (`fips_mode:true`) confirms the
module is *active*, but Go's runtime exposes no API to distinguish `only` from the
weaker `on` mode, so an operator who explicitly sets `GODEBUG=fips140=on` in the
process environment would override the baked-in `only` without the log changing.
For an auditable deployment, do **not** set `GODEBUG=fips140=*` in the
environment — leave the binary's compiled-in `only` default in place — and verify
no such override exists in your unit files / container env. (Setting
`fips140=off` is still caught: the process refuses to start.)
:::

## Upgrading from standard `arc` to `arc-fips`

:::warning Switching to `arc-fips` requires rotating all API tokens
This is the one operational gotcha when moving an existing deployment from the
standard build to `arc-fips`. Plan for it before you cut over.
:::

API tokens created by the **standard** build are stored as bcrypt hashes (and
pre-v26 tokens as SHA-256). The FIPS build **refuses to verify** those hashes — it
denies the request (and logs the reason at debug level), because verifying them
would use a non-FIPS-approved algorithm. **Tokens that worked on the standard
build will be rejected on `arc-fips` until they are rotated.**

To cut over:

1. Bring up the `arc-fips` build pointed at the same data.
2. **Rotate (recreate) every API token.** New tokens are stored as PBKDF2 hashes
   automatically and work immediately.
3. Update any clients/automation with the new token values.

Tokens are random 256-bit values that Arc never stores in plaintext, so existing
bcrypt hashes **cannot** be migrated in place — rotation is the only path. The
`/usr/bin/arc` path, `arc.service`, config, and data directory are otherwise
unchanged, so the rest of the upgrade is a normal binary/image swap.

Going the other direction (`arc-fips` → standard) needs no token rotation — the
standard build verifies PBKDF2 hashes too.

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
