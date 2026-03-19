import { getAgentConfig, getPredefinedPrompt } from '../core/agent/registry.js';
import { AgentWorker } from '../core/agent/worker.js';
import { runCLI } from '../channels/cli/index.js';
import { GatewayRouter } from '../gateway/router.js';

// Intercept globally escaping AbortErrors from node-fetch dropping stream connections.
// TODO: remove this handler once the SDK catches AbortErrors internally at the stream level.
process.on('uncaughtException', (err: Error & { type?: string }) => {
  if (err.name === 'AbortError' || err.type === 'aborted') {
    return; // Safely ignore, this happens when we purposefully abort the agent session stream
  }
  console.error('Fatal Application Error:', err);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);

  const agentId = args[0];
  let cwd = process.cwd();
  let initialPrompt = '';
  let isHeadless = false;

  let i = 1;
  while (i < args.length) {
    if (args[i] === '--cwd' && typeof args[i + 1] === 'string') {
      cwd = args[i + 1] as string;
      i += 2;
    } else if (args[i] === '--prompt' && typeof args[i + 1] === 'string') {
      initialPrompt = args[i + 1] as string;
      i += 2;
    } else if (args[i] === '--prompt-name' && typeof args[i + 1] === 'string') {
      initialPrompt = getPredefinedPrompt(args[i + 1] as string);
      i += 2;
    } else if (args[i] === '--headless') {
      isHeadless = true;
      i += 1;
    } else {
      i++;
    }
  }

  if (!agentId || agentId.startsWith('--')) {
    console.error('Usage: chat-with-agent-cli <agent-id> [--cwd ./path] [--prompt "Initial text"]');
    process.exit(1);
  }

  // 1. Boot up the Gateway Router
  const gateway = new GatewayRouter(agentId, ['cli', 'telegram']);
  gateway.onWorkerRequested(async ({ sessionId, personaId, mode }) => {
    const config = getAgentConfig(personaId);
    const worker = new AgentWorker(config, cwd, mode, sessionId);
    await worker.start();
  });

  // 2. Boot up the CLI Interface (Channels)
  runCLI(isHeadless, initialPrompt);
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
