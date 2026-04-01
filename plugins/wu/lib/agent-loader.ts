/**
 * Agent loader — parse agent .md files from the agents/ directory into AgentDefinition objects.
 *
 * Each agent file has YAML frontmatter with: name, description, model, color, tools.
 * The body after the closing --- is the agent's system prompt (persona + instructions).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentAlias, AgentDefinition, ModelTier } from './types.js';

const VALID_ALIASES = new Set<AgentAlias>([
  'rza', 'gza', 'method-man', 'raekwon', 'ghostface',
  'inspectah-deck', 'u-god', 'masta-killa', 'odb',
]);

const VALID_MODELS = new Set<ModelTier>(['opus', 'sonnet', 'haiku']);

interface AgentFrontmatter {
  name: string;
  description: string;
  model: string;
  color: string;
  tools: string[];
}

/**
 * Parse YAML-like frontmatter from an agent .md file.
 * Handles the quirks of this repo's frontmatter: multiline quoted descriptions,
 * JSON arrays for tools.
 */
function parseFrontmatter(content: string): { frontmatter: AgentFrontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error('No frontmatter found');
  }

  const fmText = fmMatch[1];
  const body = fmMatch[2].trim();

  // Extract fields. Description is multiline-quoted so we handle it specially.
  const nameMatch = fmText.match(/^name:\s*(.+)$/m);
  const modelMatch = fmText.match(/^model:\s*(.+)$/m);
  const colorMatch = fmText.match(/^color:\s*(.+)$/m);
  const toolsMatch = fmText.match(/^tools:\s*(\[.+\])$/m);

  if (!nameMatch || !modelMatch || !toolsMatch) {
    throw new Error('Missing required frontmatter fields (name, model, tools)');
  }

  // Description spans from 'description: "' to the closing quote before model/color/tools
  const descStart = fmText.indexOf('description: "');
  let description = '';
  if (descStart !== -1) {
    const afterPrefix = fmText.slice(descStart + 'description: "'.length);
    // Find the closing quote — it's the last " before the next top-level field
    const closingQuoteIdx = afterPrefix.lastIndexOf('"');
    if (closingQuoteIdx !== -1) {
      description = afterPrefix.slice(0, closingQuoteIdx);
    }
  }

  const tools: string[] = JSON.parse(toolsMatch[1]);

  return {
    frontmatter: {
      name: nameMatch[1].trim(),
      description,
      model: modelMatch[1].trim(),
      color: colorMatch?.[1]?.trim() ?? 'white',
      tools,
    },
    body,
  };
}

/** Convert a parsed agent file into an AgentDefinition. */
function toAgentDefinition(fm: AgentFrontmatter, body: string): AgentDefinition {
  const alias = fm.name as AgentAlias;
  if (!VALID_ALIASES.has(alias)) {
    throw new Error(`Unknown agent alias: "${fm.name}"`);
  }

  const model = fm.model as ModelTier;
  if (!VALID_MODELS.has(model)) {
    throw new Error(`Invalid model tier "${fm.model}" for agent "${fm.name}"`);
  }

  // Build a display name from the alias
  const displayName = alias
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    alias,
    displayName,
    role: fm.description.split('.')[0] || fm.description,
    persona: body,
    model,
    tools: fm.tools,
  };
}

/**
 * Load all agent definitions from the agents/ directory.
 * @param agentsDir - Absolute path to the agents/ directory.
 * @returns Map of alias -> AgentDefinition
 */
export async function loadAgents(agentsDir: string): Promise<Map<AgentAlias, AgentDefinition>> {
  const files = await readdir(agentsDir);
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const agents = new Map<AgentAlias, AgentDefinition>();

  for (const file of mdFiles) {
    const content = await readFile(join(agentsDir, file), 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);
    const def = toAgentDefinition(frontmatter, body);
    agents.set(def.alias, def);
  }

  return agents;
}

/**
 * Load specific agents by alias.
 * @throws If any requested alias is not found.
 */
export async function loadAgentsByAlias(
  agentsDir: string,
  aliases: AgentAlias[],
): Promise<AgentDefinition[]> {
  const all = await loadAgents(agentsDir);
  const result: AgentDefinition[] = [];

  for (const alias of aliases) {
    const def = all.get(alias);
    if (!def) {
      const available = [...all.keys()].join(', ');
      throw new Error(`Agent "${alias}" not found. Available: ${available}`);
    }
    result.push(def);
  }

  return result;
}

export { parseFrontmatter, toAgentDefinition };
