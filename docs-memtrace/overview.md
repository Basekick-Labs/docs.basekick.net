---
id: overview
sidebar_position: 1
slug: /
---

# Memtrace

**LLM-agnostic memory layer for AI agents.** Works with ChatGPT, Claude, Gemini, DeepSeek, Llama — any LLM.

No embeddings. No vector DB. Just fast, structured, temporal memory that any LLM can consume as plain text context.

## Why Memtrace?

AI agents need memory to be useful. They need to remember what they did, what worked, what failed, and what decisions they made. Most memory solutions force you into vector databases and embeddings — adding latency, complexity, and cost.

Memtrace takes a different approach: **operational, temporal memory** built on a time-series database. Every action is temporal. Every query is time-windowed. The feedback loop — Memory, Decision, Action, Log, Repeat — works naturally with time-series data.

## How It Works

Memtrace stores memories as time-series events in [Arc](https://github.com/Basekick-Labs/arc), a high-performance time-series database. Each memory has a type (`episodic`, `decision`, `entity`, `session`), tags, importance score, and metadata. Queries are time-windowed by default — "what happened in the last 2 hours?" is a first-class operation.

The **session context** endpoint is the killer feature: it queries memories for a session, groups them by type, and returns LLM-ready markdown that you inject directly into any prompt. No parsing, no transformation — just paste it into your system prompt.

## Key Features

- **Temporal by default** — Time-windowed queries are first-class operations
- **LLM-agnostic** — Works with any LLM via plain text context injection
- **Session context** — Get LLM-ready markdown context with a single API call
- **Shared memory** — Multiple agents can share memories across sessions and organizations
- **Deduplication** — Prevents duplicate memories based on configurable keys
- **Memory types** — Episodic, decision, entity, and session memories for different use cases
- **High throughput** — Batched writes to Arc for optimal performance
- **No embeddings** — No vector database, no embedding costs, no latency overhead

## Use Cases

### Autonomous Agents

An AI agent that runs for hours or days — browsing the web, writing code, managing infrastructure. It needs to remember what it already tried, what failed, and what decisions it made so it doesn't repeat mistakes or contradict itself.

**Example:** A coding agent that refactors a large codebase across multiple sessions, remembering which files it already changed, which tests broke, and what strategies worked.

### Customer Support

AI support agents handling conversations across channels. Each agent remembers the full customer history — previous tickets, resolutions, preferences — without re-reading everything from scratch. Multiple agents share context about the same customer in real time.

**Example:** A call center with 50 AI agents sharing a memory pool. When a customer calls back, any agent instantly knows what happened last time.

### Research & Analysis

AI agents that crawl, summarize, and analyze data over time. They need to track what they've already read, what patterns they've found, and what conclusions they've drawn — building knowledge incrementally instead of starting from zero.

**Example:** A market research agent that monitors competitor pricing daily, remembering trends and flagging anomalies against its own historical observations.

### DevOps & Monitoring

AI agents that watch infrastructure, respond to alerts, and take remediation actions. They need to remember what they already investigated, which runbooks they executed, and what the outcomes were — especially during incident response.

**Example:** An on-call agent that correlates a 3 AM alert with a similar incident it handled last Tuesday, remembers the fix that worked, and applies it automatically.

### Content & Social Media

AI agents that create, schedule, and manage content across platforms. They remember what topics performed well, what's already been posted, and what the audience engaged with — avoiding repetition and learning from results.

**Example:** A social media agent that posted about Go generics yesterday and decides to cover a different topic today based on engagement memory.

### Multi-Agent Collaboration

Teams of specialized agents working on the same goal — one researches, one writes, one reviews, one publishes. They share a memory space so each agent can see what the others have done and make decisions accordingly.

**Example:** A content pipeline where a research agent stores findings, a writing agent reads them to draft articles, and an editor agent reviews against the shared decision log.

### Sales & Outreach

AI agents that manage prospect pipelines, personalize outreach, and track interactions over time. They remember every touchpoint, what messaging resonated, and when to follow up.

**Example:** An SDR agent that remembers a prospect mentioned a conference last month, and uses that context to personalize the follow-up email.

### Data Processing Pipelines

Long-running ETL or data enrichment agents that process millions of records in batches. They need to track what's been processed, what failed, and where to resume — with deduplication built in.

**Example:** A data enrichment agent that processes 100K company records over 3 days, remembering which ones are done, which APIs timed out, and which need retry.

## Next Steps

- [Get started](./getting-started.md) with installation and your first API call
- Read the [Architecture overview](./architecture/overview.md) to understand how Memtrace works
- Explore the [API Reference](./api-reference/endpoints.md) for all available endpoints
- Check out the [SDKs](./sdks/overview.md) for Python, TypeScript, and Go

## License

Open source. See the [GitHub repository](https://github.com/basekick-labs/arc-memory) for license details.
