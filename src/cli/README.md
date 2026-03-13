# Source Component: `cli`

This directory represents the Front-End / I/O Interface for the `gemini-manager`. It is the entry point for human users executing the program via terminal commands.

## Core Responsibilities
- **`index.ts`**: Bootstraps the application, parses terminal arguments (like `--cwd` and user prompts), instantiates the `AgentWorker`, and traps Standard Input / Standard Output.

## Architectural Constraints
- This directory MUST be treated purely as an I/O driver.
- It MUST NOT contain any LLM prompting, streaming, or execution logic.
- When an input line is received from the user on the keyboard, the CLI MUST wrap that text into an `InboundMessage` payload and trigger `publishInbound()`. It must NEVER call `session.sendStream()` directly.
