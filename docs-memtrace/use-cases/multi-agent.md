---
sidebar_position: 3
---

# Multi-Agent Collaboration

Teams of specialized agents working on the same goal — one researches, one writes, one reviews, one publishes. They share a memory space so each agent can see what the others have done and make decisions accordingly.

## The Challenge

Multi-agent systems face coordination challenges:

- **Shared context** - All agents need to see what others have done
- **Work attribution** - Track which agent performed which action
- **Handoffs** - One agent completes work, another picks up
- **Parallel work** - Multiple agents working simultaneously without conflicts
- **Decision consistency** - Agents must respect decisions made by others

## How Memtrace Helps

Memtrace enables true multi-agent collaboration:

- **Shared sessions** - All agents read/write to same memory space
- **Agent attribution** - Every memory tagged with agent_id
- **Cross-agent queries** - Agents can filter by specific agents or see all
- **Decision visibility** - All agents see decisions made by others
- **Temporal coordination** - Time-based queries show recent work across all agents

## Example: Content Pipeline

A team of agents creates content: researcher gathers information, writer drafts content, editor reviews, publisher distributes.

### Agent Setup

```python
from memtrace import Memtrace, RegisterAgentRequest, CreateSessionRequest

memtrace = Memtrace("http://localhost:9100", "mtk_...")

# Register specialized agents
researcher = memtrace.register_agent(RegisterAgentRequest(
    name="researcher",
    description="Gathers information and sources",
))

writer = memtrace.register_agent(RegisterAgentRequest(
    name="writer",
    description="Drafts articles from research",
))

editor = memtrace.register_agent(RegisterAgentRequest(
    name="editor",
    description="Reviews and improves drafts",
))

publisher = memtrace.register_agent(RegisterAgentRequest(
    name="publisher",
    description="Publishes approved content",
))
```

### Shared Session

```python
# Create shared session for content project
session = memtrace.create_session(CreateSessionRequest(
    agent_id=researcher.id,
    metadata={
        "project": "golang-concurrency-article",
        "deadline": "2026-02-20",
        "target_platform": "blog",
    },
))
```

### Phase 1: Research

```python
# Researcher stores findings
memtrace.remember(
    researcher.id,
    "Go channels enable safe communication between goroutines",
    session_id=session.id,
    tags=["research", "channels", "concurrency"],
    importance=0.9,
)

memtrace.remember(
    researcher.id,
    "Source: Go official docs - effective_go.html#channels",
    session_id=session.id,
    tags=["source", "official_docs"],
    importance=0.7,
)

memtrace.remember(
    researcher.id,
    "sync.WaitGroup is common pattern for coordinating goroutines",
    session_id=session.id,
    tags=["research", "sync", "concurrency"],
    importance=0.9,
)

# Mark research phase complete
memtrace.decide(
    researcher.id,
    "Research complete - collected 15 key facts about Go concurrency",
    "Sufficient material for article, covered channels, goroutines, and sync patterns",
)
```

### Phase 2: Writing

```python
# Writer reads all research
ctx = memtrace.get_session_context(session.id, ContextOptions(
    include_types=["episodic", "decision"],
))

# Writer has access to:
# - All research findings
# - All sources
# - Researcher's completion decision

# Writer creates draft
memtrace.remember(
    writer.id,
    "Drafted article introduction focusing on channels as core concept",
    session_id=session.id,
    tags=["draft", "introduction"],
    importance=0.8,
)

memtrace.remember(
    writer.id,
    "Article structure: Intro -> Channels -> Goroutines -> Patterns -> Conclusion",
    session_id=session.id,
    tags=["draft", "structure"],
    importance=0.9,
)

memtrace.decide(
    writer.id,
    "Draft complete - 1500 words, covers all research points",
    "Included all key concepts from research phase, added code examples",
)
```

### Phase 3: Editing

