import { describe, it, expect } from 'vitest';
import { agentBus, publishInbound, publishOutbound, subscribeInbound, subscribeOutbound, Topic } from './bus.js';

describe('Protocol Bus', () => {
  it('publishInbound triggers subscribeInbound handlers', () => {
    const received: any[] = [];
    agentBus.once(Topic.INBOUND, (msg) => received.push(msg));
    publishInbound({ type: 'prompt', content: 'hello' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'prompt', content: 'hello' });
  });

  it('publishOutbound triggers subscribeOutbound handlers', () => {
    const received: any[] = [];
    agentBus.once(Topic.OUTBOUND, (msg) => received.push(msg));
    publishOutbound({ type: 'done' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'done' });
  });

  it('multiple subscribers each receive the message', () => {
    const results: string[] = [];
    agentBus.once(Topic.OUTBOUND, () => results.push('subscriber-1'));
    agentBus.once(Topic.OUTBOUND, () => results.push('subscriber-2'));
    publishOutbound({ type: 'done' });
    expect(results).toContain('subscriber-1');
    expect(results).toContain('subscriber-2');
  });
});
