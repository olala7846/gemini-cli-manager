import { GeminiCliAgent } from '@google/gemini-cli-sdk';
import { subscribeInbound, publishOutbound } from '../protocol/bus.js';
import type { AgentConfig } from './registry.js';
import type { GeminiCliSession } from '@google/gemini-cli-sdk';
import { ReportStatusTool } from './statusTool.js';

type WorkerState = 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'STOPPED';

/** Prefix injected into the conversation history when resuming a paused task. */
const RESUME_PREFIX = '[User Resumed Task]:';

export class AgentWorker {
  private agent: GeminiCliAgent;
  private session: GeminiCliSession | null = null;
  private config: AgentConfig;
  private cwd: string;
  private state: WorkerState = 'INITIALIZED';

  constructor(config: AgentConfig, cwd: string) {
    this.config = config;
    this.cwd = cwd;

    // We append a strict instruction to always use the tool
    const augmentedPrompt = `${this.config.systemPrompt}\n\nCRITICAL SYSTEM INSTRUCTION: When you have finished your task, or if you are permanently blocked, you MUST call the \`report_status\` tool. Do not just print "blocked" or "completed" in text—you must invoke the tool with the appropriate state and reason.`;

    this.agent = new GeminiCliAgent({
      cwd: this.cwd,
      instructions: augmentedPrompt,
      ...(this.config.models?.primary ? { model: this.config.models.primary } : {}),
      ...(this.config.skills ? { skills: this.config.skills.map((s) => ({ type: 'dir' as const, path: s })) } : {}),
      tools: [ReportStatusTool]
    });
  }

  async start() {
    this.session = this.agent.session();
    await this.session.initialize();

    // Listen to Pub/Sub events from the CLI
    subscribeInbound(async (msg) => {
      if (msg.type === 'prompt') {
        await this.handlePrompt(msg.content);
      } else if (msg.type === 'resume_task') {
        await this.handleResume(msg.content);
      } else if (msg.type === 'system_override') {
        console.warn('Dynamic system overrides not fully implemented in PoC');
      }
    });

    this.state = 'RUNNING';
    publishOutbound({ type: 'content', content: `[System] ${this.config.id} initialized in ${this.cwd}\n\n` });
  }

  private async handleResume(content: string) {
    if (this.state !== 'PAUSED') {
      publishOutbound({ type: 'error', content: 'Cannot resume a task that is not currently PAUSED.' });
      return;
    }

    this.state = 'RUNNING';
    await this.handlePrompt(`${RESUME_PREFIX} ${content}`);
  }

  private async handlePrompt(prompt: string) {
    if (!this.session || this.state !== 'RUNNING') {
      // TODO: publish a user-visible error when a prompt is dropped while PAUSED
      return;
    }

    try {
      const stream = this.session.sendStream(prompt);

      // @ts-ignore - Types from generic interface
      for await (const event of stream) {
        if (event.type === 'content') {
          const text = event.value;
          if (text) {
            publishOutbound({ type: 'content', content: text });
          }
        } else if (event.type === 'tool_call_request') {
          const toolName = event.value?.name;
          const toolArgs = event.value?.args;

          if (toolName === 'report_status') {
            const state = toolArgs?.state as 'INPUT_NEEDED' | 'COMPLETED' | 'FAILED';
            const reason = toolArgs?.reason as string;

            const systemAck = await ReportStatusTool.action({ state, reason });
            publishOutbound({ type: 'content', content: `\n[System Internal: ${systemAck}]\n`});

            if (state === 'INPUT_NEEDED') {
              this.state = 'PAUSED';
              publishOutbound({ type: 'input_needed', reason });
              throw new Error('AGENT_PAUSED_INTENTIONALLY');
            } else if (state === 'COMPLETED') {
              this.state = 'STOPPED';
              publishOutbound({ type: 'task_completed', reason });
              throw new Error('AGENT_STOPPED_INTENTIONALLY');
            } else if (state === 'FAILED') {
              this.state = 'STOPPED';
              publishOutbound({ type: 'task_failed', reason });
              throw new Error('AGENT_STOPPED_INTENTIONALLY');
            }
          }

          publishOutbound({
            type: 'tool_call',
            toolName,
            toolArgs
          });
        }
      }
      
      // If the stream naturally finishes without the agent explicitly calling the status tool:
      if (this.state === 'RUNNING') {
        publishOutbound({ type: 'done' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'AGENT_PAUSED_INTENTIONALLY' || err.message === 'AGENT_STOPPED_INTENTIONALLY') {
        // We intentionally aborted the stream to pause/stop the agent contextually.
        return;
      }
      this.state = 'STOPPED';
      // TODO: call session.close() here once the SDK exposes a teardown API
      publishOutbound({ type: 'error', content: err.message || 'Unknown error occurred' });
    }
  }
}
