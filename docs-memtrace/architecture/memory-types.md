---
sidebar_position: 2
---

# Memory Types

Memtrace supports four memory types, each optimized for different use cases. Understanding when to use each type helps you build more effective agent memory systems.

## Overview

| Type | Use Case | Examples |
|------|----------|----------|
| `episodic` | Actions taken, events observed | "Crawled page X", "API call failed", "User clicked button" |
| `decision` | Decisions with reasoning | "Skipped pagination - only 2 pages", "Chose strategy A over B" |
| `entity` | Facts about entities | "Customer prefers email", "API rate limit is 1000/hour" |
| `session` | Session-scoped context | "Session goal: analyze competitor pricing", "Current phase: data collection" |

## Episodic Memory

**What:** Actions taken, events observed, things that happened.

**When to use:**
- Logging agent actions (crawled a page, made an API call, wrote a file)
- Recording observations (found 3 products, detected an error, saw rate limit)
- Tracking state changes (user logged in, session started, cache cleared)

**Example:**
```json
{
  "agent_id": "web_crawler",
  "content": "Crawled https://example.com/products — found 12 items",
  "memory_type": "episodic",
  "event_type": "page_crawled",
  "tags": ["crawling", "products"],
  "importance": 0.7
}
```

**Why it matters:**
Episodic memory creates an audit trail of what happened. Agents can look back and see "I already tried X" or "last time I did Y, it failed." This prevents loops and redundant work.

## Decision Memory

**What:** Decisions made with reasoning for why.

**When to use:**
- Logging strategic choices (chose approach A over B)
- Recording why something was skipped (ignored pagination - too shallow)
- Documenting trade-offs (prioritized speed over accuracy)

**Example:**
```json
{
  "agent_id": "web_crawler",
  "content": "Skip pagination — only 2 pages deep, not worth the overhead",
  "memory_type": "decision",
  "event_type": "pagination_skipped",
  "tags": ["strategy", "optimization"],
  "importance": 0.8,
  "metadata": {
    "pages_found": 2,
    "threshold": 5
  }
}
```

**Why it matters:**
Decision memory captures the "why" behind agent behavior. When debugging or reviewing agent actions, you can see not just what it did, but why it chose that path. This is critical for multi-session agents that need consistency across runs.

## Entity Memory

**What:** Facts about entities (people, systems, tools, APIs).

**When to use:**
- Storing learned facts about customers, users, or accounts
- Recording system characteristics (API rate limits, response times)
- Documenting tool capabilities and quirks

**Example:**
```json
{
  "agent_id": "support_agent",
  "content": "Customer prefers email over phone for support communications",
  "memory_type": "entity",
  "event_type": "customer_preference",
  "tags": ["customer_123", "preferences", "communication"],
  "importance": 0.9,
  "metadata": {
    "customer_id": "customer_123",
    "source": "support_ticket_456"
  }
}
```

**Why it matters:**
Entity memory lets agents build a knowledge base about the world they operate in. A support agent remembers customer preferences. A DevOps agent remembers which APIs are flaky. A sales agent remembers who's interested in what.

## Session Memory

**What:** Session-scoped context and state.

**When to use:**
- Storing session goals and objectives
- Tracking current phase or stage of work
- Recording session-level configuration or constraints

**Example:**
```json
{
  "agent_id": "research_agent",
  "session_id": "sess_abc123",
  "content": "Session goal: Analyze competitor pricing for Q1 2026. Focus on top 5 competitors in US market.",
  "memory_type": "session",
  "event_type": "session_goal",
  "tags": ["goal", "research", "pricing"],
  "importance": 1.0,
  "metadata": {
    "quarter": "Q1",
    "year": 2026,
    "market": "US",
    "competitor_count": 5
  }
}
```

**Why it matters:**
Session memory provides continuity within a bounded work context. Agents can reference the session goal, constraints, and progress without re-reading all episodic history. This is especially useful for long-running sessions.

## Choosing the Right Type

### Use episodic when:
- You need a chronological log of events
- You want to prevent repeating actions
- You're tracking observable facts

### Use decision when:
- The "why" is as important as the "what"
- You need to justify agent behavior
- You want consistency across sessions

### Use entity when:
- You're building a knowledge base
- Facts persist beyond individual sessions
- Multiple agents need shared entity context

### Use session when:
- Context is scoped to a bounded work unit
- You want to track goals and progress
- You need to reference the "mission" of the current work

## Combining Types

In practice, agents use all four types together:

1. **Session memory** defines the goal
2. **Entity memory** provides context about relevant entities
3. **Episodic memory** logs actions taken
4. **Decision memory** explains why those actions were chosen

**Example flow:**
```
1. Session: "Goal: Analyze competitor pricing"
2. Entity: "Competitor A typically responds in 200-500ms"
3. Episodic: "Crawled competitor A pricing page"
4. Decision: "Skip deep crawl - found pricing in main table"
```

## Best Practices

### Importance Scoring

- **1.0:** Critical decisions, key entity facts, session goals
- **0.7-0.9:** Important actions, noteworthy observations
- **0.4-0.6:** Routine actions, minor observations
- **0.0-0.3:** Verbose logging, debug info

### Tagging Strategy

Use consistent tags across memory types:
- Entity tags: `customer_123`, `api_stripe`, `server_prod_01`
- Action tags: `crawling`, `api_call`, `file_write`
- Domain tags: `billing`, `support`, `infrastructure`

### Content Length

- **Short and clear:** 1-2 sentences per memory
- **Front-load key info:** Most important details first
- **Use metadata for structure:** Don't encode JSON in content

## Next Steps

- Learn about the [Data Model](./data-model.md) and storage format
- Explore the [API Reference](../api-reference/endpoints.md) for memory creation
- See [Use Cases](../use-cases/overview.md) for real-world examples
