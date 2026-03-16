import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AgentConfig {
  id: string;
  description: string;
  systemPrompt: string;
  skills: string[];
  models?: {
    primary: string;
  };
}

let loadedAgents: Record<string, AgentConfig> | null = null;
let loadedPrompts: Record<string, string> | null = null;

export function loadRegistry(configPath = path.join(process.cwd(), 'agents.json')): void {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Agent configuration file not found at: ${configPath}`);
  }
  const rawData = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(rawData) as { agents: AgentConfig[], prompts?: Record<string, string> };

  loadedAgents = {};
  for (const agent of parsed.agents) {
    loadedAgents[agent.id] = agent;
  }
  loadedPrompts = parsed.prompts || {};
}

export function getAgentConfig(id: string): AgentConfig {
  if (!loadedAgents) {
    // Default fallback to look in CWD if not explicitly loaded
    loadRegistry();
  }

  const config = loadedAgents![id];
  if (!config) {
    throw new Error(`Agent configuration for '${id}' not found in registry.`);
  }
  return config;
}

export function getPredefinedPrompt(name: string): string {
  if (!loadedPrompts) {
    loadRegistry();
  }

  const prompt = loadedPrompts![name];
  if (!prompt) {
    throw new Error(`Predefined prompt '${name}' not found in registry.`);
  }
  return prompt;
}
