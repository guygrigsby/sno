/**
 * Unit tests for ContextHandoff — summary production, truncation, section extraction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ContextHandoff } from '../lib/context-handoff.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wu-handoff-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ContextHandoff.truncateToLimit', () => {
  const handoff = new ContextHandoff(100);

  it('returns content unchanged when under limit', () => {
    const short = 'This is short.';
    expect(handoff.truncateToLimit(short)).toBe(short);
  });

  it('truncates at sentence boundary', () => {
    const content = 'First sentence. Second sentence. Third sentence that pushes us way over the character limit for this test.';
    const result = handoff.truncateToLimit(content);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/\.$/);
  });

  it('falls back to newline boundary when no sentence end found', () => {
    const content = 'word '.repeat(30) + '\n' + 'more words';
    const result = handoff.truncateToLimit(content);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('hard-cuts when no boundary found at all', () => {
    const content = 'a'.repeat(200);
    const result = handoff.truncateToLimit(content);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('handles content exactly at limit', () => {
    const content = 'x'.repeat(100);
    expect(handoff.truncateToLimit(content)).toBe(content);
  });

  it('handles empty content', () => {
    expect(handoff.truncateToLimit('')).toBe('');
  });
});

describe('ContextHandoff.produceSummary', () => {
  it('writes summary.md to output directory', async () => {
    const handoff = new ContextHandoff(2000);
    const outputDir = path.join(tmpDir, 'phases', 'learn');

    await handoff.produceSummary('learn', 'Some findings about the domain.', outputDir);

    const summaryPath = path.join(outputDir, 'summary.md');
    expect(fs.existsSync(summaryPath)).toBe(true);
    const content = fs.readFileSync(summaryPath, 'utf-8');
    expect(content).toContain('learn');
  });

  it('creates output directory if it does not exist', async () => {
    const handoff = new ContextHandoff(2000);
    const outputDir = path.join(tmpDir, 'deep', 'nested', 'dir');

    await handoff.produceSummary('plan', 'Plan content.', outputDir);
    expect(fs.existsSync(path.join(outputDir, 'summary.md'))).toBe(true);
  });

  it('returns the summary text', async () => {
    const handoff = new ContextHandoff(2000);
    const result = await handoff.produceSummary('build', 'Build results.', tmpDir);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('respects maxChars limit', async () => {
    const handoff = new ContextHandoff(200);
    const longContent = 'This is a long sentence about the domain model. '.repeat(50);
    const result = await handoff.produceSummary('learn', longContent, tmpDir);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('formats raw content into template sections', async () => {
    const handoff = new ContextHandoff(2000);
    const result = await handoff.produceSummary('check', 'Raw check output with no sections.', tmpDir);
    expect(result).toContain('# check Summary');
    expect(result).toContain('## Verdict');
    expect(result).toContain('## Key Findings');
  });

  it('preserves structured sections from input', async () => {
    const handoff = new ContextHandoff(2000);
    const structured = [
      '## Verdict',
      'All checks passed.',
      '## Key Findings',
      '- Finding one',
      '- Finding two',
      '## Decisions Made',
      '- Decided to use port pattern',
    ].join('\n');

    const result = await handoff.produceSummary('learn', structured, tmpDir);
    expect(result).toContain('All checks passed');
    expect(result).toContain('Finding one');
    expect(result).toContain('port pattern');
  });
});
