---
Document Gardener Last Check 2026-03-19-13:04: completed
---

# GeminiClaw

GeminiClaw is a specialized personal agent powered by the Gemini CLI. It acts as the core engine for a Claw-like personal assistant, equipped with persistent memory, robust session management, and intelligent agent routing.

## High-Level Concept

- **Core Engine**: Leverages the Gemini CLI as the underlying intelligence for the assistant.
- **Memory System**: Implements persistent memory using specialized pipelines (`AGENTS.md`, `MEMORY.md`, and `HISTORY.md`).
- **Session Management**: Builds upon existing Gemini CLI sessions, adding the ability to retrieve, resume, and learn from past interactions.
- **Agent Gateway**: An intelligent router that directs messages to specific specialized agents based on user configuration.

## Installation

Because the `@google/gemini-cli-sdk` is not publicly published to NPM, this project expects a local clone of the `gemini-cli` repository to be present in the parent directory.

1. Clone the `gemini-cli` repository into your workspace alongside this project:
   ```bash
   cd ..
   git clone git@github.com:google-gemini/gemini-cli.git
   ```
2. Build the `gemini-cli` dependencies:
   ```bash
   cd gemini-cli
   npm install
   npm run build
   ```
3. Return to this repository and install the local packages:
   ```bash
   cd ../gemini-manager
   npm install
   ```

*(Optional)* If you also want to make the `gemini` CLI command available globally in your terminal, you can install it from source by creating a symlink. Run the following inside the `gemini-cli` directory:

```bash
cd ../gemini-cli
sudo npm link
```

## Usage

You can test the latest interactive CLI environment by running the local bootstrap command:
```bash
npm run start:cli -- <agent-id> --prompt "Hello Gemini"
```

## Architecture Overview

GeminiClaw enforces a strict, unidirectional architecture utilizing an Inversion of Control paradigm. Dependencies flow exclusively inward toward the protocol bus, algorithmically protected by ESLint.

- **`src/protocol/`**: The internal Event Bus and strictly-typed message contracts. Contains zero dependencies.
- **`src/core/`**: The system's brain. Orchestrates the Gemini CLI workers, persists session memory, and handles intelligent execution.
- **`src/gateway/`**: The traffic router. Normalizes inbound requests and routes them to the appropriate Core agents. 
- **`src/channels/`**: The external I/O integrations (CLI, Telegram, APIs).
- **`src/automation/`**: Background CRON scheduling and task queuing for data maintenance.
- **`src/bin/`**: The orchestration layer. These are the only executable files allowed to safely bypass boundaries to instantiate the application (e.g., `src/bin/cli.ts`).

## Roadmap & Progress Tracking

To see the comprehensive future plans and milestones for this project, please view the [Roadmap](docs/ROADMAP.md).

### Proof of Concept (PoC) Tracker
The ongoing progress of the GeminiClaw Phase 1 PoC is strictly tracked in [`docs/poc-plan.json`](docs/poc-plan.json). 

**Agent Contract:** This JSON file acts as the single source of truth for the structural contract across all workstreams. **Any agent executing work in this repository MUST update the status and progress in `poc-plan.json` matching the relevant task.**