---
sidebar_position: 2
---

# Getting Started

Get Memtrace up and running in minutes, then provision your first organization and Arc instance.

## Prerequisites

- A running [Arc](https://github.com/Basekick-Labs/arc) instance (one or more — Memtrace is multi-tenant and can route different orgs to different Arc instances)
- One of:
  - **Docker** (easiest) — see below
  - **A Linux server** for the `.deb` / `.rpm` package
  - **Go 1.25+** if you're building from source

## 1. Install

### Docker

```bash
docker pull ghcr.io/basekick-labs/memtrace:0.2.0
```

### Debian / Ubuntu (amd64, arm64)

```bash
wget https://github.com/Basekick-Labs/memtrace/releases/download/v0.2.0/memtrace_0.2.0_amd64.deb
sudo dpkg -i memtrace_0.2.0_amd64.deb
```

### RHEL / Fedora / Rocky (x86_64, aarch64)

```bash
wget https://github.com/Basekick-Labs/memtrace/releases/download/v0.2.0/memtrace-0.2.0-1.x86_64.rpm
sudo rpm -i memtrace-0.2.0-1.x86_64.rpm
```

### From source

```bash
git clone https://github.com/Basekick-Labs/memtrace.git
cd memtrace
make build
```

## 2. Generate a master key

Memtrace encrypts each org's Arc API key at rest using AES-256-GCM. The 32-byte master key comes from the `MEMTRACE_MASTER_KEY` environment variable. Generate one once and put it in your secret manager — losing it makes encrypted secrets unrecoverable.

```bash
export MEMTRACE_MASTER_KEY=$(memtrace keygen master)
```

The same value must be available to both `memtrace serve` and any `memtrace` admin CLI invocation (org/key management).

## 3. Run the server

The default `memtrace.toml` works as-is.

### Docker

```bash
docker run -d --name memtrace -p 9100:9100 \
  -e MEMTRACE_MASTER_KEY="$MEMTRACE_MASTER_KEY" \
  -v memtrace-data:/app/data \
  ghcr.io/basekick-labs/memtrace:0.2.0
```

### .deb / .rpm package

```bash
# 1. Set MEMTRACE_MASTER_KEY in /etc/memtrace/environment
sudo $EDITOR /etc/memtrace/environment

# 2. Start
sudo systemctl enable --now memtrace
sudo systemctl status memtrace
```

### From source

```bash
./memtrace serve
# (or just `./memtrace` — `serve` is the default subcommand)
```

On first run with auth enabled, Memtrace prints your admin API key for the bootstrap org. **Save it — it's shown only once.**

```
FIRST RUN: Save your admin API key (shown only once)
API Key: mtk_...
```

## 4. Provision an organization and Arc instance

If this is a fresh install, the bootstrap org (`org_default`) has no Arc instance yet — bind one:

```bash
memtrace org add-arc org_default \
    --url http://localhost:8000 \
    --api-key <arc-api-key> \
    --database memory
```

To run multiple tenants on the same Memtrace deployment, create another org and point it at a different Arc:

```bash
memtrace org create acme
# Organization created
#   id:   org_a1b2c3d4...

memtrace org add-arc org_a1b2c3d4... \
    --url https://arc-acme.example.com \
    --api-key <arc-api-key> \
    --database acme_memory

memtrace key create --org org_a1b2c3d4... --name acme-prod
# API key created (shown only once — save it now):
# mtk_...
```

Each API key is bound to one org, and every authenticated request is routed automatically to that org's Arc instance.

> See [How clients connect](./how-clients-connect.md) for the per-org-API-key model in depth.

## 5. Your first API call

### Store a memory

```bash
curl -X POST http://localhost:9100/api/v1/memories \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my_agent",
    "content": "Crawled https://example.com — found 3 product pages",
    "memory_type": "episodic",
    "event_type": "page_crawled",
    "tags": ["crawling", "products"],
    "importance": 0.7
  }'
```

### Recall recent memories

```bash
curl "http://localhost:9100/api/v1/memories?agent_id=my_agent&since=2h" \
  -H "x-api-key: mtk_..."
```

### Get LLM-ready session context

```bash
curl -X POST http://localhost:9100/api/v1/sessions/sess_abc/context \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{"since": "4h", "include_types": ["episodic", "decision"]}'
```

## SDK examples

### Python

```bash
pip install memtrace-sdk
```

```python
from memtrace import Memtrace

client = Memtrace("http://localhost:9100", "mtk_...")

# Quick add
client.remember("my_agent", "Posted tweet about Go generics")

# Recall recent
memories = client.recall("my_agent", since="48h")

# Log a decision
client.decide("my_agent", "post_to_twitter", "feed had interesting content")
```

### TypeScript

```bash
npm install @basekick-labs/memtrace-sdk
```

```typescript
import { Memtrace } from '@basekick-labs/memtrace-sdk'

const client = new Memtrace('http://localhost:9100', 'mtk_...')

// Quick add
await client.remember('my_agent', 'Posted tweet about Go generics')

// Recall recent
const memories = await client.recall('my_agent', '48h')

// Log a decision
await client.decide('my_agent', 'post_to_twitter', 'feed had interesting content')
```

### Go

```go
import "github.com/Basekick-Labs/memtrace/pkg/sdk"

client := sdk.New("http://localhost:9100", "mtk_...")

// Quick add
client.Remember(ctx, "my_agent", "Posted tweet about Go generics")

// Recall recent
memories, _ := client.Recall(ctx, "my_agent", "48h")

// Log a decision
client.Decide(ctx, "my_agent", "post_to_twitter", "feed had interesting content")
```

## Using with LLMs

### Claude API

```python
from memtrace import Memtrace, ContextOptions
import anthropic

mt = Memtrace("http://localhost:9100", "mtk_...")
client = anthropic.Anthropic()

# Get LLM-ready context and inject into system prompt
ctx = mt.get_session_context(session_id, ContextOptions(since="4h"))

response = client.messages.create(
    model="claude-sonnet-4-5",
    system=f"You are an agent.\n\n{ctx.context}",
    tools=MEMTRACE_TOOLS,  # remember, recall, search, decide
    messages=[...],
)
```

### OpenAI API

```python
from openai import OpenAI
from memtrace import Memtrace, ContextOptions

mt = Memtrace("http://localhost:9100", "mtk_...")
client = OpenAI()

ctx = mt.get_session_context(session_id, ContextOptions(since="4h"))

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": f"You are an agent.\n\n{ctx.context}"},
        ...
    ],
    tools=MEMTRACE_TOOLS,
)
```

## Upgrading from a single-Arc deployment

If you ran an older Memtrace where the URL/API key/database lived in the `[arc]` block of `memtrace.toml`, the v0.2.0 server auto-migrates that config into the new metadata DB on first startup. See [Configuration](./installation/configuration.md#auto-migration-from-the-legacy-arc-block) for details.

## Next steps

- [How clients connect](./how-clients-connect.md) — the per-org-API-key model
- [Architecture overview](./architecture/overview.md) — multi-tenant data model, encryption, Arc registry
- [Configuration](./installation/configuration.md) — all settings, the master key, the admin CLI
- [API Reference](./api-reference/overview.md) — REST endpoints, `/health`, `/ready`
- [Memory Types](./architecture/memory-types.md) — when to use each type
- [SDKs](./sdks/python.md) — Python, TypeScript, Go
