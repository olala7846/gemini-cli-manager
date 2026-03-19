# AGENTS.md

You are interacting with the `gemini-manager` repository. Your goal is to respect the architectural boundaries defined below to ensure the system remains modular, testable, and stable.

## Pre-Flight Checks
Before starting to build *any* features, you MUST:
1. **Initialize Environment:** Run `./init.sh` to ensure all NPM dependencies and local SDK symlinks are correctly established. Do this before making any code changes.
2. **Verify Architectural Boundaries:** Run `npm run lint` to run the strict unidirectional dependency checks. If the linter is failing due to `no-restricted-imports` violations, you MUST halt and fix the boundaries immediately.
3. **Verify Tests:** Run `npm run test` to ensure all existing unit and integration tests are passing.

## High-Level Architecture
`gemini-manager` is a headless, programmatic wrapper around the `@google/gemini-cli-sdk`. Its primary purpose is to bypass the CLI's standard terminal UI, allowing us to orchestrate the LLM, inject custom tools (like status reporting), and handle inputs/outputs programmatically.

The system is strictly divided into decoupled module layers:
1. **`src/protocol/` (The Base Event Bus Layer)**
2. **`src/core/` (LLM Engine, Agents, Session & Memory State)**
3. **`src/gateway/` (The Request Router)**
4. **`src/automation/` (Background Queues & CRON Tasks)**
5. **`src/channels/` (External I/O Interfaces: CLI, Telegram, API)**
6. **`src/bin/` (Application Composers and Executables)**

## Strict Architectural Constraints

### 1. Inversion of Control via the Protocol Bus
Channels MUST NOT directly invoke or instantiate objects from the Core layer.
- **Rule:** All communication across boundaries MUST happen asynchronously by publishing and subscribing to the `agentBus` inside `src/protocol/bus.ts`.
- **Why:** This ensures the Agent can easily be moved to a separate process, container, or background queue without rewriting the I/O logic. 

### 2. Strict Typographic Contracts
All events across the `protocol/bus` must strictly adhere to the interfaces defined in `src/protocol/messages.ts`. Do not hallucinate properties on message objects. If a new capability is needed, you must update the type definitions first.

### 3. Zod Versioning for Tool Injection
The SDK strictly checks `instanceof ZodType` when validating injected tools.
- **Rule:** If you are modifying tool schemas (e.g., in `src/core/agent/statusTool.ts`), you MUST ensure that the imported `zod` version perfectly matches the version expected by the local `@google/gemini-cli-sdk`.

## Agent CLI Hooks
- Start interactive test: `npm run start:cli`
- Run local linting: `npm run lint`
- Run automated tests: `npm run test`
