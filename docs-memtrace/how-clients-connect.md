---
sidebar_position: 3
---

# How Clients Connect

A Memtrace client points at exactly two things: the **deployment URL** and an **API key**. That's it.

```python
from memtrace import Memtrace

client = Memtrace(
    base_url="https://memtrace.example.com",   # one per Memtrace deployment
    api_key="mtk_..."                            # one per organization
)

client.remember(agent_id="my_agent", content="...")
```

Clients never name an organization or an Arc instance. The API key carries the org identity opaquely — Memtrace resolves it server-side and routes the request to that org's Arc instance, with that org's database and that org's encrypted-and-decrypted Arc API key. Operators provision orgs and Arc bindings on the server with `memtrace org` and `memtrace key`; clients only see the resulting `mtk_...` string.

This is the same shape as Stripe, OpenAI, AWS — **the API key is the tenant credential.**

## What happens server-side

When a client sends a request:

1. The request includes `x-api-key: mtk_xxx` (or `Authorization: Bearer mtk_xxx`).
2. Memtrace's auth middleware looks up the key, finds it belongs to (say) `org_acme`, and pins `org_id = "org_acme"` into the request context.
3. The relevant manager (memory, agent, session) calls `arcRegistry.Get("org_acme")` → returns the Arc client configured for that org.
4. The read or write goes to that org's Arc instance with the right database name on the right URL.

The client knows nothing about steps 2–4. **Aura and Voya can both use the same Memtrace deployment URL with different keys, and their writes land in completely separate Arc databases — automatically.**

## One client process, multiple orgs

A single backend that needs to write on behalf of multiple Memtrace organizations holds one API key per org and routes between them in its own code. The SDK is unchanged — you just maintain a dict (or map) of clients keyed by org.

### Python

```python
from memtrace import Memtrace
import secrets_manager   # your secret store

class TenantClients:
    def __init__(self, base_url: str):
        self._base_url = base_url
        self._clients: dict[str, Memtrace] = {}

    def for_org(self, org_id: str) -> Memtrace:
        if org_id not in self._clients:
            api_key = secrets_manager.get(f"memtrace_key_{org_id}")
            self._clients[org_id] = Memtrace(self._base_url, api_key)
        return self._clients[org_id]


tenants = TenantClients("https://memtrace.example.com")

tenants.for_org("org_acme").remember(agent_id="...", content="...")
tenants.for_org("org_voya").remember(agent_id="...", content="...")
```

### TypeScript

```typescript
import { Memtrace } from '@basekick-labs/memtrace-sdk'

class TenantClients {
  private clients = new Map<string, Memtrace>()
  constructor(private baseURL: string) {}

  forOrg(orgId: string): Memtrace {
    if (!this.clients.has(orgId)) {
      const apiKey = secretsManager.get(`memtrace_key_${orgId}`)
      this.clients.set(orgId, new Memtrace(this.baseURL, apiKey))
    }
    return this.clients.get(orgId)!
  }
}

const tenants = new TenantClients('https://memtrace.example.com')
await tenants.forOrg('org_acme').remember('...', '...')
await tenants.forOrg('org_voya').remember('...', '...')
```

Each Memtrace API key is a tenant credential, the same way you'd hold per-tenant Stripe keys or per-tenant OpenAI keys.

## What clients cannot do

- **Override the Arc routing.** A client cannot say "this request goes to a different Arc." If a process needs to talk to two Arcs, it holds two API keys (above).
- **Pick which org to write to.** The org is implied by the API key, never by a request parameter or header. This keeps the security boundary tight: a compromised API key can only affect its own org.

These constraints aren't accidents — they're what makes the multi-tenant model safe.

## Operator workflow for a new tenant

```bash
# On the Memtrace server (admin CLI, requires MEMTRACE_MASTER_KEY)

memtrace org create acme
# Organization created
#   id:   org_a1b2c3d4...
#   name: acme

memtrace org add-arc org_a1b2c3d4... \
    --url https://arc-acme.example.com \
    --api-key <arc-api-key> \
    --database acme_memory

memtrace key create --org org_a1b2c3d4... --name acme-prod
# API key created (shown only once — save it now):
# mtk_...
```

The Acme team then uses `Memtrace("https://memtrace.example.com", "mtk_...")` — and every read and write lands in `arc-acme.example.com / acme_memory` automatically.

## What happens if the org has no Arc instance yet

If a key is bound to an org that has no `arc_instances` row, requests return:

```http
503 Service Unavailable
```
```json
{
  "error": "no arc instance configured for this org",
  "hint": "ask an admin to run `memtrace org add-arc <org_id>`"
}
```

The Python and TypeScript SDKs raise/reject `NoArcInstanceError` for this case (subclass of `MemtraceError`). The Go SDK returns an `*APIError` that satisfies `errors.Is(err, sdk.ErrNoArcInstance)`. Catch it explicitly if you want to differentiate "not provisioned yet" from a generic API failure.

## Summary

| The client provides | Memtrace resolves |
|---|---|
| Deployment URL (e.g. `https://memtrace.example.com`) | — |
| API key (`mtk_...`) | The owning `org_id`, that org's Arc URL, that org's Arc API key (decrypted), that org's database, that org's measurement |

That's the full multi-tenant routing model.
