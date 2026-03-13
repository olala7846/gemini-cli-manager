# AGENTS.md

You are interacting with the `gemini-manager` repository. Your goal is to respect the architectural boundaries defined below to ensure the system remains modular, testable, and stable.

## High-Level Architecture
`gemini-manager` is a headless, programmatic wrapper around the `@google/gemini-cli-sdk`. Its primary purpose is to bypass the CLI's standard terminal UI, allowing us to orchestrate the LLM, inject custom tools (like status reporting), and handle inputs/outputs programmatically.

The system is strictly divided into three distinct decoupled modules:
1. **`src/cli/` (The Front-End / I/O Interface)**
2. **`src/agent/` (The LLM Execution Engine)**
3. **`src/protocol/` (The Asynchronous Event Bus)**

## Strict Architectural Constraints

### 1. Inversion of Control via the Protocol Bus
The `cli` layer MUST NOT directly invoke methods on the `AgentWorker` or `GeminiCliSession` to send messages.
- **Rule:** All communication between the User/CLI and the Agent MUST happen asynchronously by publishing and subscribing to the `agentBus` inside `src/protocol/bus.ts`.
- **Why:** This ensures the Agent can easily be moved to a separate process, container, or background queue (Phase 2 Routing) without rewriting the I/O logic.

### 2. Strict Typographic Contracts
All events across the `protocol/bus` must strictly adhere to the interfaces defined in `src/protocol/messages.ts`. Do not hallucinate properties on message objects. If a new capability is needed, you must update the type definitions first.

### 3. Zod Versioning for Tool Injection
The SDK strictly checks `instanceof ZodType` when validating injected tools.
- **Rule:** If you are modifying tool schemas (e.g., in `src/agent/statusTool.ts`), you MUST ensure that the imported `zod` version perfectly matches the version expected by the local `@google/gemini-cli-sdk`.

## Agent CLI Hooks
- Start interactive test: `npm run start:cli`
- Run local linting: `npm run lint`
