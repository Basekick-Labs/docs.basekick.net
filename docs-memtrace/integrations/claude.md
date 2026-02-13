---
sidebar_position: 2
---

# Claude Integration

Complete examples showing how to use Memtrace with the Anthropic Claude API for agent memory.

## Prerequisites

- Python 3.10+
- A running Memtrace instance (with Arc backend)
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
pip install memtrace-sdk anthropic
```

Set environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export MEMTRACE_URL="http://localhost:9100"
export MEMTRACE_API_KEY="mtk_..."
```

## Memory Loop Pattern

The core pattern for using Memtrace with Claude:

```
┌─────────────────────────────────────────┐
│  1. Get session context from Memtrace   │
│     (LLM-ready markdown)                │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  2. Inject context into Claude's        │
│     system prompt                       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  3. Claude acts — calls memory tools    │
│     (remember, recall, search, decide)  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  4. Results persisted to Memtrace       │
│     → available in next session         │
└─────────────────────────────────────────┘
```

```python
from memtrace import Memtrace, ContextOptions
import anthropic

memtrace = Memtrace("http://localhost:9100", "mtk_...")
client = anthropic.Anthropic()

# Get LLM-ready context
ctx = memtrace.get_session_context(session_id, ContextOptions(since="4h"))

# Inject into system prompt
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    system=f"You are an agent.\n\n{ctx.context}",
    tools=MEMTRACE_TOOLS,
    messages=[...],
)

# Handle tool_use blocks → execute Memtrace SDK calls → return tool_result
# Loop until stop_reason == "end_turn"
```

## Single Agent Example

Demonstrates the core memory loop with a single Claude-powered agent:

1. Register an agent in Memtrace
2. Create a session
3. Inject prior memory context into Claude's system prompt
4. Converse with tool use — the agent stores facts, recalls them, and makes decisions
5. Close the session

```python
from memtrace import Memtrace, RegisterAgentRequest, CreateSessionRequest, ContextOptions
import anthropic

# Initialize clients
memtrace = Memtrace("http://localhost:9100", "mtk_...")
claude = anthropic.Anthropic()

# Register agent
agent = memtrace.register_agent(RegisterAgentRequest(
    name="assistant",
    description="Helpful AI assistant with memory",
))

# Create session
session = memtrace.create_session(CreateSessionRequest(
    agent_id=agent.id,
    metadata={"task": "conversation"},
))

# Define memory tools
MEMTRACE_TOOLS = [
    {
        "name": "memtrace_remember",
        "description": "Store a memory for later recall",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "What to remember"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "importance": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "required": ["content"],
        },
    },
    {
        "name": "memtrace_recall",
        "description": "Retrieve recent memories",
        "input_schema": {
            "type": "object",
            "properties": {
                "since": {"type": "string", "description": "Time window (e.g. '2h', '24h')"},
            },
        },
    },
    {
        "name": "memtrace_search",
        "description": "Search memories with filters",
        "input_schema": {
            "type": "object",
            "properties": {
                "content_contains": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "min_importance": {"type": "number"},
            },
        },
    },
    {
        "name": "memtrace_decide",
        "description": "Log a decision with reasoning",
        "input_schema": {
            "type": "object",
            "properties": {
                "decision": {"type": "string", "description": "What was decided"},
                "reasoning": {"type": "string", "description": "Why this decision"},
            },
            "required": ["decision", "reasoning"],
        },
    },
]

# Conversation loop
messages = []

def add_user_message(text):
    messages.append({"role": "user", "content": text})

def handle_tool_calls(response):
    """Execute Memtrace tool calls and return results"""
    results = []

    for block in response.content:
        if block.type == "tool_use":
            tool_name = block.name
            tool_input = block.input

            if tool_name == "memtrace_remember":
                mem = memtrace.add_memory({
                    "agent_id": agent.id,
                    "session_id": session.id,
                    "content": tool_input["content"],
                    "tags": tool_input.get("tags", []),
                    "importance": tool_input.get("importance", 0),
                })
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": f"Stored memory: {mem.id}",
                })

            elif tool_name == "memtrace_recall":
                memories = memtrace.list_memories({
                    "agent_id": agent.id,
                    "session_id": session.id,
                    "since": tool_input.get("since", "24h"),
                })
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": "\n".join([f"- {m.content}" for m in memories.memories]),
                })

            elif tool_name == "memtrace_search":
                memories = memtrace.search_memories({
                    "agent_id": agent.id,
                    "content_contains": tool_input.get("content_contains"),
                    "tags": tool_input.get("tags"),
                    "min_importance": tool_input.get("min_importance"),
                })
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": "\n".join([f"- {m.content}" for m in memories.memories]),
                })

            elif tool_name == "memtrace_decide":
                memtrace.decide(
                    agent.id,
                    tool_input["decision"],
                    tool_input["reasoning"],
                )
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": "Decision logged",
                })

    return results

# Get session context
ctx = memtrace.get_session_context(session.id, ContextOptions(since="4h"))

# First message
add_user_message("I prefer dark mode")

while True:
    response = claude.messages.create(
        model="claude-sonnet-4-20250514",
        system=f"You are a helpful assistant.\n\n{ctx.context}",
        tools=MEMTRACE_TOOLS,
        messages=messages,
    )

    messages.append({"role": "assistant", "content": response.content})

    if response.stop_reason == "tool_use":
        tool_results = handle_tool_calls(response)
        messages.append({"role": "user", "content": tool_results})
    else:
        break

print(response.content[0].text)

# Close session
memtrace.close_session(session.id)
```

