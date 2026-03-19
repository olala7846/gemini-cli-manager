import { subscribeInbound, publishInbound, publishOutbound } from '../protocol/bus.js';
import type { InboundMessage } from '../protocol/messages.js';

export type WorkerRequest = {
  sessionId: string;
  personaId: string;
  mode: 'interactive' | 'headless';
};

export class GatewayRouter {
  private activeSessions = new Set<string>();
  private defaultAgentId: string;
  private interactiveChannels: string[];
  private workerRequestHandler: ((req: WorkerRequest) => Promise<void>) | null = null;

  constructor(defaultAgentId: string, interactiveChannels: string[] = ['cli', 'telegram']) {
    this.defaultAgentId = defaultAgentId;
    this.interactiveChannels = interactiveChannels;

    subscribeInbound(async (msg: InboundMessage) => {
      await this.handleInbound(msg);
    });
  }

  public onWorkerRequested(handler: (req: WorkerRequest) => Promise<void>) {
    this.workerRequestHandler = handler;
  }

  private async handleInbound(msg: InboundMessage) {
    const { sessionId, channel } = msg.meta;
    let isNewSession = false;

    if (!this.activeSessions.has(sessionId)) {
      isNewSession = true;
      let personaId = this.defaultAgentId;
      if (msg.type === 'session_start' && msg.persona) {
        personaId = msg.persona;
      }

      const mode = this.interactiveChannels.includes(channel) ? 'interactive' : 'headless';

      if (this.workerRequestHandler) {
        try {
          await this.workerRequestHandler({ sessionId, personaId, mode });
          this.activeSessions.add(sessionId);
          // Silent logging internally to not disrupt CLI too much
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          publishOutbound({
            meta: msg.meta,
            type: 'error',
            content: `[Gateway Error] Failed to start agent worker: ${errorMessage}`
          });
          return;
        }
      }
    }

    if (isNewSession && msg.type !== 'session_start') {
      // Re-emit the original prompt/resume_task so the newly subscribed worker receives it.
      publishInbound(msg);
    }
  }
}
