# Task Automation & Gateway Router Planning

This document serves as the master planning and tracking record for bridging the gap between the Task Automation layer, Gateway Router, and the Core Agent Worker.

---

## 1. Gap Analysis: Task Automation to Core Execution Flow

This section analyzes the gap between the ideal architecture defined in `ARCHITECTURE.md` and the current implementation state for the following flow:
**Task automation -> Gateway Router -> Multi-Agent Personas -> Gemini CLI core agent execution**

### 1.1 Task Automation
*Responsible for triggers, cron jobs, and task queues.*

- **Ideal State:**
  - Robust background execution system using `BullMQ`.
  - DAG Task DB for workflows and retries.
  - Cron-like scheduler to trigger periodic maintenance (e.g., nightly workers, memory compaction).
  - Emits payloads over the `src/protocol/` bus to trigger actions.
- **Current Status:** **Not Implemented (Conceptual)**
  - `src/automation/` contains only structural stubs (`README.md`, `poc-plan.json`).
  - No queuing system, schedulers, or background workers exist.
- **Gap:** 100%. We need to instantiate the `BullMQ` integration, define task schemas, and wire events to the protocol bus.

### 1.2 Gateway Router
*Responsible for receiving external/internal events and routing them.*

- **Ideal State:**
  - Express API and Webhooks handler.
  - Message Router that normalizes inputs from all channels (CLI, Telegram, Task Automation) into standard protocol messages.
  - Routes requests to specific Agent Personas based on intent or metadata.
- **Current Status:** **Not Implemented (Conceptual)**
  - `src/gateway/` contains only structural stubs (`README.md`, `poc-plan.json`).
  - The Event Bus (`src/protocol/bus.ts`) exists, but the logical Gateway Router component that sits on top to direct traffic is completely unwritten.
- **Gap:** 100%. We need an application router capable of subscribing to the bus and orchestrating messages.

### 1.3 Multi-Agent Personas
*Responsible for maintaining distinct agent contexts and behaviors.*

- **Ideal State:**
  - Distinct personas (e.g., Primary Assistant, Specialized Worker) with unique system prompts and skills mapping.
  - Dynamic assignment and selection from the Gateway Router.
  - Interaction with external `SessionStore` and `MemStore`.
- **Current Status:** **Partially Implemented (Foundational)**
  - An underlying registry system is implemented (`src/core/agent/registry.ts`). It loads configurations from `agents.json`, allowing multiple agent definitions (prompts, models, skills).
  - However, dynamic agent persona switching, complex persona networking, and persistent Session/Memory stores are not fully wired up. The system currently revolves around a single initialized instance of `AgentWorker`.
- **Gap:** 50%. The static framework for personas exists, but the dynamic runtime coordination and persistent memory context modules are missing.

### 1.4 Gemini CLI Core Agent Execution
*Responsible for LLM invocation, tool execution, and state handling.*

- **Ideal State:**
  - Headless API wrapper around `@google/gemini-cli-sdk`.
  - Capable of interactive and headless execution.
  - Resilient to infinite loops, silent halting, and required tool executions.
  - Communicates asynchronously via the protocol bus.
- **Current Status:** **Implemented & Robust**
  - `src/core/agent/worker.ts` provides a highly functional integration.
  - Subscribes and publishes correctly via `src/protocol/bus.ts`.
  - Implements complex worker states (`RUNNING`, `PAUSED`, `STOPPED`).
  - Supports `headless` mode with YOLO guardrails (e.g., mitigating infinite `INPUT_NEEDED` loops, `SILENT_HALTING` nudges).
  - Integrates predefined tool validations (`ReportStatusTool`).
- **Gap:** 0-10%. This is the most mature piece. Any upcoming work here will likely just be minor protocol tweaks to accommodate the new Gateway Router.

**Executive Summary of the Critical Path:**
The fastest path to complete this flow requires focusing sequentially from the bottom-up or top-down. Given the Core Agent Execution works, the immediate next steps are:
1. **Build the Gateway Router:** We need the connective tissue. Currently, CLI inputs are directly hardcoded to the Agent Worker in `src/channels/cli/`. The Gateway must be built to intercept standard protocol messages and route them.
2. **Build the Automation Trigger:** Implement a basic task publisher using `BullMQ` in `src/automation/` that fires a dummy payload into the protocol bus.
3. **Connect the Flow:** Prove that the Automation trigger -> hits the Gateway -> which instantiates the proper Persona -> and runs the Gemini CLI Core execution.

---

## 2. Implementation Plan

### Refactoring Core (Worker Filtering)
Currently, all `AgentWorker` instances listen to every message on the global event bus. We need workers to only process messages intended for their session.

#### [MODIFY] src/core/agent/worker.ts
- Add `sessionId` to the `AgentWorker` constructor parameters (or include it in `AgentConfig`).
- Update `subscribeInbound((msg) => {...})` to early-return if `msg.meta.sessionId !== this.sessionId`.