## Multi-Agent Example

Demonstrates two agents sharing a Memtrace memory space:

1. Researcher investigates a topic and stores findings with tags and importance scores
2. Summarizer reads the researcher's memories and produces a structured report

Both agents use the same Memtrace session, so the summarizer can see everything the researcher stored.

```python
# Create shared session
session = memtrace.create_session(CreateSessionRequest(
    agent_id="researcher",
    metadata={"task": "research_and_summarize"},
))

# Researcher agent
researcher = memtrace.register_agent(RegisterAgentRequest(
    name="researcher",
    description="Investigates topics and stores findings",
))

# Run researcher
add_user_message("Research the benefits of time-series databases")
# ... (same conversation loop as above)

# Summarizer agent
summarizer = memtrace.register_agent(RegisterAgentRequest(
    name="summarizer",
    description="Reads research and creates reports",
))

# Get all researcher's memories
ctx = memtrace.get_session_context(session.id, ContextOptions())

# Run summarizer
response = claude.messages.create(
    model="claude-sonnet-4-20250514",
    system=f"You are a report writer.\n\n{ctx.context}",
    messages=[{"role": "user", "content": "Create a summary report"}],
)

print(response.content[0].text)
```

This pattern enables agent pipelines, handoffs, and collaborative workflows where specialized agents build on each other's work.

## Telegram Customer Support Example

Three Telegram bots acting as customer support departments for a fictional telco "TeleCo":

- Juan — Internet Support (troubleshooting, router issues, plan upgrades)
- Martin — TV Support (channels, set-top box, HBO/sports packages)
- Cecilia — Billing (charges, credits, disputes, discounts)

A customer chats with one bot, then contacts another — each bot sees the full history from all departments via Memtrace shared sessions.

### Features

- **Cross-department memory sharing** — recall/search by `session_id` (sees all bots), write with `agent_id` (attribution)
- **Session resume on restart** — finds active sessions in Memtrace by `account_id` metadata
- **Photo support** — customers can send photos (e.g. error screenshots) via multimodal Claude messages
- **Identity verification** — first-name lookup against test customer database

### Setup

Requires 3 Telegram bot tokens (create via [@BotFather](https://t.me/BotFather)):

```bash
export BOT_TOKEN_INTERNET="<telegram bot token>"
export BOT_TOKEN_TV="<telegram bot token>"
export BOT_TOKEN_BILLING="<telegram bot token>"
```

### Implementation Pattern

```python
# Find or create session for customer
sessions = memtrace.search_sessions({
    "metadata": {"account_id": customer_id},
    "status": "active",
})

if sessions.sessions:
    session = sessions.sessions[0]
else:
    session = memtrace.create_session(CreateSessionRequest(
        agent_id=bot_agent_id,
        metadata={"account_id": customer_id, "channel": "telegram"},
    ))

# Get full cross-department context
ctx = memtrace.get_session_context(session.id)

# Process message with Claude
response = claude.messages.create(
    model="claude-sonnet-4-20250514",
    system=f"You are {department} support.\n\n{ctx.context}",
    tools=MEMTRACE_TOOLS,
    messages=[{"role": "user", "content": customer_message}],
)

# Store interaction with agent attribution
memtrace.remember(bot_agent_id, f"Customer: {customer_message}", session_id=session.id)
memtrace.remember(bot_agent_id, f"Response: {response_text}", session_id=session.id)
```

## Tools

All examples provide 4 Memtrace tools to Claude:

| Tool | Purpose |
|------|---------|
| `memtrace_remember` | Store a memory (observation, action, event) |
| `memtrace_recall` | Retrieve recent memories (reverse chronological) |
| `memtrace_search` | Search with filters (content, tags, types, importance) |
| `memtrace_decide` | Log a decision with reasoning (audit trail) |

## Full Examples

Complete runnable examples are available in the [arc-memory repository](https://github.com/basekick-labs/arc-memory/tree/main/examples/claude):

- `single_agent.py` - Single agent memory loop
- `multi_agent.py` - Two agents sharing memory
- `telegram_support.py` - Multi-bot customer support system
