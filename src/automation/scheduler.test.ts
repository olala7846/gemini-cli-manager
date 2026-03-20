import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Worker } from 'bullmq';
import { startTaskWorker, scheduleTask } from './scheduler.js';
import { agentBus, Topic } from '../protocol/bus.js';
import type { InboundMessage, OutboundMessage } from '../protocol/messages.js';

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(function () {
      return {
        add: vi.fn().mockResolvedValue({ id: 'mock-job-1' })
      };
    }),
    Worker: vi.fn().mockImplementation(function () {
      return {
        on: vi.fn()
      };
    })
  };
});

describe('Automation Scheduler', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processorFn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agentBus.removeAllListeners();
    processorFn = undefined;

    vi.mocked(Worker).mockImplementation(function (_name, processor) {
      processorFn = processor;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { on: vi.fn() } as any;
    });
  });

  it('scheduleTask calls Queue.add', async () => {
    const job = await scheduleTask({ personaId: 'test-agent', prompt: 'hello' });
    expect(job?.id).toBe('mock-job-1');
  });

  it('Worker processes jobs by emitting to bus and resolving on success', async () => {
    startTaskWorker();
    expect(processorFn).toBeDefined();

    const inboundMessages: InboundMessage[] = [];
    agentBus.on(Topic.INBOUND, (msg) => inboundMessages.push(msg));

    // Start the job (does not block immediately, we await it)
    const jobPromise = processorFn({ id: '123', data: { personaId: 'agent', prompt: 'do work' } });

    // Ensure session_start and prompt were emitted
    expect(inboundMessages).toHaveLength(2);
    expect(inboundMessages[0]?.type).toBe('session_start');
    expect(inboundMessages[1]?.type).toBe('prompt');

    // Simulate the worker completing the task successfully over the outbound bus
    agentBus.emit(Topic.OUTBOUND, {
      meta: { sessionId: 'job-123', channel: 'automation' },
      type: 'task_completed',
      reason: 'Success'
    } as OutboundMessage);

    await expect(jobPromise).resolves.toBeUndefined();
  });

  it('Worker rejects job on agent error over outbound bus', async () => {
    startTaskWorker();

    const jobPromise = processorFn({ id: '999', data: { personaId: 'agent', prompt: 'do fail' } });

    // Simulate the worker failing the task over the outbound bus
    agentBus.emit(Topic.OUTBOUND, {
      meta: { sessionId: 'job-999', channel: 'automation' },
      type: 'task_failed',
      reason: 'Network Timeout'
    } as OutboundMessage);

    await expect(jobPromise).rejects.toThrow('Agent task failed: Network Timeout');
  });
});
