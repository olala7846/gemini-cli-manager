/**
 * Represents a message sent from the User/CLI to the Agent.
 */
export type InboundMessage = 
  | { type: 'prompt'; content: string }
  | { type: 'system_override'; content: string }
  | { type: 'resume_task'; content: string };

/**
 * Represents a message sent from the Agent back to the User/CLI.
 */
export type OutboundMessage =
  | { type: 'content'; content: string }
  | { type: 'tool_call'; toolName: string; toolArgs?: any }
  | { type: 'input_needed'; reason: string }
  | { type: 'task_completed'; reason: string }
  | { type: 'task_failed'; reason: string }
  | { type: 'error'; content: string }
  | { type: 'done' };
