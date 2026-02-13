---
sidebar_position: 2
---

# Customer Support

AI support agents handling conversations across channels. Each agent remembers the full customer history — previous tickets, resolutions, preferences — without re-reading everything from scratch. Multiple agents share context about the same customer in real time.

## The Challenge

Customer support agents face unique memory requirements:

- **Customer continuity** - Customers expect agents to remember previous interactions
- **Cross-channel consistency** - Support across chat, email, phone should share context
- **Multi-agent coordination** - Multiple agents may interact with same customer
- **Department handoffs** - Smooth transitions between specialized agents
- **Historical context** - Access to full customer history without manual search

## How Memtrace Helps

Memtrace enables shared memory across agents and channels:

- **Shared sessions** - Multiple agents read/write to same session
- **Cross-agent visibility** - Each agent sees what others have done
- **Session metadata** - Identify sessions by customer ID or account number
- **Time-windowed context** - Recent interactions with full historical access
- **Attribution** - Track which agent handled which interaction

## Example: Multi-Department Support

Three support agents (Internet, TV, Billing) share memory for seamless customer experience.

### Setup

```python
from memtrace import Memtrace, RegisterAgentRequest, CreateSessionRequest

memtrace = Memtrace("http://localhost:9100", "mtk_...")

# Register specialized agents
internet_agent = memtrace.register_agent(RegisterAgentRequest(
    name="internet-support",
    description="Handles internet connectivity and router issues",
))

tv_agent = memtrace.register_agent(RegisterAgentRequest(
    name="tv-support",
    description="Handles TV channels and set-top box issues",
))

billing_agent = memtrace.register_agent(RegisterAgentRequest(
    name="billing-support",
    description="Handles charges, credits, and billing disputes",
))
```

### Customer Session

```python
# Customer contacts internet support
session = memtrace.create_session(CreateSessionRequest(
    agent_id=internet_agent.id,
    metadata={
        "customer_id": "cust_12345",
        "account_number": "A-789456",
        "channel": "chat",
    },
))

# Internet agent stores interaction
memtrace.remember(
    internet_agent.id,
    "Customer reports slow internet speeds. Diagnosed: router needs firmware update.",
    session_id=session.id,
    tags=["internet", "router", "firmware"],
    importance=0.8,
)

memtrace.decide(
    internet_agent.id,
    "Send router firmware update instructions",
    "Router on old firmware version 2.1, update to 2.4 should resolve speed issues",
)
```

### Cross-Department Access

```python
# Later, customer contacts TV support (same session)
# Find active session by customer ID
sessions = memtrace.search_sessions({
    "metadata": {"customer_id": "cust_12345"},
    "status": "active",
})

session = sessions.sessions[0]

# TV agent reads full history
ctx = memtrace.get_session_context(session.id, ContextOptions())

# TV agent sees previous interaction
# Context includes:
# - Internet agent diagnosed router firmware issue
# - Router update instructions were sent
# - Customer had connectivity problems

# TV agent can reference this
memtrace.remember(
    tv_agent.id,
    "Customer mentions TV buffering. Likely related to internet issues from earlier today.",
    session_id=session.id,
    tags=["tv", "buffering", "related_to_internet"],
    importance=0.7,
)
```

### Department Handoff

```python
# TV agent discovers billing issue
memtrace.remember(
    tv_agent.id,
    "Customer asking about HBO charge they don't recognize",
    session_id=session.id,
    tags=["billing_issue", "hbo", "handoff_needed"],
    importance=0.9,
)

memtrace.decide(
    tv_agent.id,
    "Transfer to billing department",
    "HBO charge inquiry requires billing agent expertise",
)

# Billing agent picks up with full context
ctx = memtrace.get_session_context(session.id, ContextOptions())

# Billing agent sees:
# - Original internet router issue (resolved)
# - TV buffering question
# - Customer concerned about HBO charge
# Can address billing issue with full background
```

## Example: Telegram Support Bots

Three Telegram bots acting as customer support departments for a fictional telco "TeleCo".

### Bot Configuration

```python
# Three bots, one shared customer session
BOTS = {
    "internet": {
        "token": os.getenv("BOT_TOKEN_INTERNET"),
        "agent_id": "internet-support",
        "name": "Juan",
    },
    "tv": {
        "token": os.getenv("BOT_TOKEN_TV"),
        "agent_id": "tv-support",
        "name": "Martin",
    },
    "billing": {
        "token": os.getenv("BOT_TOKEN_BILLING"),
        "agent_id": "billing-support",
        "name": "Cecilia",
    },
}
```

### Session Management

```python
async def get_or_create_session(customer_id: str, agent_id: str):
    """Find active session or create new one"""

    # Look for existing active session
    sessions = memtrace.search_sessions({
        "metadata": {"customer_id": customer_id},
        "status": "active",
    })

    if sessions.sessions:
        return sessions.sessions[0]

    # Create new session
    return memtrace.create_session(CreateSessionRequest(
        agent_id=agent_id,
        metadata={
            "customer_id": customer_id,
            "channel": "telegram",
        },
    ))
```

### Message Handling

