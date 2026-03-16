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
   cd ../gemini-manager
   npm install
   ```

*(Optional)* If you also want to make the `gemini` CLI command available globally in your terminal, you can install it from source by creating a symlink. Run the following inside the `gemini-cli` directory:

```bash
cd ../gemini-cli
sudo npm link
```

## Usage

Once the local SDK is built and dependencies are installed, you can trigger the custom wrapper CLI.

### Interactive Mode
To start an interactive chat session with the background Agent Worker:
```bash
npm run start:cli <agent> -- [--prompt "Optional initial prompt"]
```

### Headless Scheduling (YOLO Mode)
If you want to run an agent as a background task (e.g. via `cron`), you can use the `--headless` flag. In this mode, the agent is forced to use its best judgment and skip asking clarifying questions. The process will naturally exit `0` on completion or `1` on failure.

You can combine this with predefined prompts configured in `agents.json`:

1. Define a prompt in `agents.json`:
```json
{
  "prompts": {
    "my_task": "Analyze the codebase and write a summary..."
  }
}
```

2. Run it headlessly:
```bash
npm run start:cli coding-agent -- --prompt-name my_task --headless
```

## Roadmap

To see the completed phases and future plans for this project, please view the [Roadmap](docs/ROADMAP.md).