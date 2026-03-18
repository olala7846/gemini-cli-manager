/**
 * Metadata required by the Gateway to properly route messages to and from sessions.
 */
export interface MessageMeta {
  sessionId: string;
  channel: 'cli' | 'telegram' | 'api' | 'automation';
  traceId?: string;
  sourceSessionId?: string; // Optional field for sub-agent communication
}

/**
 * Represents a message sent from the User/CLI to the Agent.
 */
export type InboundMessage = { meta: MessageMeta } & (
  | { type: 'prompt'; content: string }
  | { type: 'system_override'; content: string }
  | { type: 'resume_task'; content: string }
  | { type: 'session_start'; persona?: string }
);

/**
 * Represents a message sent from the Agent back to the User/CLI.
 */
export type OutboundMessage = { meta: MessageMeta } & (
  | { type: 'content'; content: string }
  | { type: 'tool_call'; toolName: string; toolArgs?: Record<string, unknown> }
  | { type: 'input_needed'; reason: string }
  | { type: 'task_completed'; reason: string }
  | { type: 'task_failed'; reason: string }
  | { type: 'error'; content: string }
  | { type: 'done' }
);
