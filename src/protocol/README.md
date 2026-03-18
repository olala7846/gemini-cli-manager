# Protocol Layer (`src/protocol/`)

This directory acts as the central asynchronous Event Bus interconnecting all components. It guarantees that the subsystems remain entirely decoupled.

## Core Responsibilities
- **`bus.ts`**: An abstract `EventEmitter` singleton called `agentBus`. It exposes strongly typed publish and subscribe hooks for `INBOUND` and `OUTBOUND` traffic.
- **`messages.ts`**: Contains the definitive TypeScript Interfaces corresponding to events flowing over the bus.

## Architectural Constraints
- The Protocol MUST remain naive to both the LLM implementation details AND the I/O environment (like `process.stdout`).
- **Data Integrity:** Any new feature requiring cross-communication (like passing a specific command payload or uploading a file path) MUST first have a strict type definition added to `messages.ts`. Agents are strictly forbidden from attaching untyped `.any` payloads to the bus to prevent silent dropping of events.
