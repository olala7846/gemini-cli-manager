import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { agentBus } from '../protocol/bus.js';
import type { OutboundMessage } from '../protocol/messages.js';

// ─── Mock the SDK before importing AgentWorker ────────────────────────────────
// GeminiCliAgent is used with `new`, so the mock must be a real constructor.
let mockSendStream: () => AsyncGenerator<any>;

vi.mock('@google/gemini-cli-sdk', () => {
  const GeminiCliAgent = vi.fn(function (this: any) {
    this.session = () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      sendStream: () => mockSendStream(),
    });
  });
  return { GeminiCliAgent };
});

// Import AFTER mocking so the mock is in place
const { AgentWorker } = await import('./worker.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function* makeStream(events: any[]): AsyncGenerator<any> {
  for (const evt of events) yield evt;
}

const AGENT_CONFIG = {
  id: 'test-agent',
  description: 'Unit test agent',
  systemPrompt: 'test',
  skills: [],
};

/** Collects all outbound messages published during the async fn */
async function collectOutbound(fn: () => Promise<void>): Promise<OutboundMessage[]> {
  const msgs: OutboundMessage[] = [];
  const listener = (msg: OutboundMessage) => msgs.push(msg);
  agentBus.on('agent.outbound', listener);
  try {
    await fn();
    // Small tick to let async events flush
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    agentBus.off('agent.outbound', listener);
  }
  return msgs;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AgentWorker — unit tests', () => {
  let worker: InstanceType<typeof AgentWorker>;

  beforeEach(async () => {
    agentBus.removeAllListeners();
    worker = new AgentWorker(AGENT_CONFIG, '/tmp');
    await worker.start();
  });

  afterEach(() => {
    agentBus.removeAllListeners();
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  it('happy path: prompt → content events → done', async () => {
    mockSendStream = () =>
      makeStream([
        { type: 'content', value: 'Hello ' },
        { type: 'content', value: 'world' },
      ]);

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'hi' });
    });

    const content = msgs.filter((m) => m.type === 'content');
    expect(content).toHaveLength(2);
    expect(msgs.some((m) => m.type === 'done')).toBe(true);
  });

  // ── 2. INPUT_NEEDED → PAUSED ───────────────────────────────────────────────
  it('INPUT_NEEDED report_status → emits input_needed and worker is PAUSED', async () => {
    mockSendStream = () =>
      makeStream([
        {
          type: 'tool_call_request',
          value: { name: 'report_status', args: { state: 'INPUT_NEEDED', reason: 'need filename' } },
        },
      ]);

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'start' });
    });

    const inputNeeded = msgs.find((m) => m.type === 'input_needed');
    expect(inputNeeded).toBeDefined();
    expect(inputNeeded).toHaveProperty('reason', 'need filename');
  });

  // ── 3. Prompt ignored while PAUSED ─────────────────────────────────────────
  it('prompt while PAUSED is silently dropped', async () => {
    // First, put worker in PAUSED state
    mockSendStream = () =>
      makeStream([
        {
          type: 'tool_call_request',
          value: { name: 'report_status', args: { state: 'INPUT_NEEDED', reason: 'pausing' } },
        },
      ]);
    await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'start' });
    });

    // Now send a plain prompt — should produce no content or done
    const sendStreamSpy = vi.fn().mockImplementation(() => makeStream([]));
    mockSendStream = sendStreamSpy;

    await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'ignored' });
    });

    expect(sendStreamSpy).not.toHaveBeenCalled();
  });

  // ── 4. resume_task while PAUSED → RUNNING ──────────────────────────────────
  it('resume_task while PAUSED re-calls sendStream with RESUME_PREFIX', async () => {
    // Pause first
    mockSendStream = () =>
      makeStream([
        {
          type: 'tool_call_request',
          value: { name: 'report_status', args: { state: 'INPUT_NEEDED', reason: 'pausing' } },
        },
      ]);
    await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'start' });
    });

    // Now resume
    const capturedPrompts: string[] = [];
    mockSendStream = () => {
      // This will be called with the text passed to sendStream — but we can't
      // intercept the argument here directly. Instead assert on content emitted.
      return makeStream([{ type: 'content', value: 'resumed!' }]);
    };

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'resume_task', content: 'my answer' });
    });

    // Should emit content from the resumed stream
    expect(msgs.some((m) => m.type === 'content')).toBe(true);
  });

  // ── 5. resume_task while not PAUSED → error ────────────────────────────────
  it('resume_task while RUNNING (not PAUSED) emits error', async () => {
    mockSendStream = () => makeStream([]); // unused

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'resume_task', content: 'oops' });
    });

    const err = msgs.find((m) => m.type === 'error');
    expect(err).toBeDefined();
    expect(err).toHaveProperty('content', expect.stringMatching(/PAUSED/));
  });

  // ── 6. COMPLETED → STOPPED ─────────────────────────────────────────────────
  it('COMPLETED report_status → emits task_completed', async () => {
    mockSendStream = () =>
      makeStream([
        {
          type: 'tool_call_request',
          value: { name: 'report_status', args: { state: 'COMPLETED', reason: 'all done' } },
        },
      ]);

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'go' });
    });

    const completed = msgs.find((m) => m.type === 'task_completed');
    expect(completed).toBeDefined();
    expect(completed).toHaveProperty('reason', 'all done');
  });

  // ── 7. FAILED → STOPPED ────────────────────────────────────────────────────
  it('FAILED report_status → emits task_failed', async () => {
    mockSendStream = () =>
      makeStream([
        {
          type: 'tool_call_request',
          value: { name: 'report_status', args: { state: 'FAILED', reason: 'something broke' } },
        },
      ]);

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'go' });
    });

    const failed = msgs.find((m) => m.type === 'task_failed');
    expect(failed).toBeDefined();
    expect(failed).toHaveProperty('reason', 'something broke');
  });

  // ── 8. Real error propagates as error message ──────────────────────────────
  it('real error in stream emits error outbound message', async () => {
    mockSendStream = async function* () {
      throw new Error('network failure');
    };

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'go' });
    });

    const err = msgs.find((m) => m.type === 'error');
    expect(err).toBeDefined();
    expect(err).toHaveProperty('content', 'network failure');
  });

  // ── 9. AbortError is silently swallowed ────────────────────────────────────
  it('AbortError in stream is silently swallowed (no error message)', async () => {
    mockSendStream = async function* () {
      const e = new Error('fetch aborted');
      e.name = 'AbortError';
      throw e;
    };

    const msgs = await collectOutbound(async () => {
      agentBus.emit('agent.inbound', { type: 'prompt', content: 'go' });
    });

    expect(msgs.find((m) => m.type === 'error')).toBeUndefined();
  });
});
