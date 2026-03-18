# Gateway Layer (`src/gateway/`)

The Gateway is the routing engine for GeminiClaw. 

## Responsibilities
- **Message Routing**: Analyzing incoming requests from various `channels/` and routing them to the appropriate agent or workflow.
- **Standardization**: Normalizing inputs from different platforms (CLI, Telegram, Webhook) into standard protocol messages.

## Architectural Constraints
- **Dependencies**: The Gateway depends strictly on `src/protocol/` to emit events. It MUST NOT directly invoke methods in `src/core/` or `src/automation/`.