#### [MODIFY] src/core/agent/worker.test.ts
- Update the mock instantiations of `AgentWorker` to include a dummy `sessionId`.

### Gateway Layer
The Gateway receives events and spins up `AgentWorker` instances dynamically if a session doesn't exist yet, passing the payload configuration.

#### [NEW] src/gateway/router.ts
- Create a `GatewayRouter` class.
- Hold a private map: `Record<string, AgentWorker>`.
- `subscribeInbound` to the `agentBus`.
- When an `InboundMessage` is received (e.g., `prompt` or `session_start`):
  - Check if `msg.meta.sessionId` exists in the map.
  - If not, lookup the requested persona (defaulting to the primary CLI agent if none provided in `session_start`).
  - Instantiate a new `AgentWorker` with the requested configuration and `start()` it.
  - Re-emit the prompt to the event bus so the newly spun-up worker catches it (or pass it directly if bypassing the bus for the first tick, though bus is preferred for pure decoupling).

#### [NEW] src/gateway/router.test.ts
- Unit tests to verify that the router correctly instantiates a worker on the first payload, and doesn't duplicate workers on subsequent payloads.

### Automation Layer
The automation trigger that acts as the "Cron/Queue".

#### [NEW] src/automation/scheduler.ts
- For the fastest path, we implement a `triggerAutomationTask(persona: string, prompt: string)` function.
- It will generate a random `sessionId` and emit an `InboundMessage` of type `session_start` and later `prompt` with `meta: { sessionId, channel: 'automation' }`.

#### [NEW] src/automation/scheduler.test.ts
- Unit tests to verify that calling the trigger correctly formats and emits messages to `agentBus`.

### System Wiring

#### [MODIFY] src/bin/cli.ts
- Remove the direct instantiation of `new AgentWorker(...)`.
- Instantiate and start the new `GatewayRouter` singleton.
- Pass the `initialPrompt` to `runCLI()`. The `runCLI()` function will emit it via the bus, the Gateway will catch it, instantiate the worker, and handle it.

### Verification Plan

#### Automated Tests
- Run `npm run lint` and `npm run test` to verify no regressions in the `.test.ts` files, particularly ensuring `worker.Integration.test.ts` still passes with the new `sessionId` filtering.
- Run the new unit tests: `npx vitest run src/gateway/router.test.ts` and `npx vitest run src/automation/scheduler.test.ts`.

#### Manual Verification
- **Test 1 (Standard CLI Flow):** Run `npm run start:cli -- "Hello"`. Verify the Gateway intercepts it, spawns the correct Persona, and returns the response to standard output.
- **Test 2 (Automation Flow):** We will temporarily add a 5-second timeout in `src/bin/cli.ts` that fires `triggerAutomationTask(...)`. If the wiring is correct, we should see output from the automation channel interleaved or printed to the terminal, proving the Gateway successfully routed the background task.

---

## 3. Implementation Checklist

- [x] Install missing dependencies (e.g. `bullmq` if opting for full implementation, or skip if stubbing). (Resolves **1.1**) `31d7d42`
- [x] **Gateway Layer (Resolves 1.2)** `69eb9a1`
  - [x] Create `src/gateway/router.ts`. `69eb9a1`
  - [x] Implement `GatewayRouter` logic to intercept `session_start`/`prompt` from the bus. `69eb9a1`
  - [x] Implement Persona resolution logic (mapping incoming metadata to specific `AgentConfig`). `69eb9a1`
  - [x] Create unit tests for `router.ts`. `69eb9a1`
- [x] **Multi-Agent Context & Persistence (Resolves 1.3)** `f1bbcd5`
  - [x] Create interface definition for external `SessionStore` (for chat history). `f1bbcd5`
  - [x] Create interface definition for external `MemStore` (for long-term observations). `f1bbcd5`
  - [x] Update `AgentWorker` initialization to hydrate conversation history from the `SessionStore`. `f1bbcd5`
- [x] **Refactor Core Worker (Resolves 1.4)** `69eb9a1`
  - [x] Modify `AgentWorker` to accept `sessionId` and selectively filter bus events. `69eb9a1`
  - [x] Update `worker.test.ts` to reflect the new `sessionId` requirement. `69eb9a1`
- [x] **Automation Layer (Resolves 1.1)** `ffb7c71`
  - [x] Define standard task payload schema for automation triggers. `ffb7c71`
  - [x] Create `src/automation/scheduler.ts` stub/trigger to fire automation events. `ffb7c71`
  - [x] Create unit tests for `scheduler.ts`. `ffb7c71`
- [x] **Wiring it all together (Connects the flow)** `69eb9a1`
  - [x] Update `src/bin/cli.ts` to boot the `GatewayRouter` instead of `AgentWorker` directly. `69eb9a1`
  - [x] Verify manual end-to-end local CLI functionality. (Tested natively via `schedule.ts` injected queue and `worker.ts` listener daemon)
