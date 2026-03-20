import { GatewayRouter } from '../gateway/router.js';
import { AgentWorker } from '../core/agent/worker.js';
import { getAgentConfig } from '../core/agent/registry.js';
import { startTaskWorker } from '../automation/scheduler.js';

// Intercept globally escaping AbortErrors from node-fetch dropping stream connections.
process.on('uncaughtException', (err: Error & { type?: string }) => {
  if (err.name === 'AbortError' || err.type === 'aborted') {
    return; // Safely ignore, this happens when we purposefully abort the agent session stream
  }
  console.error('Fatal Application Error:', err);
  process.exit(1);
});

async function main() {
  console.log('Starting GeminiClaw Background Worker...');

  const cwd = process.cwd();

  // 1. Boot up the Gateway Router to intercept background payloads
  const gateway = new GatewayRouter('background-runner', ['automation']);
  gateway.onWorkerRequested(async ({ sessionId, personaId, mode }) => {
    // Only headless mode is expected from automation
    const config = getAgentConfig(personaId);
    const worker = new AgentWorker(config, cwd, mode, sessionId);
    await worker.start();
  });

  // 2. Start checking BullMQ
  startTaskWorker();

  console.log('Worker is now listening for jobs on BullMQ via Redis!');

  // Keep alive hooks
  process.on('SIGINT', () => {
    console.log('Shutting down worker...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal Worker Error:', err);
  process.exit(1);
});
