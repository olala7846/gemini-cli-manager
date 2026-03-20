import { subscribeInbound, publishInbound, publishOutbound } from '../protocol/bus.js';
import type { InboundMessage } from '../protocol/messages.js';

export type WorkerRequest = {
  sessionId: string;
  personaId: string;
  mode: 'interactive' | 'headless';
};

export class GatewayRouter {
  private activeSessions = new Set<string>();
  private pendingSessions = new Map<string, Promise<void>>();
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
    let hadToWait = false;

    if (!this.activeSessions.has(sessionId)) {
      if (this.pendingSessions.has(sessionId)) {
        // Wait for the ongoing initialization to finish
        hadToWait = true;
        await this.pendingSessions.get(sessionId);
      } else {
        isNewSession = true;
        let personaId = this.defaultAgentId;
        if (msg.type === 'session_start' && msg.persona) {
          personaId = msg.persona;
        }

        const mode = this.interactiveChannels.includes(channel) ? 'interactive' : 'headless';

        if (this.workerRequestHandler) {
          const initPromise = (async () => {
            // We confidently know workerRequestHandler is not null here due to the outer if block.
            await this.workerRequestHandler!({ sessionId, personaId, mode });
            this.activeSessions.add(sessionId);
          })();

          this.pendingSessions.set(sessionId, initPromise);

          try {
            await initPromise;
          } catch (err: unknown) {
            this.pendingSessions.delete(sessionId);
            const errorMessage = err instanceof Error ? err.message : String(err);
            publishOutbound({
              meta: msg.meta,
              type: 'error',
              content: `[Gateway Error] Failed to start agent worker: ${errorMessage}`
            });
            return;
          }
          this.pendingSessions.delete(sessionId);
        }
      }
    }

    if ((isNewSession || hadToWait) && msg.type !== 'session_start') {
      // Re-emit the original prompt/resume_task so the newly subscribed worker receives it.
      publishInbound(msg);
    }
  }
}
