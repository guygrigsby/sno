/**
 * Tests for agent-loader — frontmatter parsing and agent definition loading.
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter, toAgentDefinition } from '../lib/agent-loader.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAgents, loadAgentsByAlias } from '../lib/agent-loader.js';

const thisDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(thisDir, '..', 'agents');

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  it('parses standard agent frontmatter', () => {
    const content = `---
name: gza
description: "Technical architect and code reviewer."
model: opus
color: blue
tools: ["Read", "Grep", "Glob"]
---

You are GZA, the Genius.`;

    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter.name).toBe('gza');
    expect(frontmatter.model).toBe('opus');
    expect(frontmatter.tools).toEqual(['Read', 'Grep', 'Glob']);
    expect(body).toBe('You are GZA, the Genius.');
  });

  it('handles multiline descriptions', () => {
    const content = `---
name: ghostface
description: "Spec Writer and Domain Researcher.
Captures nuance others miss."
model: sonnet
color: yellow
tools: ["Read", "Grep"]
---

Body text here.`;

    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.description).toContain('Spec Writer');
    expect(frontmatter.description).toContain('nuance others miss');
  });

  it('throws on missing frontmatter', () => {
    expect(() => parseFrontmatter('No frontmatter here')).toThrow('No frontmatter found');
  });

  it('throws on missing required fields', () => {
    const content = `---
name: test
color: red
---

Body.`;
    expect(() => parseFrontmatter(content)).toThrow('Missing required frontmatter fields');
  });
});

// ---------------------------------------------------------------------------
// toAgentDefinition
// ---------------------------------------------------------------------------

describe('toAgentDefinition', () => {
  it('converts frontmatter to AgentDefinition', () => {
    const fm = {
      name: 'gza',
      description: 'Technical architect. Deep analysis.',
      model: 'opus',
      color: 'blue',
      tools: ['Read', 'Grep', 'Glob'],
    };
    const def = toAgentDefinition(fm, 'You are GZA.');
    expect(def.alias).toBe('gza');
    expect(def.displayName).toBe('Gza');
    expect(def.model).toBe('opus');
    expect(def.persona).toBe('You are GZA.');
    expect(def.tools).toEqual(['Read', 'Grep', 'Glob']);
    expect(def.role).toBe('Technical architect');
  });

  it('rejects unknown alias', () => {
    const fm = { name: 'cappadonna', description: 'x', model: 'opus', color: 'red', tools: [] };
    expect(() => toAgentDefinition(fm, '')).toThrow('Unknown agent alias');
  });

  it('rejects invalid model', () => {
    const fm = { name: 'gza', description: 'x', model: 'gpt-4', color: 'blue', tools: [] };
    expect(() => toAgentDefinition(fm, '')).toThrow('Invalid model tier');
  });
});

// ---------------------------------------------------------------------------
// loadAgents (integration — reads real agent files)
// ---------------------------------------------------------------------------

describe('loadAgents', () => {
  it('loads all 9 agents from the agents/ directory', async () => {
    const agents = await loadAgents(agentsDir);
    expect(agents.size).toBe(9);
    expect(agents.has('gza')).toBe(true);
    expect(agents.has('rza')).toBe(true);
    expect(agents.has('odb')).toBe(true);
  });

  it('every agent has a non-empty persona', async () => {
    const agents = await loadAgents(agentsDir);
    for (const [alias, def] of agents) {
      expect(def.persona.length).toBeGreaterThan(0);
    }
  });

  it('every agent has at least one tool', async () => {
    const agents = await loadAgents(agentsDir);
    for (const [alias, def] of agents) {
      expect(def.tools.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// loadAgentsByAlias
// ---------------------------------------------------------------------------

describe('loadAgentsByAlias', () => {
  it('loads specific agents', async () => {
    const agents = await loadAgentsByAlias(agentsDir, ['gza', 'rza']);
    expect(agents.length).toBe(2);
    expect(agents[0].alias).toBe('gza');
    expect(agents[1].alias).toBe('rza');
  });

  it('throws on unknown alias', async () => {
    await expect(loadAgentsByAlias(agentsDir, ['cappadonna' as any])).rejects.toThrow('not found');
  });
});