```python
async def handle_message(bot_config, telegram_user_id, message_text):
    """Handle incoming message with full cross-bot context"""

    # Get or create session
    session = await get_or_create_session(telegram_user_id, bot_config["agent_id"])

    # Get full history (including other bots)
    ctx = memtrace.get_session_context(session.id, ContextOptions(since="7d"))

    # Create system prompt with full context
    system_prompt = f"""
You are {bot_config["name"]}, a {bot_config["agent_id"]} agent for TeleCo.

{ctx.context}

You can see interactions from all departments. Reference them when relevant.
"""

    # Process with LLM (Claude, GPT, etc.)
    response = await process_with_llm(system_prompt, message_text)

    # Store interaction with agent attribution
    memtrace.remember(
        bot_config["agent_id"],
        f"Customer: {message_text}",
        session_id=session.id,
        tags=["customer_message", bot_config["agent_id"]],
    )

    memtrace.remember(
        bot_config["agent_id"],
        f"Response: {response}",
        session_id=session.id,
        tags=["agent_response", bot_config["agent_id"]],
    )

    return response
```

### Photo Support

```python
async def handle_photo(bot_config, telegram_user_id, photo):
    """Handle customer photos (error screenshots, etc.)"""

    session = await get_or_create_session(telegram_user_id, bot_config["agent_id"])

    # Store photo reference
    memtrace.remember(
        bot_config["agent_id"],
        f"Customer sent photo: {photo.file_id}",
        session_id=session.id,
        tags=["photo", "error_screenshot"],
        metadata={"photo_file_id": photo.file_id},
        importance=0.9,
    )

    # Process photo with multimodal LLM
    # Claude can analyze screenshots for error messages
    response = await analyze_photo_with_llm(photo, session)

    return response
```

### Identity Verification

```python
CUSTOMERS = {
    "nacho": {"customer_id": "cust_001", "account": "A-789456"},
    "maria": {"customer_id": "cust_002", "account": "A-789457"},
    "alex": {"customer_id": "cust_003", "account": "A-789458"},
}

async def verify_customer(first_name: str):
    """Verify customer by first name"""
    if first_name.lower() in CUSTOMERS:
        customer = CUSTOMERS[first_name.lower()]
        return customer["customer_id"]
    return None
```

## Example: Call Center with Multiple Agents

A call center with 50 AI agents sharing a memory pool. When a customer calls back, any agent instantly knows what happened last time.

### Agent Pool Setup

```python
# Register 50 agents
agents = []
for i in range(50):
    agent = memtrace.register_agent(RegisterAgentRequest(
        name=f"support-agent-{i}",
        description="General customer support agent",
    ))
    agents.append(agent)
```

### Customer Call Handling

```python
async def handle_call(customer_phone: str, assigned_agent_id: str):
    """Handle incoming call with any available agent"""

    # Find most recent session for this customer
    sessions = memtrace.search_sessions({
        "metadata": {"phone": customer_phone},
        "order": "desc",
        "limit": 1,
    })

    if sessions.sessions:
        # Resume previous session or create new one
        previous_session = sessions.sessions[0]

        # Get recent history (last 30 days)
        ctx = memtrace.get_session_context(
            previous_session.id,
            ContextOptions(since="30d"),
        )

        # Agent can see:
        # - Previous issues reported
        # - Resolutions attempted
        # - Customer preferences
        # - Sentiment from past interactions

        system_prompt = f"""
You are a customer support agent.

This customer has called before. Here's the history:

{ctx.context}

Acknowledge their previous issue and check if it's resolved.
"""
    else:
        # First-time caller
        system_prompt = "You are a customer support agent. This is a new customer."

    # Create new session for this call
    session = memtrace.create_session(CreateSessionRequest(
        agent_id=assigned_agent_id,
        metadata={
            "phone": customer_phone,
            "call_type": "inbound",
        },
    ))

    return system_prompt, session
```

### Call Resolution

```python
async def close_call(session_id: str, agent_id: str, resolution: str):
    """Mark call as resolved"""

    memtrace.remember(
        agent_id,
        f"Call resolved: {resolution}",
        session_id=session_id,
        tags=["resolution", "call_complete"],
        importance=1.0,
    )

    # Close session
    memtrace.close_session(session_id)
```

## Best Practices

### Use Session Metadata for Customer Identification

```python
metadata = {
    "customer_id": "cust_12345",
    "account_number": "A-789456",
    "phone": "+1234567890",
    "email": "customer@example.com",
}
```

### Tag by Department and Issue Type

```python
tags = [
    "internet",           # Department
    "router",             # Issue category
    "firmware_update",    # Specific issue
    "resolved",           # Status
]
```

### Store Important Customer Preferences

```python
memtrace.remember(
    agent_id,
    "Customer prefers email communication over phone",
    tags=["preference", "communication"],
    importance=0.9,
)
```

### Track Sentiment

```python
memtrace.remember(
    agent_id,
    "Customer satisfied with resolution",
    tags=["sentiment", "positive"],
    importance=0.7,
)
```

### Use Cross-Agent Recall

```python
# Agent reads memories from all agents
memories = memtrace.list_memories({
    "session_id": session.id,  # All agents in this session
    "since": "7d",
})
```

## Benefits

- **Seamless handoffs** - Agents have full context when taking over
- **No repeated questions** - Agents see what was already asked
- **Consistent support** - All agents reference same customer history
- **Faster resolution** - Agents don't start from scratch
- **Better experience** - Customers feel understood and remembered
