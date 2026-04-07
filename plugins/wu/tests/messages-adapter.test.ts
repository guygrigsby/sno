/**
 * Unit tests for MessagesApiDispatchAdapter — constructor validation,
 * single-turn dispatch, tool-use mode detection, dispatch_mode tagging,
 * and error handling.
 *
 * Uses a manually injected mock Anthropic client to avoid ESM mocking issues.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentDefinition } from '../lib/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal AgentDefinition for tests. */
function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    alias: 'gza',
    displayName: 'GZA',
    role: 'Architect',
    persona: 'The genius.',
    model: 'opus',
    tools: [],
    ...overrides,
  };
}

/** Build a mock Anthropic messages.create response. */
function mockCreateResponse(overrides: Record<string, unknown> = {}) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          verdict: 'pass',
          confidence: 0.9,
          findings: [],
        }),
      },
    ],
    stop_reason: 'end_turn',
    usage: { input_tokens: 1000, output_tokens: 500 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('MessagesApiDispatchAdapter constructor', () => {
  it('throws without API key', async () => {
    const saved = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
      expect(() => new MessagesApiDispatchAdapter()).toThrow('API key');
    } finally {
      if (saved) process.env['ANTHROPIC_API_KEY'] = saved;
    }
  });

  it('accepts explicit API key', async () => {
    const saved = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
      expect(() => new MessagesApiDispatchAdapter({ apiKey: 'test-key-123' })).not.toThrow();
    } finally {
      if (saved) process.env['ANTHROPIC_API_KEY'] = saved;
    }
  });

  it('accepts custom model IDs', async () => {
    const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
    expect(
      () =>
        new MessagesApiDispatchAdapter({
          apiKey: 'test-key',
          modelIds: { opus: 'custom-opus-model' },
        }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// mode property
// ---------------------------------------------------------------------------

describe('MessagesApiDispatchAdapter.mode', () => {
  it('returns messages-api', async () => {
    const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
    const adapter = new MessagesApiDispatchAdapter({ apiKey: 'test-key' });
    expect(adapter.mode).toBe('messages-api');
  });
});

// ---------------------------------------------------------------------------
// Single-turn dispatch (mocked client)
// ---------------------------------------------------------------------------

describe('MessagesApiDispatchAdapter dispatch (single-turn)', () => {
  let adapter: InstanceType<typeof import('../lib/messages-adapter.js').MessagesApiDispatchAdapter>;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
    adapter = new MessagesApiDispatchAdapter({ apiKey: 'test-key' });

    // Inject a mock client by reaching into the private field.
    // This avoids complex ESM module mocking.
    mockCreate = vi.fn().mockResolvedValue(mockCreateResponse());
    (adapter as unknown as Record<string, unknown>)['client'] = {
      messages: { create: mockCreate },
    };
  });

  it('calls messages.create with correct parameters', async () => {
    const agent = makeAgent({ alias: 'gza', model: 'opus', tools: [] });
    await adapter.dispatch([agent], 'Analyze this code');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-opus-4-6');
    expect(callArgs.system).toContain('GZA');
    expect(callArgs.messages[0].content).toBe('Analyze this code');
  });

  it('returns dispatch_mode as messages-api for single-turn', async () => {
    const agent = makeAgent({ tools: ['Read', 'Grep'] });
    const results = await adapter.dispatch([agent], 'test');

    expect(results.length).toBe(1);
    expect(results[0].dispatch_mode).toBe('messages-api');
  });

  it('extracts tokens from response usage', async () => {
    const agent = makeAgent();
    const results = await adapter.dispatch([agent], 'test');

    expect(results[0].tokensIn).toBe(1000);
    expect(results[0].tokensOut).toBe(500);
  });

  it('returns completed status with parsed verdict', async () => {
    const agent = makeAgent();
    const results = await adapter.dispatch([agent], 'test');

    expect(results[0].status).toBe('completed');
    expect(results[0].verdict).not.toBeNull();
    expect(results[0].verdict!.verdict).toBe('pass');
    expect(results[0].verdict!.confidence).toBe(0.9);
  });
});

// ---------------------------------------------------------------------------
// Tool-use mode detection
// ---------------------------------------------------------------------------

describe('MessagesApiDispatchAdapter tool-use detection', () => {
  let adapter: InstanceType<typeof import('../lib/messages-adapter.js').MessagesApiDispatchAdapter>;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
    adapter = new MessagesApiDispatchAdapter({ apiKey: 'test-key' });

    // For tool-use agents the adapter makes multiple calls; the last one ends the loop.
    mockCreate = vi.fn().mockResolvedValue(mockCreateResponse());
    (adapter as unknown as Record<string, unknown>)['client'] = {
      messages: { create: mockCreate },
    };
  });

  it('agent with Edit/Write/Bash triggers tool-use mode', async () => {
    const agent = makeAgent({ tools: ['Read', 'Edit', 'Write', 'Bash'] });
    const results = await adapter.dispatch([agent], 'fix this');

    expect(results[0].dispatch_mode).toBe('messages-api-tools');
  });

  it('agent with only Read/Grep triggers single-turn', async () => {
    const agent = makeAgent({ tools: ['Read', 'Grep'] });
    const results = await adapter.dispatch([agent], 'analyze');

    expect(results[0].dispatch_mode).toBe('messages-api');
  });

  it('agent with no tools triggers single-turn', async () => {
    const agent = makeAgent({ tools: [] });
    const results = await adapter.dispatch([agent], 'analyze');

    expect(results[0].dispatch_mode).toBe('messages-api');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('MessagesApiDispatchAdapter error handling', () => {
  it('API error returns failed DispatchResult with error message', async () => {
    const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
    const adapter = new MessagesApiDispatchAdapter({ apiKey: 'test-key' });

    const mockCreate = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));
    (adapter as unknown as Record<string, unknown>)['client'] = {
      messages: { create: mockCreate },
    };

    const agent = makeAgent();
    const results = await adapter.dispatch([agent], 'test');

    expect(results.length).toBe(1);
    expect(results[0].status).toBe('failed');
    expect(results[0].verdict).toBeNull();
    expect(results[0].error).toContain('Rate limit exceeded');
  });

  it('unparseable verdict returns failed result', async () => {
    const { MessagesApiDispatchAdapter } = await import('../lib/messages-adapter.js');
    const adapter = new MessagesApiDispatchAdapter({ apiKey: 'test-key' });

    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'This is not JSON at all' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 200 },
    });
    (adapter as unknown as Record<string, unknown>)['client'] = {
      messages: { create: mockCreate },
    };

    const agent = makeAgent();
    const results = await adapter.dispatch([agent], 'test');

    expect(results[0].status).toBe('failed');
    expect(results[0].verdict).toBeNull();
    expect(results[0].error).toContain('Failed to parse verdict');
  });
});
