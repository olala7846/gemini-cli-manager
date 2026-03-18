import { GeminiCliAgent } from '@google/gemini-cli-sdk';
import { subscribeInbound, publishOutbound, publishInbound } from '../../protocol/bus.js';
import type { AgentConfig } from './registry.js';
import type { GeminiCliSession } from '@google/gemini-cli-sdk';
import { ReportStatusTool } from './statusTool.js';

type WorkerState = 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'STOPPED';
type WorkerMode = 'interactive' | 'headless';

/** Prefix injected into the conversation history when resuming a paused task. */
const RESUME_PREFIX = '[User Resumed Task]:';

export const MAX_HEADLESS_ATTEMPTS = 3;
export const HEADLESS_REPLY_DELAY_MS = 10;
export const HEADLESS_AUTO_REPLY_PROMPT = `[Headless Auto-Reply]: I am a scheduled job and cannot provide clarification. Please make your best guess, skip the problematic step if necessary, and proceed to complete the task as best as you can.`;
export const YOLO_ATTEMPTS_EXCEEDED_REASON =
  'Max YOLO attempts exceeded: Agent repeatedly asked for input in headless mode';
export const SILENT_HALTING_NUDGE_PROMPT = `[Headless Auto-Reply]: You finished your response but forgot to call report_status. Please call the report_status tool to officially complete or fail the task.`;
export const SILENT_HALTING_EXCEEDED_REASON = 'Max YOLO attempts exceeded during silent halting';

export class AgentWorker {
  private agent: GeminiCliAgent;
  private session: GeminiCliSession | null = null;
  private config: AgentConfig;
  private cwd: string;
  private mode: WorkerMode;
  private state: WorkerState = 'INITIALIZED';
  private consecutiveInputNeeded = 0;

  constructor(config: AgentConfig, cwd: string, mode: WorkerMode = 'interactive') {
    this.config = config;
    this.cwd = cwd;
    this.mode = mode;

    // We append a strict instruction to always use the tool
    let augmentedPrompt = `${this.config.systemPrompt}\n\nCRITICAL SYSTEM INSTRUCTION: When you have finished your task, or if you are permanently blocked, you MUST call the \`report_status\` tool. Do not just print "blocked" or "completed" in text—you must invoke the tool with the appropriate state and reason.`;

    if (this.mode === 'headless') {
      augmentedPrompt += `\n\n[CRITICAL INSTRUCTION] You are running in HEADLESS (YOLO) mode. There is no human available to provide input or clarification. You MUST use your best judgment to proceed, make reasonable assumptions when faced with ambiguity, and attempt to complete the main objective. Do NOT pause to ask for input.`;
    }

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
            publishOutbound({ type: 'content', content: `\n[System Internal: ${systemAck}]\n` });

            if (state === 'INPUT_NEEDED') {
              if (this.mode === 'headless') {
                this.consecutiveInputNeeded++;
                if (this.consecutiveInputNeeded >= MAX_HEADLESS_ATTEMPTS) {
                  this.state = 'STOPPED';
                  publishOutbound({
                    type: 'task_failed',
                    reason: YOLO_ATTEMPTS_EXCEEDED_REASON
                  });
                  throw new Error('AGENT_STOPPED_INTENTIONALLY');
                }
                // Instead of pausing, we force a resume
                setTimeout(() => {
                  publishOutbound({ type: 'content', content: `\n[Headless Auto-Reply Injection]\n` });
                  publishInbound({
                    type: 'resume_task',
                    content: HEADLESS_AUTO_REPLY_PROMPT
                  });
                }, HEADLESS_REPLY_DELAY_MS);
                this.state = 'PAUSED';
                throw new Error('AGENT_PAUSED_INTENTIONALLY');
              } else {
                this.state = 'PAUSED';
                publishOutbound({ type: 'input_needed', reason });
                throw new Error('AGENT_PAUSED_INTENTIONALLY');
              }
            } else if (state === 'COMPLETED') {
              this.state = 'STOPPED';
              publishOutbound({ type: 'task_completed', reason });
              throw new Error('AGENT_STOPPED_INTENTIONALLY');
            } else if (state === 'FAILED') {
              this.state = 'STOPPED';
              publishOutbound({ type: 'task_failed', reason });
              throw new Error('AGENT_STOPPED_INTENTIONALLY');
            }
          } else {
            // Reset YOLO counter if making progress with other tools
            this.consecutiveInputNeeded = 0;
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
        if (this.mode === 'headless') {
          // Silent halting mitigation: force a nudge to report status
          this.consecutiveInputNeeded++;
          if (this.consecutiveInputNeeded >= MAX_HEADLESS_ATTEMPTS) {
            this.state = 'STOPPED';
            publishOutbound({ type: 'task_failed', reason: SILENT_HALTING_EXCEEDED_REASON });
          } else {
            setTimeout(() => {
              publishInbound({
                type: 'prompt',
                content: SILENT_HALTING_NUDGE_PROMPT
              });
            }, HEADLESS_REPLY_DELAY_MS);
          }
        } else {
          publishOutbound({ type: 'done' });
        }
      }
    } catch (err: any) {
      if (err.message === 'AGENT_PAUSED_INTENTIONALLY' || err.message === 'AGENT_STOPPED_INTENTIONALLY') {
        // We intentionally aborted the stream to pause/stop the agent contextually.
        return;
      }
      this.state = 'STOPPED';
      if (err.name === 'AbortError' || err.type === 'aborted') {
        if (this.mode === 'headless') {
          publishOutbound({ type: 'task_failed', reason: 'Unintentional AbortError during headless execution' });
        }
        return;
      }
      publishOutbound({ type: 'error', content: err.message || 'Unknown error occurred' });
    }
  }
}
