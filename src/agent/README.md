# Source Component: `agent`

This directory houses the LLM Execution Engine. It is responsible for instantiating the `@google/gemini-cli-sdk`, managing the LLM session capabilities, and injecting custom behavior via Tools.

## Core Responsibilities
- **`worker.ts`**: The primary `AgentWorker` class. It initializes the `GeminiCliAgent` and listens for `InboundMessage` events from the Protocol Bus. As the LLM stream resolves, it translates those stream chunks back into `OutboundMessage` events.
- **`registry.ts`**: Parses the `agents.json` configuration file, allowing for dynamically loaded system prompts and tool constraints based on an `Agent ID`.
- **`statusTool.ts`**: A custom injected explicit tool designed for agent state tracking (e.g., `COMPLETED` or `BLOCKED`).

## Architectural Constraints
- The Agent worker MUST NOT be aware of how the interface is delivered. It should never use `console.log` directly. All LLM text and events must be piped down using `publishOutbound()`.
- **Zod Dependency:** When modifying tools, do not alter the `zod` package version, as doing so will break the `instanceof ZodType` check inside the underlying Google CLI SDK during startup.
