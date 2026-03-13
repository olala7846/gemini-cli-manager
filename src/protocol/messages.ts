/**
 * Represents a message sent from the User/CLI to the Agent.
 */
export interface InboundMessage {
  type: 'prompt' | 'system_override';
  content: string;
}

/**
 * Represents a message sent from the Agent back to the User/CLI.
 */
export type OutboundMessage =
  | { type: 'content'; content: string }
  | { type: 'tool_call'; toolName: string; toolArgs?: any }
  | { type: 'status_update'; state: 'BLOCKED' | 'COMPLETED'; reason: string }
  | { type: 'error'; content: string }
  | { type: 'done' };