```python
# Editor reads everything
ctx = memtrace.get_session_context(session.id, ContextOptions())

# Editor sees:
# - All research findings and sources
# - Draft structure and content
# - Writer's completion decision

# Editor provides feedback
memtrace.remember(
    editor.id,
    "Introduction is too technical, needs simpler explanation for beginners",
    session_id=session.id,
    tags=["feedback", "introduction"],
    importance=0.9,
)

memtrace.remember(
    editor.id,
    "Code examples are excellent, very clear",
    session_id=session.id,
    tags=["feedback", "code_examples", "positive"],
    importance=0.7,
)

memtrace.decide(
    editor.id,
    "Request revision - introduction needs simplification",
    "Overall strong draft but accessibility concern for target audience",
)
```

### Phase 4: Revision

```python
# Writer reads editor feedback
editor_feedback = memtrace.search_memories({
    "agent_id": editor.id,
    "session_id": session.id,
    "tags": ["feedback"],
})

# Writer addresses feedback
memtrace.remember(
    writer.id,
    "Simplified introduction, added analogy comparing channels to postal mail",
    session_id=session.id,
    tags=["revision", "introduction"],
    importance=0.8,
)

memtrace.decide(
    writer.id,
    "Revision complete - addressed editor feedback",
    "Introduction now more accessible while maintaining technical accuracy",
)
```

### Phase 5: Publishing

```python
# Publisher reads final state
ctx = memtrace.get_session_context(session.id, ContextOptions())

# Publisher sees:
# - Original research
# - Draft creation
# - Editor feedback
# - Writer revisions
# - All decisions

# Publisher can verify:
editor_approved = memtrace.search_memories({
    "agent_id": editor.id,
    "session_id": session.id,
    "tags": ["approval"],
})

if editor_approved.memories:
    memtrace.remember(
        publisher.id,
        "Published article to blog: golang-concurrency-guide",
        session_id=session.id,
        tags=["published", "blog"],
        importance=1.0,
    )

    memtrace.decide(
        publisher.id,
        "Project complete - article live on blog",
        "All phases completed: research, writing, editing, publishing",
    )

    # Close session
    memtrace.close_session(session.id)
```

## Example: Code Review Team

Multiple agents collaborate on code review: security scanner, style checker, test reviewer, integration reviewer.

### Agent Setup

```python
security_agent = memtrace.register_agent(RegisterAgentRequest(
    name="security-reviewer",
    description="Checks for security vulnerabilities",
))

style_agent = memtrace.register_agent(RegisterAgentRequest(
    name="style-reviewer",
    description="Enforces code style and best practices",
))

test_agent = memtrace.register_agent(RegisterAgentRequest(
    name="test-reviewer",
    description="Reviews test coverage and quality",
))

integration_agent = memtrace.register_agent(RegisterAgentRequest(
    name="integration-reviewer",
    description="Checks integration with existing codebase",
))
```

### Parallel Review

```python
# Create session for PR review
session = memtrace.create_session(CreateSessionRequest(
    agent_id=security_agent.id,
    metadata={
        "pr_number": "42",
        "repository": "my-app",
        "author": "developer",
    },
))

# All agents review in parallel

# Security agent
memtrace.remember(
    security_agent.id,
    "Found SQL injection vulnerability in auth.go:45",
    session_id=session.id,
    tags=["security", "critical", "sql_injection"],
    importance=1.0,
)

# Style agent
memtrace.remember(
    style_agent.id,
    "Missing error handling in api.go:123",
    session_id=session.id,
    tags=["style", "error_handling"],
    importance=0.7,
)

# Test agent
memtrace.remember(
    test_agent.id,
    "New function auth.ValidateToken lacks unit tests",
    session_id=session.id,
    tags=["testing", "missing_coverage"],
    importance=0.9,
)

# Integration agent
memtrace.remember(
    integration_agent.id,
    "New API endpoint not documented in OpenAPI spec",
    session_id=session.id,
    tags=["integration", "documentation"],
    importance=0.8,
)
```

