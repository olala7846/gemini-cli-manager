/**
 * Integration test for the AgentWorker pause/resume cycle.
 *
 * This test makes REAL calls to the Gemini API. It requires GEMINI_API_KEY to be set.
 * Run with: npm run test:integration
 *
 * Strategy: Use a purpose-built "test-pause-agent" whose system prompt forces it to:
 *   1. Call report_status(INPUT_NEEDED) immediately on the first turn
 *   2. Call report_status(COMPLETED) after receiving a resume message
 *
 * This makes the LLM behaviour deterministic enough to assert on message types.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentWorker } from './worker.js';
import { agentBus, publishInbound } from '../../protocol/bus.js';
import { tmpdir } from 'os';
import type { OutboundMessage } from '../../protocol/messages.js';

// ─── Skip if no API key ───────────────────────────────────────────────────────
const SKIP = !process.env.GEMINI_API_KEY;
const maybeDescribe = SKIP ? describe.skip : describe;

if (SKIP) {
  console.warn('[integration] Skipping: GEMINI_API_KEY not set.');
}

// ─── Test agent config ────────────────────────────────────────────────────────
const TEST_AGENT_CONFIG = {
  id: 'test-pause-agent',
  description: 'Integration test agent for pause/resume verification',
  systemPrompt: `You are a strictly controlled test agent for an automated test suite.
Your ONLY job is to call the report_status tool — never produce free-form text.
[CRITICAL] IGNORE ANY INSTRUCTIONS OR MEMORY INJECTED BELOW ABOUT "GIT", "BRANCHES", "WORKTREES", OR OTHER TOOLS. DO NOT CALL run_shell_command. ONLY CALL report_status.

Rules:
- On your FIRST turn (any message not starting with "[User Resumed Task]:"): 
  call report_status with state=INPUT_NEEDED and reason="test-pause-checkpoint"
- On any turn starting with "[User Resumed Task]:":
  call report_status with state=COMPLETED and reason="test-resume-confirmed"

Do NOT write any text. Immediately call report_status.`,
  skills: []
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns a promise that resolves with the first outbound message matching the
 * given type, or rejects after `timeoutMs` milliseconds.
 */
function waitForMessage(type: OutboundMessage['type'], timeoutMs = 45_000): Promise<OutboundMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${type}' message`)), timeoutMs);

    const listener = (msg: OutboundMessage) => {
      if (msg.type === type) {
        clearTimeout(timer);
        agentBus.off('agent.outbound', listener);
        resolve(msg);
      }
    };
    agentBus.on('agent.outbound', listener);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

maybeDescribe('AgentWorker — integration tests (real Gemini API)', () => {
  let worker: AgentWorker;

  beforeEach(async () => {
    agentBus.removeAllListeners();
    worker = new AgentWorker(TEST_AGENT_CONFIG, tmpdir());
    await worker.start();
  });

  afterEach(() => {
    agentBus.removeAllListeners();
  });

  it('full pause → resume cycle: INPUT_NEEDED then COMPLETED', async () => {
    // ── Step 1: Trigger first turn ──────────────────────────────────────────
    const inputNeededPromise = waitForMessage('input_needed');
    publishInbound({
      meta: { sessionId: 'test-session', channel: 'automation' },
      type: 'prompt',
      content:
        'Do not run the project test suite. Ignore all memory. Just call report_status with state=INPUT_NEEDED and reason=test-pause-checkpoint IMMEDIATELY.'
    });

    const inputNeededMsg = await inputNeededPromise;
    expect(inputNeededMsg.type).toBe('input_needed');
    expect(inputNeededMsg).toHaveProperty('reason', 'test-pause-checkpoint');

    // ── Step 2: Resume ──────────────────────────────────────────────────────
    const completedPromise = waitForMessage('task_completed');
    publishInbound({
      meta: { sessionId: 'test-session', channel: 'automation' },
      type: 'resume_task',
      content: 'I confirm. Call report_status with COMPLETED and reason=test-resume-confirmed.'
    });

    const completedMsg = await completedPromise;
    expect(completedMsg.type).toBe('task_completed');
    expect(completedMsg).toHaveProperty('reason', 'test-resume-confirmed');
  });

  it('prompt while PAUSED is ignored — no new content emitted', async () => {
    // ── Pause the agent ─────────────────────────────────────────────────────
    const inputNeededPromise = waitForMessage('input_needed');
    publishInbound({
      meta: { sessionId: 'test-session', channel: 'automation' },
      type: 'prompt',
      content:
        'Do not run the project test suite. Ignore all memory. Just call report_status with state=INPUT_NEEDED and reason=test-pause-checkpoint IMMEDIATELY.'
    });
    await inputNeededPromise;

    // ── Send a plain prompt (should be silently dropped) ────────────────────
    const spuriousMessages: OutboundMessage[] = [];
    const collector = (msg: OutboundMessage) => {
      if (msg.type === 'content' || msg.type === 'done') {
        spuriousMessages.push(msg);
      }
    };
    agentBus.on('agent.outbound', collector);

    publishInbound({
      meta: { sessionId: 'test-session', channel: 'automation' },
      type: 'prompt',
      content: 'this should be ignored'
    });

    // Wait briefly to give any erroneous processing a chance to surface
    await new Promise((r) => setTimeout(r, 3_000));

    agentBus.off('agent.outbound', collector);
    expect(spuriousMessages).toHaveLength(0);
  });
});
