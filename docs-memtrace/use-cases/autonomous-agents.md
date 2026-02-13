---
sidebar_position: 1
---

# Autonomous Agents

An AI agent that runs for hours or days — browsing the web, writing code, managing infrastructure. It needs to remember what it already tried, what failed, and what decisions it made so it doesn't repeat mistakes or contradict itself.

## The Challenge

Autonomous agents face unique memory challenges:

- **Long-running sessions** - Agents may run for hours or days without human intervention
- **Decision continuity** - Agents must remember past decisions to avoid contradicting themselves
- **Failure tracking** - Agents need to remember what failed to avoid repeating mistakes
- **Progress tracking** - Agents must know what they've already completed
- **Context switching** - Agents may pause and resume work across multiple sessions

## How Memtrace Helps

Memtrace provides temporal memory that naturally supports autonomous workflows:

- **Decision logging** - Record every decision with reasoning for audit trail
- **Time-windowed recall** - Query "what did I do in the last 4 hours?"
- **Session continuity** - Resume work by loading prior session context
- **Importance scoring** - Prioritize critical memories vs routine logs
- **Cross-session memory** - Remember across restarts and interruptions

## Example: Coding Agent

A coding agent that refactors a large codebase across multiple sessions, remembering which files it already changed, which tests broke, and what strategies worked.

### Agent Workflow

```python
from memtrace import Memtrace, RegisterAgentRequest, CreateSessionRequest, ContextOptions

memtrace = Memtrace("http://localhost:9100", "mtk_...")

# Register the agent
agent = memtrace.register_agent(RegisterAgentRequest(
    name="refactor-agent",
    description="Refactors codebase to new architecture",
))

# Create a session
session = memtrace.create_session(CreateSessionRequest(
    agent_id=agent.id,
    metadata={"task": "refactor_auth_module", "target_version": "v2"},
))
```

### Track Progress

```python
# After analyzing a file
memtrace.remember(
    agent.id,
    "Analyzed auth.go - needs migration to new JWT library",
    session_id=session.id,
    tags=["analysis", "auth"],
    importance=0.8,
)

# After making a change
memtrace.remember(
    agent.id,
    "Refactored auth.go to use jwt-v2 library",
    session_id=session.id,
    tags=["completed", "auth"],
    importance=0.9,
)

# Log decisions
memtrace.decide(
    agent.id,
    "Use jwt-v2 library instead of jwt-v1",
    "jwt-v2 has better security and is actively maintained",
)
```

### Track Failures

```python
# When tests fail
memtrace.remember(
    agent.id,
    "Test auth_test.go:TestLogin failed after refactoring",
    session_id=session.id,
    tags=["test_failure", "auth"],
    importance=1.0,
)

# After fixing
memtrace.remember(
    agent.id,
    "Fixed TestLogin by updating mock token generation",
    session_id=session.id,
    tags=["test_fix", "auth"],
    importance=0.9,
)
```

### Resume After Interruption

```python
# Agent restarts and needs to resume work
ctx = memtrace.get_session_context(session.id, ContextOptions(
    since="24h",
    include_types=["episodic", "decision"],
))

# Inject context into agent prompt
system_prompt = f"""
You are a refactoring agent working on the auth module.

{ctx.context}

Continue from where you left off.
"""
```

### Check What's Already Done

```python
# Before starting work on a file
completed = memtrace.search_memories({
    "agent_id": agent.id,
    "session_id": session.id,
    "tags": ["completed"],
    "content_contains": "auth.go",
})

if completed.memories:
    print("auth.go already refactored, skipping")
else:
    # Proceed with refactoring
    pass
```

## Example: Infrastructure Agent

An agent that monitors and manages cloud infrastructure, remembering what it already investigated, which remediation actions it took, and what worked.

### Track Investigations

```python
# When investigating an alert
memtrace.remember(
    agent.id,
    "Investigating high memory usage on prod-web-01",
    tags=["investigation", "memory", "prod-web-01"],
    importance=0.9,
)

# Store findings
memtrace.remember(
    agent.id,
    "Found memory leak in Redis connection pool on prod-web-01",
    tags=["finding", "memory", "prod-web-01", "redis"],
    importance=1.0,
)
```

### Log Remediation Actions

```python
# Before taking action
memtrace.decide(
    agent.id,
    "Restart Redis service on prod-web-01",
    "Memory leak confirmed, restart should clear leaked connections",
)

# After action
memtrace.remember(
    agent.id,
    "Restarted Redis on prod-web-01, memory usage dropped to normal",
    tags=["action", "prod-web-01", "redis", "resolved"],
    importance=0.9,
)
```

### Avoid Repeated Actions

```python
# Before restarting a service, check if already tried recently
recent_restarts = memtrace.search_memories({
    "agent_id": agent.id,
    "tags": ["action"],
    "content_contains": "Restart Redis",
    "since": "2h",
})

if recent_restarts.memories:
    # Already tried restart recently, try different approach
    memtrace.decide(
        agent.id,
        "Scale Redis horizontally instead of restarting again",
        "Restart attempted 1h ago with temporary effect, need different approach",
    )
```

## Example: Research Agent

An agent that crawls websites, analyzes content, and builds knowledge over time.

### Track Crawled Pages

```python
# After crawling a page
memtrace.remember(
    agent.id,
    "Crawled https://example.com/products - found 15 product listings",
    tags=["crawling", "products"],
    metadata={"url": "https://example.com/products", "product_count": 15},
    importance=0.6,
)
```

### Avoid Duplicate Work

```python
# Before crawling, check if already visited
already_crawled = memtrace.search_memories({
    "agent_id": agent.id,
    "tags": ["crawling"],
    "content_contains": "https://example.com/products",
})

if already_crawled.memories:
    print("Already crawled this URL, skipping")
else:
    # Proceed with crawl
    pass
```

### Track Patterns and Conclusions

```python
# After analyzing multiple pages
memtrace.decide(
    agent.id,
    "Product prices follow weekly cycle - lowest on Tuesdays",
    "Analyzed 50 products over 2 weeks, consistent pattern observed",
)

# Store specific findings
memtrace.remember(
    agent.id,
    "Product X price range: $45-65, average: $52, lowest on Tuesdays",
    tags=["analysis", "pricing", "product_x"],
    importance=0.8,
)
```

## Best Practices

### Use Importance Scoring

Prioritize critical memories over routine logs:

```python
# Critical decision
memtrace.decide(agent.id, "...", "...", importance=1.0)

# Routine progress update
memtrace.remember(agent.id, "...", importance=0.3)
```

### Tag Strategically

Use tags to organize and filter memories:

```python
tags = [
    "phase_1",           # Workflow phase
    "auth_module",       # Component
    "completed",         # Status
]
```

### Time-Window Queries

Use appropriate time windows for context:

```python
# Recent context for active work
ctx = memtrace.get_session_context(session_id, ContextOptions(since="4h"))

# Full history for analysis
ctx = memtrace.get_session_context(session_id, ContextOptions())
```

### Session Metadata

Store context in session metadata:

```python
session = memtrace.create_session(CreateSessionRequest(
    agent_id=agent.id,
    metadata={
        "task": "refactor_auth",
        "target_version": "v2",
        "started_by": "scheduled_job",
    },
))
```

## Benefits

- **No repeated work** - Agent remembers what it already completed
- **No repeated mistakes** - Agent remembers what failed and why
- **Consistent decisions** - Agent can reference past decisions
- **Resume capability** - Agent picks up where it left off after interruptions
- **Audit trail** - Full history of decisions and actions for debugging
