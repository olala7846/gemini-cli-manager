# Protocol Layer (`src/protocol/`)

This directory acts as the central asynchronous Event Bus interconnecting all components. It guarantees that the subsystems remain entirely decoupled.

## Core Responsibilities
- **`bus.ts`**: An abstract `EventEmitter` singleton called `agentBus`. It exposes strongly typed publish and subscribe hooks for `INBOUND` and `OUTBOUND` traffic.
- **`messages.ts`**: Contains the definitive TypeScript Interfaces corresponding to events flowing over the bus.

## Architectural Constraints
- The Protocol MUST remain naive to both the LLM implementation details AND the I/O environment (like `process.stdout`).
- **Data Integrity:** Any new feature requiring cross-communication (like passing a specific command payload or uploading a file path) MUST first have a strict type definition added to `messages.ts`. Agents are strictly forbidden from attaching untyped `.any` payloads to the bus to prevent silent dropping of events.

## Gateway Routing & Use Cases

The protocol relies on a `MessageMeta` wrapper to route messages correctly across channels (CLI, Telegram, API) to their respective sessions, maintaining strict boundaries and multiplexing many sessions over the single `agentBus`.

### Use Case 1: Simple Chat Interaction
A user sends a simple prompt via Telegram. The Gateway translates this and routes it via the bus.
**Inbound (Gateway -> Agent)**
```json
{
  "meta": { "sessionId": "tg_12345", "channel": "telegram" },
  "type": "prompt",
  "content": "What's the weather?"
}
```
**Outbound (Agent -> Gateway)**
```json
{
  "meta": { "sessionId": "tg_12345", "channel": "telegram" },
  "type": "content",
  "content": "It's sunny today!"
}
```

### Use Case 2: Human-in-the-Loop (Pause/Resume)
An agent pauses execution to ask the user a clarifying question before proceeding with a destructive action.
**Outbound (Agent -> Gateway)**
```json
{
  "meta": { "sessionId": "cli_user", "channel": "cli", "traceId": "req-999" },
  "type": "input_needed",
  "reason": "Confirm irreversible action: Delete table users?"
}
```
**Inbound (Gateway -> Agent)**
```json
{
  "meta": { "sessionId": "cli_user", "channel": "cli", "traceId": "req-999" },
  "type": "resume_task",
  "content": "Yes, proceed."
}
```

### Use Case 3: Agent Persona Routing 
A user or external trigger wants to spawn a completely fresh session with a specific specialized agent (e.g. a coding agent vs a finance agent).
**Inbound (Gateway -> Agent)**
```json
{
  "meta": { "sessionId": "finance_session_1", "channel": "api" },
  "type": "session_start",
  "persona": "finance_agent"
}
```

### Use Case 4: Background Task Automation
A scheduled Cron job kicks off a background memory compaction routine for a user.
**Inbound (Cron -> Agent)**
```json
{
  "meta": { "sessionId": "user_789", "channel": "automation" },
  "type": "system_override",
  "content": "<compact memory for past 10 turns>"
}
```
**Outbound (Agent -> Cron/Logs)**
```json
{
  "meta": { "sessionId": "user_789", "channel": "automation" },
  "type": "task_completed",
  "reason": "Memory compacted successfully."
}
```

### Use Case 5: Cross-Agent Communication (Subagents)
An agent delegates a complex coding task to a specialized coding subagent. The original session acts as the `sourceSessionId`.
**Inbound (Main Agent -> Subagent)**
*Note: This utilizes the bus but targets the subagent session.*
```json
{
  "meta": { 
    "sessionId": "coding_subagent_22", 
    "channel": "automation",
    "sourceSessionId": "main_session_1" 
  },
  "type": "prompt",
  "content": "Write a python script to parse logs."
}
```