### Aggregate Review

```python
# Summary agent reads all reviews
all_issues = memtrace.search_memories({
    "session_id": session.id,
    "memory_type": "episodic",
})

# Group by severity
critical = [m for m in all_issues.memories if m.importance >= 0.9]
warnings = [m for m in all_issues.memories if 0.7 <= m.importance < 0.9]

# Create summary
memtrace.decide(
    "summary-agent",
    "Reject PR - critical security issue must be fixed",
    f"Found {len(critical)} critical issues, {len(warnings)} warnings. Security issue is blocking.",
)
```

## Example: Research and Analysis

Multiple agents work together on market research: data collector, analyzer, summarizer.

### Data Collection

```python
# Collector agent gathers data
memtrace.remember(
    "collector",
    "Competitor A pricing: Basic $10/mo, Pro $25/mo, Enterprise $100/mo",
    session_id=session.id,
    tags=["pricing", "competitor_a"],
    importance=0.9,
)

memtrace.remember(
    "collector",
    "Competitor B pricing: Starter $15/mo, Business $40/mo",
    session_id=session.id,
    tags=["pricing", "competitor_b"],
    importance=0.9,
)
```

### Analysis

```python
# Analyzer reads collected data
pricing_data = memtrace.search_memories({
    "agent_id": "collector",
    "session_id": session.id,
    "tags": ["pricing"],
})

# Analyzer stores insights
memtrace.remember(
    "analyzer",
    "Competitor A targets SMB market with low entry point",
    session_id=session.id,
    tags=["analysis", "market_segment", "competitor_a"],
    importance=0.8,
)

memtrace.remember(
    "analyzer",
    "Competitor B focuses on mid-market, no free tier",
    session_id=session.id,
    tags=["analysis", "market_segment", "competitor_b"],
    importance=0.8,
)

memtrace.decide(
    "analyzer",
    "Our pricing should target gap between A and B",
    "Market analysis shows opportunity at $18-22/mo price point",
)
```

### Summarization

```python
# Summarizer creates final report
ctx = memtrace.get_session_context(session.id, ContextOptions())

# Summarizer sees:
# - All collected data
# - Analysis insights
# - Pricing recommendation decision

# Creates executive summary
memtrace.remember(
    "summarizer",
    "Created executive summary highlighting $20/mo recommendation with competitive analysis",
    session_id=session.id,
    tags=["summary", "executive_report"],
    importance=1.0,
)
```

## Best Practices

### Clear Agent Roles

Define specific responsibilities for each agent:

```python
description="Handles X, does not do Y"
```

### Agent Attribution

Always specify which agent performed action:

```python
memtrace.remember(agent_id, ...)  # Not anonymous
```

### Cross-Agent Queries

Query specific agents or all agents as needed:

```python
# Specific agent
memories = memtrace.search_memories({"agent_id": researcher.id})

# All agents in session
memories = memtrace.search_memories({"session_id": session.id})
```

### Decision Visibility

Make decisions explicit so other agents see them:

```python
memtrace.decide(agent_id, "What was decided", "Why this decision")
```

### Session Metadata

Store project context in session metadata:

```python
metadata = {
    "project": "article-pipeline",
    "phase": "research",
    "deadline": "2026-02-20",
}
```

### Handoff Markers

Mark phases complete with decisions:

```python
memtrace.decide(
    agent_id,
    "Phase X complete - ready for next agent",
    "All requirements met, deliverables ready",
)
```

## Benefits

- **True collaboration** - Agents build on each other's work
- **No duplication** - Agents see what others already did
- **Consistent decisions** - All agents respect shared decisions
- **Clear attribution** - Track which agent did what
- **Audit trail** - Full history of multi-agent workflow
- **Flexible pipelines** - Easy to add/remove agents from pipeline
