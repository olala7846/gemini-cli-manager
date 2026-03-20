import { Queue, Worker, type Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { publishInbound, agentBus, Topic } from '../protocol/bus.js';
import type { OutboundMessage } from '../protocol/messages.js';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
};

export const TASK_QUEUE_NAME = 'gemini-claw-tasks';

// Ensure the queue is available for adding jobs
export const taskQueue = new Queue(TASK_QUEUE_NAME, { connection });

export interface AgentTaskPayload {
  personaId: string;
  prompt: string;
}

/**
 * Initializes the BullMQ worker that bridges the queue and the Agent Event Bus.
 */
export function startTaskWorker() {
  const worker = new Worker<AgentTaskPayload>(
    TASK_QUEUE_NAME,
    async (job: Job<AgentTaskPayload>) => {
      const sessionId = `job-${job.id || randomUUID()}`;

      const completionPromise = new Promise<void>((resolve, reject) => {
        // Listen for the agent's completion or failure
        const listener = (msg: OutboundMessage) => {
          if (msg.meta.sessionId !== sessionId) return;

          if (msg.type === 'task_completed' || msg.type === 'done') {
            agentBus.off(Topic.OUTBOUND, listener);
            resolve();
          } else if (msg.type === 'task_failed' || msg.type === 'error') {
            agentBus.off(Topic.OUTBOUND, listener);
            const reason = msg.type === 'task_failed' ? msg.reason : msg.content;
            reject(new Error(`Agent task failed: ${reason}`));
          }
        };

        agentBus.on(Topic.OUTBOUND, listener);
      });

      // Fire the session start event to the Gateway
      // Gateway router intercepts this, realizes it's the `automation` channel,
      // so it initializes an AgentWorker in `headless` mode.
      publishInbound({
        meta: { sessionId, channel: 'automation' },
        type: 'session_start',
        persona: job.data.personaId
      });

      // Fire the actual task prompt
      publishInbound({
        meta: { sessionId, channel: 'automation' },
        type: 'prompt',
        content: job.data.prompt
      });

      await completionPromise;
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Automation] Job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.info(`[Automation] Job ${job.id} officially completed.`);
  });

  return worker;
}

/**
 * Utility function to dispatch an automation background task payload into the queue.
 */
export async function scheduleTask(payload: AgentTaskPayload) {
  return taskQueue.add('agent-task', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });
}
