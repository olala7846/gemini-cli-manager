import type { Content } from '@google/gemini-cli-core';

/**
 * Interface definition for long-term chat history storage.
 * In the future, this will be implemented via Redis or a relational DB.
 */
export interface SessionStore {
  /** Retrieves chat history for a given session. */
  getHistory(sessionId: string): Promise<Content[]>;
  /** Saves the full chronological chat history of the session. */
  save(sessionId: string, items: Content[]): Promise<void>;
  /** Clears the session history permanently. */
  clear(sessionId: string): Promise<void>;
}

/**
 * Interface definition for external progressive memory storage.
 * Long-term observations extracted by automated cron summaries will be
 * loaded directly into the AgentWorker's system prompt prior to invocation.
 */
export interface MemStore {
  /** Retrieves long-term observations for a persona or a specific user. */
  getMemory(personaId: string, userId?: string): Promise<string>;
  /** Adds a new observation dynamically extracted from recent chat history. */
  addObservation(personaId: string, observation: string, userId?: string): Promise<void>;
}
