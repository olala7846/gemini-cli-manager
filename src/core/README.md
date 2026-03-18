# Core Layer (`src/core/`)

The Core System Layer is the brain of GeminiClaw, managing state, execution, and memory.

## Responsibilities
- **Execution Engine**: Managing LLM interactions and tool executions.
- **State Management**: Handling active session context and progressive memory disclosure.
- **Agent Personas**: Defining specific rules, instructions, and behaviors for multi-agent workflows.

## Architectural Constraints
- **Isolation**: The core layer must remain completely agnostic to the origin of the events it processes.
- **Communication**: It only listens for tasks over the Event Bus (`src/protocol/bus.ts`) and emits standard result events. It NEVER returns responses directly to an HTTP request or CLI terminal.

## Sub-Components
- `agent/`: Contains the Gemini CLI orchestration, tools, and the `AgentWorker`.
- `session/`: JSON-backed fast-access session and chat history management.
- `memory/`: Long-term memory storage backed by Markdown and progressive summarization.
