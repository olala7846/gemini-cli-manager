import * as readline from 'node:readline';
import { getAgentConfig } from '../agent/registry.js';
import { AgentWorker } from '../agent/worker.js';
import { publishInbound, subscribeOutbound } from '../protocol/bus.js';

// Intercept globally escaping AbortErrors from node-fetch dropping stream connections.
// TODO: remove this handler once the SDK catches AbortErrors internally at the stream level.
process.on('uncaughtException', (err: any) => {
  if (err.name === 'AbortError' || err.type === 'aborted') {
    return; // Safely ignore, this happens when we purposefully abort the agent session stream
  }
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: chat-with-agent-cli <agent-id> [--cwd ./path] [--prompt "Initial text"]');
    process.exit(1);
  }

  const agentId = args[0];
  let cwd = process.cwd();
  let initialPrompt = '';

  let i = 1;
  while (i < args.length) {
    if (args[i] === '--cwd' && typeof args[i + 1] === 'string') {
      cwd = args[i + 1] as string;
      i += 2;
    } else if (args[i] === '--prompt' && typeof args[i + 1] === 'string') {
      initialPrompt = args[i + 1] as string;
      i += 2;
    } else {
      i++;
    }
  }

  if (!agentId) {
    console.error('Usage: chat-with-agent-cli <agent-id> [--cwd ./path] [--prompt "Initial text"]');
    process.exit(1);
  }

  const config = getAgentConfig(agentId);
  const worker = new AgentWorker(config, cwd);

  // Setup CLI Interface
  let expectingResponse = false;
  let isPaused = false;
  let rl = createRL();

  function createRL() {
    const newRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\n> '
    });

    newRl.on('line', (line) => {
      if (expectingResponse) {
        console.log('[Please wait, the agent is still typing...]');
        return;
      }

      const input = line.trim();
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        newRl.close();
        process.exit(0);
      }

      if (input) {
        expectingResponse = true;
        if (isPaused) {
          isPaused = false;
          publishInbound({ type: 'resume_task', content: input });
        } else {
          publishInbound({ type: 'prompt', content: input });
        }
      } else {
        try { newRl.prompt(); } catch (e) {}
      }
    });

    newRl.on('error', (err: any) => {
      if (err.name === 'AbortError' || err.type === 'aborted') return;
      console.error('\n[Readline Error]:', err);
    });

    return newRl;
  }

  function ensureRl() {
    // readline.Interface exposes .closed at runtime (Node ≥ 18.6) but @types/node omits it; cast to access it.
    if ((rl as any).closed) {
      rl = createRL();
    }
  }

  function resetCliAndPrompt() {
    expectingResponse = false;
    ensureRl();
    try { rl.prompt(); } catch (e) {}
  }

  subscribeOutbound((msg) => {
    switch (msg.type) {
      case 'content':
        process.stdout.write(msg.content || '');
        break;
      case 'tool_call':
        process.stdout.write(`\n\n[Agent invoked tool: ${msg.toolName}]\n`);
        break;
      case 'input_needed':
        console.log(`\n\n[PAUSED: INPUT NEEDED] Reason: ${msg.reason}`);
        isPaused = true;
        resetCliAndPrompt();
        break;
      case 'task_completed':
        console.log(`\n\n[COMPLETED] ${msg.reason}`);
        resetCliAndPrompt();
        break;
      case 'task_failed':
        console.log(`\n\n[FAILED] Reason: ${msg.reason}`);
        resetCliAndPrompt();
        break;
      case 'error':
        console.error(`\n[Agent Error]: ${msg.content}\n`);
        resetCliAndPrompt();
        break;
      case 'done':
        if (!isPaused) {
          console.log('\n'); // Add breathing room after stream finishes
          resetCliAndPrompt();
        }
        break;
    }
  });

  // Start Agent Worker
  await worker.start();

  // Handle Initial Prompt if provided
  if (initialPrompt) {
    expectingResponse = true;
    publishInbound({ type: 'prompt', content: initialPrompt });
  } else {
    ensureRl();
    try { rl.prompt(); } catch (e) {}
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
