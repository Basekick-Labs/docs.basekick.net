---
sidebar_position: 3
---

# OpenAI Integration

Complete guide for using Memtrace with both the OpenAI API and OpenAI Agents SDK for agent memory.

## OpenAI API Integration

### Prerequisites

- Python 3.10+
- A running Memtrace instance (with Arc backend)
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Setup

```bash
pip install memtrace-sdk openai
```

Set environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export MEMTRACE_URL="http://localhost:9100"
export MEMTRACE_API_KEY="mtk_..."
```

### Memory Loop Pattern

The core pattern for using Memtrace with OpenAI:

```
┌─────────────────────────────────────────┐
│  1. Get session context from Memtrace   │
│     (LLM-ready markdown)                │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  2. Inject context into the system      │
│     prompt                              │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  3. GPT-4o acts — calls memory tools    │
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
from openai import OpenAI

memtrace = Memtrace("http://localhost:9100", "mtk_...")
client = OpenAI()

# Get LLM-ready context
ctx = memtrace.get_session_context(session_id, ContextOptions(since="4h"))

# Inject into system prompt
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": f"You are an agent.\n\n{ctx.context}"},
        ...
    ],
    tools=MEMTRACE_TOOLS,
)

# Handle tool_calls → execute Memtrace SDK calls → return tool results
# Loop until finish_reason != "tool_calls"
```

### Single Agent Example

Demonstrates the core memory loop with a single GPT-4o-powered agent:

```python
from memtrace import Memtrace, RegisterAgentRequest, CreateSessionRequest, ContextOptions
from openai import OpenAI

# Initialize clients
memtrace = Memtrace("http://localhost:9100", "mtk_...")
openai_client = OpenAI()

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
        "type": "function",
        "function": {
            "name": "memtrace_remember",
            "description": "Store a memory for later recall",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "What to remember"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "importance": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "memtrace_recall",
            "description": "Retrieve recent memories",
            "parameters": {
                "type": "object",
                "properties": {
                    "since": {"type": "string", "description": "Time window (e.g. '2h', '24h')"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "memtrace_search",
            "description": "Search memories with filters",
            "parameters": {
                "type": "object",
                "properties": {
                    "content_contains": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "min_importance": {"type": "number"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "memtrace_decide",
            "description": "Log a decision with reasoning",
            "parameters": {
                "type": "object",
                "properties": {
                    "decision": {"type": "string", "description": "What was decided"},
                    "reasoning": {"type": "string", "description": "Why this decision"},
                },
                "required": ["decision", "reasoning"],
            },
        },
    },
]

# Conversation loop
messages = []

def handle_tool_calls(tool_calls):
    """Execute Memtrace tool calls and return results"""
    results = []

    for tool_call in tool_calls:
        tool_name = tool_call.function.name
        tool_args = json.loads(tool_call.function.arguments)

        if tool_name == "memtrace_remember":
            mem = memtrace.add_memory({
                "agent_id": agent.id,
                "session_id": session.id,
                "content": tool_args["content"],
                "tags": tool_args.get("tags", []),
                "importance": tool_args.get("importance", 0),
            })
            results.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "content": f"Stored memory: {mem.id}",
            })

        elif tool_name == "memtrace_recall":
            memories = memtrace.list_memories({
                "agent_id": agent.id,
                "session_id": session.id,
                "since": tool_args.get("since", "24h"),
            })
            results.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "content": "\n".join([f"- {m.content}" for m in memories.memories]),
            })

        elif tool_name == "memtrace_search":
            memories = memtrace.search_memories({
                "agent_id": agent.id,
                "content_contains": tool_args.get("content_contains"),
                "tags": tool_args.get("tags"),
                "min_importance": tool_args.get("min_importance"),
            })
            results.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "content": "\n".join([f"- {m.content}" for m in memories.memories]),
            })

        elif tool_name == "memtrace_decide":
            memtrace.decide(
                agent.id,
                tool_args["decision"],
                tool_args["reasoning"],
            )
            results.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "content": "Decision logged",
            })

    return results

# Get session context
ctx = memtrace.get_session_context(session.id, ContextOptions(since="4h"))

# Add system message with context
messages.append({
    "role": "system",
    "content": f"You are a helpful assistant.\n\n{ctx.context}"
})

# Add user message
messages.append({"role": "user", "content": "I prefer dark mode"})

while True:
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=MEMTRACE_TOOLS,
    )

    message = response.choices[0].message
    messages.append(message)

    if message.tool_calls:
        tool_results = handle_tool_calls(message.tool_calls)
        messages.extend(tool_results)
    else:
        break

