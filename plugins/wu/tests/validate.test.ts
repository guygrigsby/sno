/**
 * Validation tests for wu plugin structure.
 * Checks schema validity, agent/command file integrity, frontmatter, and cross-references.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(PLUGIN_ROOT, 'agents');
const COMMANDS_DIR = path.join(PLUGIN_ROOT, 'commands');
const SCHEMAS_DIR = path.join(PLUGIN_ROOT, 'schemas');
const MARKETPLACE_PATH = path.resolve(PLUGIN_ROOT, '../../.claude-plugin/marketplace.json');

const EXPECTED_AGENTS = [
  'rza', 'gza', 'method-man', 'raekwon', 'ghostface',
  'inspectah-deck', 'u-god', 'masta-killa', 'odb',
] as const;

const EXPECTED_COMMANDS = [
  'wu', 'new', 'abort', 'learn', 'plan', 'build',
  'check', 'ship', 'cipher', 'status', 'replay', 'override',
  'crew', 'audit', 'risk', 'gate',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function parseJsonFile(filePath: string): unknown {
  return JSON.parse(readFile(filePath));
}

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  // Simple YAML parsing for flat key-value pairs
  // Handles: name: value, name: "value", name: [array]
  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value: unknown = kvMatch[2].trim();
      // Parse arrays
      if (typeof value === 'string' && value.startsWith('[')) {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string if JSON parse fails
        }
      }
      // Strip surrounding quotes
      if (typeof value === 'string' && value.startsWith('"')) {
        // Multi-line description — just take first line content
        value = value.slice(1);
        if (value.endsWith('"')) {
          value = value.slice(0, -1);
        }
      }
      result[key] = value;
    }
  }

  return result;
}

function lineCount(filePath: string): number {
  return readFile(filePath).split('\n').length;
}

// ---------------------------------------------------------------------------
// Plugin manifest
// ---------------------------------------------------------------------------

describe('plugin.json', () => {
  it('exists and is valid JSON', () => {
    const pluginJson = parseJsonFile(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'));
    expect(pluginJson).toBeDefined();
  });

  it('has correct name', () => {
    const pluginJson = parseJsonFile(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json')) as Record<string, unknown>;
    expect(pluginJson['name']).toBe('wu');
  });

  it('has version', () => {
    const pluginJson = parseJsonFile(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json')) as Record<string, unknown>;
    expect(pluginJson['version']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

describe('marketplace.json', () => {
  it('contains wu entry', () => {
    const marketplace = parseJsonFile(MARKETPLACE_PATH) as { plugins: Array<{ name: string }> };
    const wuEntry = marketplace.plugins.find((p) => p.name === 'wu');
    expect(wuEntry).toBeDefined();
  });

  it('wu entry has git-subdir source pointing to plugins/wu', () => {
    const marketplace = parseJsonFile(MARKETPLACE_PATH) as { plugins: Array<{ name: string; source: { source: string; path: string } }> };
    const wuEntry = marketplace.plugins.find((p) => p.name === 'wu');
    expect(wuEntry?.source.source).toBe('git-subdir');
    expect(wuEntry?.source.path).toBe('plugins/wu');
  });

  it('sno version is not stale (should be >= 1.11.0)', () => {
    const marketplace = parseJsonFile(MARKETPLACE_PATH) as { plugins: Array<{ name: string; version: string }> };
    const snoEntry = marketplace.plugins.find((p) => p.name === 'sno');
    expect(snoEntry).toBeDefined();
    // Should not be the old 1.5.1
    expect(snoEntry?.version).not.toBe('1.5.1');
  });
});

// ---------------------------------------------------------------------------
// Schema files
// ---------------------------------------------------------------------------

describe('schemas', () => {
  const schemaFiles = ['state.json', 'config.json', 'phase.json', 'audit-entry.json'];

  for (const schemaFile of schemaFiles) {
    it(`${schemaFile} is valid JSON`, () => {
      const schema = parseJsonFile(path.join(SCHEMAS_DIR, schemaFile));
      expect(schema).toBeDefined();
    });
  }

  it('summary-template.md exists', () => {
    expect(fs.existsSync(path.join(SCHEMAS_DIR, 'summary-template.md'))).toBe(true);
  });

  it('config.json schema has skip_phases that excludes learn and ship', () => {
    const config = parseJsonFile(path.join(SCHEMAS_DIR, 'config.json')) as Record<string, unknown>;
    const props = config['properties'] as Record<string, unknown>;
    const skipPhases = props['skip_phases'] as Record<string, unknown>;
    const items = skipPhases['items'] as Record<string, unknown>;
    const enumValues = items['enum'] as string[];
    expect(enumValues).not.toContain('learn');
    expect(enumValues).not.toContain('ship');
  });
});

// ---------------------------------------------------------------------------
// Agent files
// ---------------------------------------------------------------------------

describe('agent files', () => {
  it('has exactly 9 agent files', () => {
    const agentFiles = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
    expect(agentFiles.length).toBe(9);
  });

  for (const alias of EXPECTED_AGENTS) {
    describe(alias, () => {
      const filePath = path.join(AGENTS_DIR, `${alias}.md`);

      it('file exists', () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it('has YAML frontmatter', () => {
        const content = readFile(filePath);
        const fm = parseFrontmatter(content);
        expect(fm).not.toBeNull();
      });

      it('frontmatter has required fields: name, description, model, tools', () => {
        const content = readFile(filePath);
        const fm = parseFrontmatter(content);
        expect(fm).not.toBeNull();
        expect(fm!['name']).toBeDefined();
        expect(fm!['description']).toBeDefined();
        expect(fm!['model']).toBeDefined();
        expect(fm!['tools']).toBeDefined();
      });

      it('frontmatter name matches filename', () => {
        const content = readFile(filePath);
        const fm = parseFrontmatter(content);
        expect(fm!['name']).toBe(alias);
      });

      it('has example blocks in description', () => {
        const content = readFile(filePath);
        expect(content).toContain('<example>');
      });

      it('is under 150 lines', () => {
        expect(lineCount(filePath)).toBeLessThanOrEqual(150);
      });
    });
  }

  it('odb has rate-limiting constraint', () => {
    const content = readFile(path.join(AGENTS_DIR, 'odb.md'));
    const lowerContent = content.toLowerCase();
    expect(
      lowerContent.includes('sole reviewer') || lowerContent.includes('never sole') || lowerContent.includes('rate-limit')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Command files
// ---------------------------------------------------------------------------

describe('command files', () => {
  it('has exactly 16 command files', () => {
    const cmdFiles = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
    expect(cmdFiles.length).toBe(16);
  });

  for (const cmd of EXPECTED_COMMANDS) {
    describe(cmd, () => {
      const filePath = path.join(COMMANDS_DIR, `${cmd}.md`);

      it('file exists', () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it('has YAML frontmatter with name and description', () => {
        const content = readFile(filePath);
        const fm = parseFrontmatter(content);
        expect(fm).not.toBeNull();
        expect(fm!['name']).toBeDefined();
        expect(fm!['description']).toBeDefined();
      });

      it('is under 200 lines', () => {
        expect(lineCount(filePath)).toBeLessThanOrEqual(200);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Agent reference integrity
// ---------------------------------------------------------------------------

describe('agent reference integrity', () => {
  it('every agent alias referenced in commands exists as a file in agents/', () => {
    const agentFiles = new Set(
      fs.readdirSync(AGENTS_DIR)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''))
    );

    const missingRefs: string[] = [];

    for (const cmd of EXPECTED_COMMANDS) {
      const content = readFile(path.join(COMMANDS_DIR, `${cmd}.md`));
      // Check for agent alias references in commands
      for (const alias of EXPECTED_AGENTS) {
        if (content.includes(alias) && !agentFiles.has(alias)) {
          missingRefs.push(`${cmd}.md references ${alias} but no agents/${alias}.md exists`);
        }
      }
    }

    expect(missingRefs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase pipeline coverage
// ---------------------------------------------------------------------------

describe('phase pipeline coverage', () => {
  const PHASES = [
    'learn', 'plan', 'risk-analysis', 'license-check', 'copyright-check',
    'performance-tradeoff', 'build', 'check', 'cipher', 'ship',
  ];

  it('every phase is referenced in at least one command', () => {
    const allCommandContent = EXPECTED_COMMANDS
      .map((cmd) => readFile(path.join(COMMANDS_DIR, `${cmd}.md`)))
      .join('\n');

    const unreferencedPhases = PHASES.filter((phase) => !allCommandContent.includes(phase));
    expect(unreferencedPhases).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Command files contain no local fallback references
// ---------------------------------------------------------------------------

describe('command files contain no local fallback references', () => {
  const FORBIDDEN_PATTERNS = [
    /Agent tool/i,
    /local fallback/i,
    /LAST-RESORT/,
    /fall back to.*local/i,
    /subagent_type.*wu:/,
  ];

  const cmdDir = path.join(PLUGIN_ROOT, 'commands');
  const cmdFiles = fs.readdirSync(cmdDir).filter((f) => f.endsWith('.md'));

  for (const file of cmdFiles) {
    it(`${file} has no local fallback references`, () => {
      const content = fs.readFileSync(path.join(cmdDir, file), 'utf-8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(content).not.toMatch(pattern);
      }
    });
  }

  it('go.md does not exist', () => {
    expect(fs.existsSync(path.join(COMMANDS_DIR, 'go.md'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Agent roster completeness
// ---------------------------------------------------------------------------

describe('agent roster completeness', () => {
  const WU_TANG_MEMBERS = [
    { alias: 'rza', displayName: 'RZA' },
    { alias: 'gza', displayName: 'GZA' },
    { alias: 'method-man', displayName: 'Method Man' },
    { alias: 'raekwon', displayName: 'Raekwon' },
    { alias: 'ghostface', displayName: 'Ghostface' },
    { alias: 'inspectah-deck', displayName: 'Inspectah Deck' },
    { alias: 'u-god', displayName: 'U-God' },
    { alias: 'masta-killa', displayName: 'Masta Killa' },
    { alias: 'odb', displayName: 'ODB' },
  ];

  for (const member of WU_TANG_MEMBERS) {
    it(`${member.displayName} (${member.alias}) has an agent file`, () => {
      expect(fs.existsSync(path.join(AGENTS_DIR, `${member.alias}.md`))).toBe(true);
    });
  }
});
