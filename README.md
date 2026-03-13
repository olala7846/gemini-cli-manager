# Gemini Manager

Harness the power of Gemini CLI (existing Google subscription) by leveraging the geminicli

## Goal / Vision
Fill the gap of what Google don't build (Remote Control, Dashboard, Workflow) for Gemini CLI

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
   cd ../harness-gemini
   npm install
   ```

## Ideas

### Phase 1 (Control Gemini CLI)
- [x] Being able to trigger Gemini CLI programmatically (not through terminal)
- [x] Being able to send message and receive message from Gemini CLI
- [x] Being able to programmtically give initial prompts (instruction) and overwrite system prompts to Gemini CLI (system prompt environment variable already exists)

**Status:** Completed via direct integration with the `@google/gemini-cli-sdk`. By importing the `GeminiCliAgent` and `GeminiCliSession` primitives into a custom Node.js wrapper, we completely bypassed the terminal UI. This allows for asynchronous stream parsing, strongly typed JSON event handling (e.g. `content`, `tool_call_request`), and dynamic overriding of the system prompt and working directory (`cwd`) at runtime.

### Phase 1.5 (Status Communication)
- [x] Being able to reliably track task progress from Gemini CLI

**Status:** Completed via explicit `ReportStatusTool` injection. Initially, passing Zod schemas into the `@google/gemini-cli-sdk` failed with prototype-chain errors because of monorepo package resolution issues mismatching the Zod versions. By standardizing `zod` to exactly `3.25.76` and using the `inputSchema` key to match the SDK's internal `ToolDefinition<T>` interface, the agent now successfully registers the tool. The background `AgentWorker` intercepts `tool_call_request` events for `report_status`, halting the execution stream and bubbling up the `status_update` event to the `chat-with-agent-cli` UI.

### Phase 2 (Routing)
- Route Gemini CLI Inbound and outbound messages to a queue (RabbitMQ) or Pub/Sub channel for routing (potentiall route the message to chat bot or other UX)
- Being able to trigger gemini cli with predefined prompts
- Being able to Schedule command to Gemini CLI (specific time or periodically through cron)
- Being able to orchestrate different works depends on each other (Workflow)

### Phase 3 (Console UI)
- Being able to view the status of the agent
- Being able to schedule and orchesetrate agent workflow