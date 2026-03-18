# Channels Layer (`src/channels/`)

This directory contains all external interfaces for GeminiClaw. It serves as the primary I/O boundary.

## Responsibilities
- **Ingestion**: Receiving user prompts, API requests, and webhook payloads.
- **Delivery**: Formatting and streaming responses back to the user or external systems.

## Architectural Constraints
- **Inversion of Control**: Channels MUST NOT directly import or invoke classes from `src/core/` (e.g., `AgentWorker`). 
- **Communication**: Channels must communicate with the rest of the system by emitting events to `src/gateway/` or directly publishing/subscribing to the asynchronous Event Bus (`src/protocol/bus.ts`).

## Sub-Components
- `cli/`: Local terminal interface bypassing standard UI.
- `telegram/`: Telegram Bot API integration (via grammY).
- `api/`: REST API / Webhooks (via express).
