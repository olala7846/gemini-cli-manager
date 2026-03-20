import { scheduleTask } from '../automation/scheduler.js';
import { taskQueue } from '../automation/scheduler.js';

async function main() {
  const args = process.argv.slice(2);
  let personaId = 'default';
  let prompt = 'Say hello validation run!';
  let delayMs: number | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--persona' && typeof args[i + 1] === 'string') {
      personaId = args[i + 1] as string;
      i++;
    } else if (args[i] === '--prompt' && typeof args[i + 1] === 'string') {
      prompt = args[i + 1] as string;
      i++;
    } else if (args[i] === '--delay' && typeof args[i + 1] === 'string') {
      delayMs = parseInt(args[i + 1] as string, 10);
      i++;
    }
  }

  console.log(`Scheduling task for Persona "${personaId}" with prompt: "${prompt}"`);
  if (delayMs) {
    console.log(`Delay: ${delayMs}ms`);
  }

  const job = await scheduleTask({ personaId, prompt }, delayMs);
  console.log(`Successfully scheduled job ${job?.id} at ${new Date().toISOString()}`);

  // Gracefully disconnect from Redis queue so the script can cleanly exit
  await taskQueue.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Failed to schedule job:', err);
  await taskQueue.close();
  process.exit(1);
});
