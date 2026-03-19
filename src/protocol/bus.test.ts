import { describe, it, expect } from 'vitest';
import { agentBus, publishInbound, publishOutbound, Topic } from './bus.js';
import type { InboundMessage, OutboundMessage } from './messages.js';

describe('Protocol Bus', () => {
  it('publishInbound triggers subscribeInbound handlers', () => {
    const received: InboundMessage[] = [];
    agentBus.once(Topic.INBOUND, (msg) => received.push(msg));
    publishInbound({ meta: { sessionId: 'test', channel: 'automation' }, type: 'prompt', content: 'hello' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      meta: { sessionId: 'test', channel: 'automation' },
      type: 'prompt',
      content: 'hello'
    });
  });

  it('publishOutbound triggers subscribeOutbound handlers', () => {
    const received: OutboundMessage[] = [];
    agentBus.once(Topic.OUTBOUND, (msg) => received.push(msg));
    publishOutbound({ meta: { sessionId: 'test', channel: 'automation' }, type: 'done' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ meta: { sessionId: 'test', channel: 'automation' }, type: 'done' });
  });

  it('multiple subscribers each receive the message', () => {
    const results: string[] = [];
    agentBus.once(Topic.OUTBOUND, () => results.push('subscriber-1'));
    agentBus.once(Topic.OUTBOUND, () => results.push('subscriber-2'));
    publishOutbound({ meta: { sessionId: 'test', channel: 'automation' }, type: 'done' });
    expect(results).toContain('subscriber-1');
    expect(results).toContain('subscriber-2');
  });
});
