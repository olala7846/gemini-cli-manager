import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockBus = vi.hoisted(() => ({
  subscribeInbound: vi.fn(),
  publishInbound: vi.fn()
}));

vi.mock('../protocol/bus.js', () => mockBus);

// Need to import dynamically after mocking
import { GatewayRouter } from './router.js';
import type { InboundMessage } from '../protocol/messages.js';

describe('GatewayRouter', () => {
  let inboundHandler: (msg: InboundMessage) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBus.subscribeInbound.mockImplementation((cb) => {
      inboundHandler = cb;
    });
  });

  it('should request a new worker on the first session message', async () => {
    const router = new GatewayRouter('default-agent');
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    router.onWorkerRequested(mockHandler);

    expect(mockBus.subscribeInbound).toHaveBeenCalled();

    await inboundHandler({
      type: 'session_start',
      persona: 'custom-agent',
      meta: { sessionId: 'session-123', channel: 'api' }
    } as InboundMessage);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith({
      sessionId: 'session-123',
      personaId: 'custom-agent',
      mode: 'headless'
    });

    // session_start does not get re-emitted
    expect(mockBus.publishInbound).not.toHaveBeenCalled();
  });

  it('should default persona and determine mode correctly for CLI', async () => {
    const router = new GatewayRouter('fallback-agent');
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    router.onWorkerRequested(mockHandler);

    await inboundHandler({
      type: 'prompt',
      content: 'hello',
      meta: { sessionId: 'session-456', channel: 'cli' }
    } as InboundMessage);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith({
      sessionId: 'session-456',
      personaId: 'fallback-agent',
      mode: 'interactive'
    });

    // A prompt initiating the session should be re-emitted to bus
    expect(mockBus.publishInbound).toHaveBeenCalledTimes(1);
    expect(mockBus.publishInbound).toHaveBeenCalledWith(expect.objectContaining({ type: 'prompt' }));
  });

  it('should not request a new worker if session already exists', async () => {
    const router = new GatewayRouter('fallback-agent');
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    router.onWorkerRequested(mockHandler);

    // First message
    await inboundHandler({
      type: 'session_start',
      meta: { sessionId: 'session-789', channel: 'api' }
    } as InboundMessage);

    // Second message for the same session
    await inboundHandler({
      type: 'prompt',
      content: 'are you there?',
      meta: { sessionId: 'session-789', channel: 'api' }
    } as InboundMessage);

    // Only called once for initialization
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // And NO re-emit for the second prompt because it was not the session starter
    expect(mockBus.publishInbound).not.toHaveBeenCalled();
  });

  it('should queue concurrent messages while worker initializes and safely re-emit them', async () => {
    const router = new GatewayRouter('fallback-agent');

    // Simulate a slow worker initialization
    let resolveWorker: () => void;
    const workerPromise = new Promise<void>((r) => {
      resolveWorker = r;
    });
    const mockHandler = vi.fn().mockReturnValue(workerPromise);
    router.onWorkerRequested(mockHandler);

    // Fire the initial session start
    const startPromise = inboundHandler({
      type: 'session_start',
      meta: { sessionId: 'race-session', channel: 'api' }
    } as InboundMessage);

    // Fire a concurrent prompt message milliseconds later
    const promptPromise = inboundHandler({
      type: 'prompt',
      content: 'hello concurrent',
      meta: { sessionId: 'race-session', channel: 'api' }
    } as InboundMessage);

    // The router must only instantiate ONE worker
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Before the worker boots, nothing should have leaked onto the event bus
    expect(mockBus.publishInbound).not.toHaveBeenCalled();

    // Resolve the slow boot
    resolveWorker!();
    await Promise.all([startPromise, promptPromise]);

    // The prompt message that stalled inside the pendingSessions block must be re-published flawlessly
    expect(mockBus.publishInbound).toHaveBeenCalledTimes(1);
    expect(mockBus.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompt', content: 'hello concurrent' })
    );

    // And it definitely shouldn't restart the worker again
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});
