---
sidebar_position: 2
---

# Configuration

All configuration is via environment variables. The only strictly required one is `LAUNCHPAD_JWT_SECRET`, without which the app refuses to start in production. Everything else has a sensible default or is optional. Email can also be configured in the UI (first-run wizard or **Settings → Email**), which is stored in the database and takes precedence over the email env vars.

## Required

| Variable | Purpose |
|---|---|
| `LAUNCHPAD_JWT_SECRET` | Secret used to sign session JWTs. Generate one with `openssl rand -hex 32`. **The app won't start in production without it.** |

## Recommended

| Variable | Default | Purpose |
|---|---|---|
| `LAUNCHPAD_BASE_URL` | `http://localhost:5173` | Public base URL of this deployment. Used for links in emails and as the WebAuthn (passkey) origin. Set it to the URL users actually visit. |
| `LAUNCHPAD_DB_PATH` | `./data/launchpad.db` | Path to the SQLite database file. The Docker image sets this to `/app/data/launchpad.db`. |
| `LAUNCHPAD_DOMAIN` | `arc.localhost` | Display domain shown in the UI. |
| `LAUNCHPAD_ALLOW_PRIVATE_ENDPOINTS` | `false` | Allow registering Arc endpoints on private/localhost addresses. See [below](#private-endpoints). |

:::warning Get `LAUNCHPAD_BASE_URL` right
This one value drives several behaviors that silently break if it's wrong for how you serve the app:

- **Session cookies**: the `secure` flag tracks the URL's scheme. On a plain-HTTP deployment served over `http://`, `secure` is off so the cookie persists; a mismatch can make login "succeed" then bounce back to the login page.
- **CSRF / `ORIGIN`**: the Docker image derives `ORIGIN` from `LAUNCHPAD_BASE_URL`; a wrong value causes form actions (including finishing setup) to fail with a 403.
- **Passkeys & email links**: WebAuthn is bound to this origin, and email links are built from it.

Set it to the exact scheme + host + port users hit (e.g. `http://localhost:3000` or `https://launchpad.example.com`).
:::

## adapter-node / reverse proxy

Launchpad is a SvelteKit app built with `adapter-node`. It validates the `Origin` header on POST form submissions (CSRF). The Docker image handles this automatically by deriving `ORIGIN` from `LAUNCHPAD_BASE_URL`. For other cases:

| Variable | Purpose |
|---|---|
| `ORIGIN` | The public origin, e.g. `http://localhost:3000`. Set this if you run `node build` directly (not via the Docker image). |
| `PROTOCOL_HEADER` | e.g. `x-forwarded-proto`, for a reverse proxy that terminates TLS and forwards the original scheme. |
| `HOST_HEADER` | e.g. `x-forwarded-host`, for a reverse proxy that rewrites the host. |
| `PORT` | Port the server listens on. Default `3000`. |

See the [adapter-node environment variables](https://svelte.dev/docs/kit/adapter-node#Environment-variables-ORIGIN) reference for details.

## Private endpoints

By default Launchpad **rejects** Arc endpoints that resolve to a private, loopback, or link-local address (`localhost`, `127.0.0.1`, `10.x`, `192.168.x`, `*.internal`, cloud metadata, …). This is an SSRF safeguard: the built-in proxy forwards requests to whatever endpoint you register, so untrusted endpoints must not be able to reach internal services.

Set `LAUNCHPAD_ALLOW_PRIVATE_ENDPOINTS=true` only when your Arc server is intentionally on a private network reachable from the Launchpad host (e.g. the same box, the same Docker network, or the same Kubernetes cluster). Even when enabled, the proxy still resolves-and-pins the target IP per request, so it stays safe against DNS rebinding.

## Email (optional)

Email is normally configured in the UI. As an alternative, operators can set it via env vars (the DB setting wins if both are present). Without any email config, transactional emails (invites, verification, password reset) are **printed to the server console** instead of being sent.

**Mailgun:**

| Variable | Purpose |
|---|---|
| `MAILGUN_API_KEY` | Mailgun API key. |
| `MAILGUN_DOMAIN` | Sending domain. |
| `MAILGUN_API_URL` | `https://api.mailgun.net` (US) or `https://api.eu.mailgun.net` (EU). |

**SMTP (any provider):**

| Variable | Purpose |
|---|---|
| `SMTP_HOST` | SMTP server host. |
| `SMTP_PORT` | Port. Default `587`. |
| `SMTP_SECURE` | `true` for port 465 (implicit TLS), else `false`. |
| `SMTP_USER` / `SMTP_PASS` | Credentials. |
| `EMAIL_FROM` | From header, e.g. `Arc Launchpad <noreply@example.com>`. |

## Other optional integrations

| Variable | Purpose |
|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile CAPTCHA on signup. Skipped if unset. |
| `GCHAT_OPS_WEBHOOK_URL` | Google Chat webhook for ops alerting on silent server-side failures. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in. Optional. |

## Put it behind TLS

For anything beyond local testing, run Launchpad behind a reverse proxy that terminates TLS, and set `LAUNCHPAD_BASE_URL` to your public HTTPS URL so cookies, CSRF, email links, and passkey origins all line up. If you're already using Traefik for Arc, the same pattern extends cleanly to Launchpad; see the [Traefik + Let's Encrypt guide](https://basekick.net/blog/arc-traefik).
