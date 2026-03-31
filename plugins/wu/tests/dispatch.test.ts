/**
 * Unit tests for AgentDispatcher — cost gate, batching, progress, result hashing, verdict parsing.
 * Note: These test the dispatcher logic, not the SDK integration (which requires live API).
 */

import { describe, it, expect } from 'vitest';
import { computeResultHash, parseVerdict } from '../lib/dispatch.js';
import type { AgentDefinition, DispatchResult } from '../lib/types.js';

// ---------------------------------------------------------------------------
// computeResultHash
// ---------------------------------------------------------------------------

describe('computeResultHash', () => {
  it('returns a 64-character hex string', () => {
    const result: DispatchResult = {
      agent: 'gza',
      verdict: { verdict: 'pass', confidence: 0.9, findings: [] },
      status: 'completed',
      durationMs: 1500,
      tokensIn: 10000,
      tokensOut: 3000,
      fallbackUsed: false,
    };
    const hash = computeResultHash(result);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different results', () => {
    const result1: DispatchResult = {
      agent: 'gza',
      verdict: { verdict: 'pass', confidence: 0.9, findings: [] },
      status: 'completed',
      durationMs: 1500,
      tokensIn: 10000,
      tokensOut: 3000,
      fallbackUsed: false,
    };
    const result2: DispatchResult = { ...result1, agent: 'rza' };
    expect(computeResultHash(result1)).not.toBe(computeResultHash(result2));
  });

  it('produces same hash for same result', () => {
    const result: DispatchResult = {
      agent: 'gza',
      verdict: { verdict: 'pass', confidence: 0.9, findings: [] },
      status: 'completed',
      durationMs: 1500,
      tokensIn: 10000,
      tokensOut: 3000,
      fallbackUsed: false,
    };
    expect(computeResultHash(result)).toBe(computeResultHash(result));
  });

  it('handles null verdict', () => {
    const result: DispatchResult = {
      agent: 'gza',
      verdict: null,
      status: 'failed',
      durationMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      error: 'timeout',
      fallbackUsed: false,
    };
    expect(computeResultHash(result)).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// parseVerdict
// ---------------------------------------------------------------------------

describe('parseVerdict', () => {
  it('parses valid verdict JSON', () => {
    const json = JSON.stringify({
      verdict: 'pass',
      confidence: 0.9,
      findings: [],
    });
    const result = parseVerdict(json);
    expect(result.verdict).toBe('pass');
    expect(result.confidence).toBe(0.9);
    expect(result.findings).toEqual([]);
  });

  it('strips markdown code fences', () => {
    const text = '```json\n{"verdict":"fail","confidence":0.7,"findings":[]}\n```';
    const result = parseVerdict(text);
    expect(result.verdict).toBe('fail');
  });

  it('accepts all valid verdict values', () => {
    for (const v of ['pass', 'fail', 'conditional_pass', 'inconclusive']) {
      const json = JSON.stringify({ verdict: v, confidence: 0.5, findings: [] });
      expect(parseVerdict(json).verdict).toBe(v);
    }
  });

  it('rejects invalid verdict value', () => {
    const json = JSON.stringify({ verdict: 'maybe', confidence: 0.5, findings: [] });
    expect(() => parseVerdict(json)).toThrow('Invalid verdict value');
  });

  it('rejects confidence below 0', () => {
    const json = JSON.stringify({ verdict: 'pass', confidence: -0.1, findings: [] });
    expect(() => parseVerdict(json)).toThrow('Invalid confidence');
  });

  it('rejects confidence above 1', () => {
    const json = JSON.stringify({ verdict: 'pass', confidence: 1.5, findings: [] });
    expect(() => parseVerdict(json)).toThrow('Invalid confidence');
  });

  it('rejects non-number confidence', () => {
    const json = JSON.stringify({ verdict: 'pass', confidence: 'high', findings: [] });
    expect(() => parseVerdict(json)).toThrow('Invalid confidence');
  });

  it('rejects non-array findings', () => {
    const json = JSON.stringify({ verdict: 'pass', confidence: 0.9, findings: 'none' });
    expect(() => parseVerdict(json)).toThrow('Findings must be an array');
  });

  it('validates finding severity', () => {
    const json = JSON.stringify({
      verdict: 'pass',
      confidence: 0.9,
      findings: [{ severity: 'urgent', description: 'test', location: 'a', recommendation: 'b' }],
    });
    expect(() => parseVerdict(json)).toThrow('invalid severity');
  });

  it('validates finding has description', () => {
    const json = JSON.stringify({
      verdict: 'pass',
      confidence: 0.9,
      findings: [{ severity: 'high', location: 'a', recommendation: 'b' }],
    });
    expect(() => parseVerdict(json)).toThrow('missing a string "description"');
  });

  it('accepts valid findings', () => {
    const json = JSON.stringify({
      verdict: 'conditional_pass',
      confidence: 0.75,
      findings: [
        { severity: 'high', description: 'Missing error handling', location: 'src/foo.ts:42', recommendation: 'Add try/catch' },
        { severity: 'info', description: 'Could use const', location: 'src/bar.ts:10', recommendation: 'Change let to const' },
      ],
    });
    const result = parseVerdict(json);
    expect(result.findings.length).toBe(2);
  });

  it('rejects non-JSON input', () => {
    expect(() => parseVerdict('not json at all')).toThrow();
  });

  it('rejects null', () => {
    expect(() => parseVerdict('null')).toThrow('not a JSON object');
  });

  it('accepts confidence of exactly 0 and 1', () => {
    expect(parseVerdict(JSON.stringify({ verdict: 'pass', confidence: 0, findings: [] })).confidence).toBe(0);
    expect(parseVerdict(JSON.stringify({ verdict: 'pass', confidence: 1, findings: [] })).confidence).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AgentDispatcher constructor
// ---------------------------------------------------------------------------

describe('AgentDispatcher constructor', () => {
  it('throws when no API key is available', async () => {
    const saved = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      const { AgentDispatcher } = await import('../lib/dispatch.js');
      expect(() => new AgentDispatcher()).toThrow('API key');
    } finally {
      if (saved) process.env['ANTHROPIC_API_KEY'] = saved;
    }
  });

  it('accepts explicit API key', async () => {
    const { AgentDispatcher } = await import('../lib/dispatch.js');
    expect(() => new AgentDispatcher('test-key-123')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Type smoke test
// ---------------------------------------------------------------------------

describe('AgentDefinition type', () => {
  it('accepts valid agent definition', () => {
    const def: AgentDefinition = {
      alias: 'gza',
      displayName: 'The GZA',
      role: 'Technical Architect',
      persona: 'The genius.',
      model: 'opus',
      tools: ['Read', 'Grep', 'Glob'],
    };
    expect(def.alias).toBe('gza');
    expect(def.model).toBe('opus');
  });
});
