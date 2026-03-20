import type { GeminiCliSession } from '@google/gemini-cli-sdk';
// We're importing the type only since it's used for typing the history records.
// If the core types aren't available, we use any for simplicity in the bypass.
import type { ConversationRecord } from '@google/gemini-cli-core';

/**
 * 🚨 SDK WORKAROUND 🚨
 *
 * The current version of `@google/gemini-cli-sdk` intrinsically ties session
 * persistence and agent history to internal logic that isn't fully exposed via
 * public interfaces (e.g. `resumeSession` assumes local file paths).
 *
 * To implement headless, multi-agent contexts backed by a decoupled database
 * (like Postgres, Redis, or an external SessionStore), we must temporarily bypass
 * the SDK's encapsulation to natively hydrate and extract conversation records.
 *
 * This file centralizes these unsafe access patterns. If the SDK later exposes
 * `session.getHistory()` and `session.loadHistory()` natively, we can safely
 * deprecate these wrappers.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getInternalClient(session: GeminiCliSession): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (session as any).client;
}

export async function hydrateSessionHistory(
  session: GeminiCliSession,
  history: ConversationRecord[],
  sessionId: string
): Promise<void> {
  const client = getInternalClient(session);
  if (client && client.resumeChat) {
    await client.resumeChat(history, {
      conversation: { sessionId, messages: [] },
      filePath: ''
    });
  }
}

export function extractSessionHistory(session: GeminiCliSession): ConversationRecord[] {
  const client = getInternalClient(session);
  if (client && client.getHistory) {
    return client.getHistory() as ConversationRecord[];
  }
  return [];
}
