---
sidebar_position: 2
---

# Getting Started

Get Memtrace up and running in minutes.

## Prerequisites

- Go 1.25+
- A running [Arc](https://github.com/Basekick-Labs/arc) instance

## Installation

### 1. Clone and Build

```bash
git clone https://github.com/basekick-labs/arc-memory.git
cd arc-memory
make build
```

### 2. Configure

```bash
cp memtrace.toml memtrace.local.toml
# Edit memtrace.local.toml with your Arc URL
```

Key configuration settings:

```toml
[server]
port = 9100

[arc]
url = "http://localhost:8491"
api_key = "your_arc_api_key"

[metadata]
db_path = "./memtrace.db"
```

### 3. Run

```bash
./memtrace
```

On first run, Memtrace prints your admin API key. **Save it — it's shown only once.**

```
FIRST RUN: Save your admin API key (shown only once)
API Key: mtk_...
```

## Your First API Call

### Store a Memory

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

### Recall Recent Memories

```bash
curl "http://localhost:9100/api/v1/memories?agent_id=my_agent&since=2h" \
  -H "x-api-key: mtk_..."
```

### Get LLM-Ready Session Context

```bash
curl -X POST http://localhost:9100/api/v1/sessions/sess_abc/context \
  -H "x-api-key: mtk_..." \
  -H "Content-Type: application/json" \
  -d '{"since": "4h", "include_types": ["episodic", "decision"]}'
```

## Quick Examples

### Python SDK

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

### TypeScript SDK

```bash
npm install @memtrace/sdk
```

```typescript
import { Memtrace } from '@memtrace/sdk'

const client = new Memtrace('http://localhost:9100', 'mtk_...')

// Quick add
await client.remember('my_agent', 'Posted tweet about Go generics')

// Recall recent
const memories = await client.recall('my_agent', '48h')

// Log a decision
await client.decide('my_agent', 'post_to_twitter', 'feed had interesting content')
```

### Go SDK

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

### Claude API Example

```python
from memtrace import Memtrace, ContextOptions
import anthropic

mt = Memtrace("http://localhost:9100", "mtk_...")
client = anthropic.Anthropic()

# Get LLM-ready context and inject into system prompt
ctx = mt.get_session_context(session_id, ContextOptions(since="4h"))

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    system=f"You are an agent.\n\n{ctx.context}",
    tools=MEMTRACE_TOOLS,  # remember, recall, search, decide
    messages=[...],
)
```

### OpenAI API Example

```python
from openai import OpenAI
from memtrace import Memtrace, ContextOptions

mt = Memtrace("http://localhost:9100", "mtk_...")
client = OpenAI()

# Get LLM-ready context and inject into system prompt
ctx = mt.get_session_context(session_id, ContextOptions(since="4h"))

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": f"You are an agent.\n\n{ctx.context}"},
        ...
    ],
    tools=MEMTRACE_TOOLS,  # remember, recall, search, decide
)
```

## Next Steps

- Explore the [Architecture](./architecture/overview.md) to understand how Memtrace works
- Read the [API Reference](./api-reference/endpoints.md) for all available endpoints
- Check out [Memory Types](./architecture/memory-types.md) to learn when to use each type
- See [Integrations](./integrations/overview.md) for framework-specific tools
