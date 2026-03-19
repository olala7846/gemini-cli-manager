import * as readline from 'node:readline';
import { publishInbound, subscribeOutbound } from '../../protocol/bus.js';

export function runCLI(isHeadless: boolean, initialPrompt?: string) {
  let expectingResponse = false;
  let isPaused = false;
  let rl: readline.Interface | null = null;

  if (!isHeadless) {
    rl = createRL();
  }

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
        const meta = { sessionId: 'local-cli', channel: 'cli' as const };
        if (isPaused) {
          isPaused = false;
          publishInbound({ meta, type: 'resume_task', content: input });
        } else {
          publishInbound({ meta, type: 'prompt', content: input });
        }
      } else {
        try {
          rl?.prompt();
        } catch {
          /* ignore */
        }
      }
    });

    newRl.on('error', (err: Error & { type?: string }) => {
      if (err.name === 'AbortError' || err.type === 'aborted') return;
      console.error('\n[Readline Error]:', err);
    });

    return newRl;
  }

  function ensureRl() {
    if (isHeadless) return;
    // readline.Interface exposes .closed at runtime (Node ≥ 18.6) but @types/node omits it; cast to access it.
    if (rl && (rl as readline.Interface & { closed?: boolean }).closed) {
      rl = createRL();
    }
  }

  function resetCliAndPrompt() {
    expectingResponse = false;
    if (isHeadless) return;
    ensureRl();
    try {
      rl?.prompt();
    } catch {
      /* ignore */
    }
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
        if (isHeadless) process.exit(0);
        else resetCliAndPrompt();
        break;
      case 'task_failed':
        console.error(`\n\n[FAILED] Reason: ${msg.reason}`);
        if (isHeadless) process.exit(1);
        else resetCliAndPrompt();
        break;
      case 'error':
        console.error(`\n[Agent Error]: ${msg.content}\n`);
        if (isHeadless) process.exit(1);
        else resetCliAndPrompt();
        break;
      case 'done':
        if (!isPaused) {
          console.log('\n'); // Add breathing room after stream finishes
          if (!isHeadless) resetCliAndPrompt();
        }
        break;
    }
  });

  const meta = { sessionId: 'local-cli', channel: 'cli' as const };

  if (initialPrompt) {
    expectingResponse = true;
    publishInbound({ meta, type: 'prompt', content: initialPrompt });
  } else {
    ensureRl();
    try {
      rl?.prompt();
    } catch {
      /* ignore */
    }
  }
}
