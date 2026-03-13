# Harness Gemini 


Harness the power of Gemini CLI


## Ideas

### Phase 1 (Control Gemini CLI)
- [x] Being able to trigger Gemini CLI programmatically (not through terminal)
- [x] Being able to send message and receive message from Gemini CLI
- [x] Being able to programmtically give initial prompts (instruction) and overwrite system prompts to Gemini CLI (system prompt environment variable already exists)

**Status:** Completed via direct integration with the `@google/gemini-cli-sdk`. By importing the `GeminiCliAgent` and `GeminiCliSession` primitives into a custom Node.js wrapper, we completely bypassed the terminal UI. This allows for asynchronous stream parsing, strongly typed JSON event handling (e.g. `content`, `tool_call_request`), and dynamic overriding of the system prompt and working directory (`cwd`) at runtime.

### Phase 2 (Routing)
- Route Gemini CLI Inbound and outbound messages to a queue (RabbitMQ) or Pub/Sub channel for routing (potentiall route the message to chat bot or other UX)
- Being able to trigger gemini cli with predefined prompts
- Being able to Schedule command to Gemini CLI (specific time or periodically through cron)
- Being able to orchestrate different works depends on each other (Workflow)