print(message.content)

# Close session
memtrace.close_session(session.id)
```

### Multi-Agent Example

Demonstrates two agents sharing a Memtrace memory space:

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

# Run researcher (same loop as above)
# ...

# Summarizer agent
summarizer = memtrace.register_agent(RegisterAgentRequest(
    name="summarizer",
    description="Reads research and creates reports",
))

# Get all researcher's memories
ctx = memtrace.get_session_context(session.id, ContextOptions())

# Run summarizer
response = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": f"You are a report writer.\n\n{ctx.context}"},
        {"role": "user", "content": "Create a summary report"},
    ],
)

print(response.choices[0].message.content)
```

### Tools

All examples provide 4 Memtrace tools:

| Tool | Purpose |
|------|---------|
| `memtrace_remember` | Store a memory (observation, action, event) |
| `memtrace_recall` | Retrieve recent memories (reverse chronological) |
| `memtrace_search` | Search with filters (content, tags, types, importance) |
| `memtrace_decide` | Log a decision with reasoning (audit trail) |

## OpenAI Agents SDK Integration

Memory tools and session store for the OpenAI Agents SDK, powered by Memtrace.

### Installation

```bash
pip install openai-agents-memtrace
```

### Quick Start

```python
from agents import Agent, Runner
from memtrace import AsyncMemtrace
from openai_agents_memtrace import create_memtrace_tools, MemtraceSession

async def main():
    # 1. Create Memtrace client
    client = AsyncMemtrace("http://localhost:9100", "mtk_your_api_key")

    # 2. Create memory tools bound to an agent
    tools = create_memtrace_tools(client, agent_id="support_agent")

    # 3. Create a session with prior memory context
    session = await MemtraceSession.create(client, agent_id="support_agent")

    # 4. Create an agent with memory tools
    agent = Agent(
        name="Support Agent",
        instructions=(
            "You are a helpful support agent. "
            "Use memtrace_remember to store important information and "
            "memtrace_recall to check what you've seen before."
        ),
        tools=tools,
    )

    # 5. Run the agent
    result = await Runner.run(agent, "I need help with my account", session=session)
    print(result.final_output)

    # 6. Clean up
    await session.close()
    await client.close()
```

### Tools

`create_memtrace_tools(client, agent_id)` returns 4 tools:

| Tool | Description |
|------|-------------|
| `memtrace_remember` | Store a memory (actions, observations, events) |
| `memtrace_recall` | Retrieve recent memories (reverse chronological) |
| `memtrace_search` | Search memories by content, tags, types, importance |
| `memtrace_decide` | Log a decision with reasoning (audit trail) |

All tools use the configured `agent_id` by default. Pass `agent_id` as a parameter to any tool for cross-agent shared memory.

```python
# Bind tools to agent + optional session
tools = create_memtrace_tools(client, agent_id="my_agent", session_id="sess_1")
```

### Session Management

`MemtraceSession` implements `SessionABC` from the OpenAI Agents SDK. It stores conversation history in-memory while persisting significant events as Memtrace memories.

```python
# Create a session (calls Memtrace API)
session = await MemtraceSession.create(
    client,
    agent_id="my_agent",
    metadata={"task": "onboarding"},       # session metadata
    inject_context=True,                    # inject prior memories (default: True)
    context_since="24h",                    # prior context time window
    context_max_tokens=4000,                # max tokens for injected context
    persist_user_messages=True,             # store user messages as memories (default)
    persist_assistant_messages=False,        # store assistant messages (default: False)
)

# Use with Runner
result = await Runner.run(agent, "Hello", session=session)

# Close when done
await session.close()
```

### Cross-Session Memory

When `inject_context=True` (default), the session fetches prior memory context from Memtrace and injects it as the first conversation item. This gives the agent continuity across sessions without manual history management.

### Error Handling

Memtrace SDK exceptions propagate from tool invocations:

```python
from memtrace import MemtraceError, AuthenticationError, NotFoundError

try:
    result = await Runner.run(agent, "Hello", session=session)
except AuthenticationError:
    print("Invalid Memtrace API key")
except MemtraceError as e:
    print(f"Memtrace error ({e.status_code}): {e.message}")
```

## Full Examples

Complete runnable examples are available in the [arc-memory repository](https://github.com/basekick-labs/arc-memory):

- OpenAI API examples: `/examples/openai/`
  - `single_agent.py` - Single agent memory loop
  - `multi_agent.py` - Two agents sharing memory

- OpenAI Agents SDK: `/integrations/openai-agents/`
  - Full package with tools and session management
  - Test suite and examples
