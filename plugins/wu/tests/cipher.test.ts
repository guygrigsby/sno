/**
 * Unit tests for CipherService — concordance, slop scoring, conflict detection, ODB separation.
 */

import { describe, it, expect } from 'vitest';
import { CipherService } from '../lib/cipher.js';
import type { Review, Verdict, CryptoVerdict, CryptoFinding } from '../lib/types.js';

function makeVerdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    verdict: 'pass',
    confidence: 0.9,
    findings: [],
    ...overrides,
  };
}

function makeReview(agent: string, verdict: Partial<Verdict> = {}): Review {
  return {
    agent: agent as Review['agent'],
    verdict: makeVerdict(verdict),
    timestamp: new Date().toISOString(),
  };
}

describe('CipherService.computeConcordance', () => {
  const cipher = new CipherService(0.3);

  it('returns 1.0 for unanimous reviews', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass' }),
      makeReview('inspectah-deck', { verdict: 'pass' }),
      makeReview('masta-killa', { verdict: 'pass' }),
    ];
    expect(cipher.computeConcordance(reviews)).toBe(1.0);
  });

  it('returns 1.0 for single review', () => {
    expect(cipher.computeConcordance([makeReview('gza')])).toBe(1.0);
  });

  it('returns 1.0 for empty reviews', () => {
    expect(cipher.computeConcordance([])).toBe(1.0);
  });

  it('returns 0.5 for split reviews', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass' }),
      makeReview('inspectah-deck', { verdict: 'fail' }),
    ];
    expect(cipher.computeConcordance(reviews)).toBe(0.5);
  });

  it('returns 2/3 for majority agreement', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass' }),
      makeReview('inspectah-deck', { verdict: 'pass' }),
      makeReview('masta-killa', { verdict: 'fail' }),
    ];
    expect(cipher.computeConcordance(reviews)).toBeCloseTo(2 / 3);
  });
});

describe('CipherService.computeSlopScore', () => {
  const cipher = new CipherService(0.3);

  it('returns 0 score for unanimous reviews', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass', confidence: 0.9 }),
      makeReview('inspectah-deck', { verdict: 'pass', confidence: 0.8 }),
    ];
    const slop = cipher.computeSlopScore(reviews);
    expect(slop.score).toBe(0);
    expect(slop.passed).toBe(true);
  });

  it('returns high score for split reviews with high confidence', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass', confidence: 0.95 }),
      makeReview('inspectah-deck', { verdict: 'fail', confidence: 0.95 }),
    ];
    const slop = cipher.computeSlopScore(reviews);
    expect(slop.score).toBeGreaterThan(0.3);
    expect(slop.passed).toBe(false);
  });

  it('returns passed=true for empty reviews', () => {
    const slop = cipher.computeSlopScore([]);
    expect(slop.passed).toBe(true);
  });

  it('uses configured threshold', () => {
    const strictCipher = new CipherService(0.1);
    const reviews = [
      makeReview('gza', { verdict: 'pass', confidence: 0.9 }),
      makeReview('inspectah-deck', { verdict: 'pass', confidence: 0.9 }),
      makeReview('masta-killa', { verdict: 'fail', confidence: 0.9 }),
    ];
    const slop = strictCipher.computeSlopScore(reviews);
    expect(slop.threshold).toBe(0.1);
  });
});

describe('CipherService.detectConflicts', () => {
  const cipher = new CipherService(0.3);

  it('returns no conflicts for unanimous reviews', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass' }),
      makeReview('inspectah-deck', { verdict: 'pass' }),
    ];
    expect(cipher.detectConflicts(reviews)).toEqual([]);
  });

  it('detects verdict-level disagreement', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass' }),
      makeReview('inspectah-deck', { verdict: 'fail' }),
    ];
    const conflicts = cipher.detectConflicts(reviews);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].parties.length).toBe(2);
  });

  it('detects contradictory finding severities at same location', () => {
    const reviews = [
      makeReview('gza', {
        verdict: 'pass',
        findings: [{ severity: 'info', description: 'minor', location: 'src/foo.ts', recommendation: 'none' }],
      }),
      makeReview('inspectah-deck', {
        verdict: 'pass',
        findings: [{ severity: 'critical', description: 'major', location: 'src/foo.ts', recommendation: 'fix' }],
      }),
    ];
    const conflicts = cipher.detectConflicts(reviews);
    expect(conflicts.some((c) => c.description.includes('src/foo.ts'))).toBe(true);
  });

  it('does not flag findings at different locations as conflicts', () => {
    const reviews = [
      makeReview('gza', {
        verdict: 'pass',
        findings: [{ severity: 'critical', description: 'a', location: 'src/a.ts', recommendation: 'fix' }],
      }),
      makeReview('inspectah-deck', {
        verdict: 'pass',
        findings: [{ severity: 'info', description: 'b', location: 'src/b.ts', recommendation: 'none' }],
      }),
    ];
    const conflicts = cipher.detectConflicts(reviews);
    // Only verdict conflicts (none since both pass), no location conflicts
    expect(conflicts.length).toBe(0);
  });
});

describe('CipherService.separateOdbOutput', () => {
  const cipher = new CipherService(0.3);

  it('separates ODB from structured reviewers', () => {
    const reviews = [
      makeReview('gza'),
      makeReview('odb'),
      makeReview('inspectah-deck'),
    ];
    const { structured, chaos } = cipher.separateOdbOutput(reviews);
    expect(structured.length).toBe(2);
    expect(chaos.length).toBe(1);
    expect(chaos[0].agent).toBe('odb');
  });

  it('returns all structured when no ODB', () => {
    const reviews = [makeReview('gza'), makeReview('inspectah-deck')];
    const { structured, chaos } = cipher.separateOdbOutput(reviews);
    expect(structured.length).toBe(2);
    expect(chaos.length).toBe(0);
  });
});

describe('CipherService.needsEscalation', () => {
  const cipher = new CipherService(0.3);

  it('routes high severity to RZA', () => {
    const conflicts = [
      { id: 'c1', severity: 'high' as const, description: 'test', parties: [] },
    ];
    const { toRza, toUser } = cipher.needsEscalation(conflicts);
    expect(toRza.length).toBe(1);
    expect(toUser.length).toBe(0);
  });

  it('routes unresolvable to user', () => {
    const conflicts = [
      { id: 'c1', severity: 'unresolvable' as const, description: 'test', parties: [] },
    ];
    const { toRza, toUser } = cipher.needsEscalation(conflicts);
    expect(toRza.length).toBe(0);
    expect(toUser.length).toBe(1);
  });

  it('ignores low and medium severity', () => {
    const conflicts = [
      { id: 'c1', severity: 'low' as const, description: 'test', parties: [] },
      { id: 'c2', severity: 'medium' as const, description: 'test', parties: [] },
    ];
    const { toRza, toUser } = cipher.needsEscalation(conflicts);
    expect(toRza.length).toBe(0);
    expect(toUser.length).toBe(0);
  });
});

function makeCryptoVerdict(overrides: Partial<CryptoVerdict> = {}): CryptoVerdict {
  return {
    verdict: 'pass',
    confidence: 0.9,
    findings: [],
    cryptoFindings: [],
    hasCryptoUsage: false,
    ...overrides,
  };
}

function makeCryptoFinding(overrides: Partial<CryptoFinding> = {}): CryptoFinding {
  return {
    severity: 'medium',
    description: 'test crypto finding',
    location: 'src/crypto.ts:10',
    recommendation: 'fix it',
    category: 'weak-algorithm',
    pass: 'code-scan',
    ...overrides,
  };
}

describe('CipherService.runCipherRound', () => {
  const cipher = new CipherService(0.3);

  it('produces a complete CipherRound', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass', confidence: 0.9 }),
      makeReview('inspectah-deck', { verdict: 'pass', confidence: 0.85 }),
    ];
    const round = cipher.runCipherRound('learn', 1, reviews);
    expect(round.phase).toBe('learn');
    expect(round.round).toBe(1);
    expect(round.reviews).toEqual(reviews);
    expect(round.concordance).toBe(1.0);
    expect(round.slopScore.passed).toBe(true);
    expect(round.conflicts).toEqual([]);
    expect(round.cryptoVerdict).toBeUndefined();
  });

  it('includes crypto verdict when provided', () => {
    const reviews = [makeReview('inspectah-deck', { verdict: 'pass' })];
    const crypto = makeCryptoVerdict({ hasCryptoUsage: true });
    const round = cipher.runCipherRound('cipher', 1, reviews, crypto);
    expect(round.cryptoVerdict).toBeDefined();
    expect(round.cryptoVerdict!.hasCryptoUsage).toBe(true);
  });
});

describe('CipherService.hasCriticalCryptoFindings', () => {
  const cipher = new CipherService(0.3);

  it('returns false when no crypto findings', () => {
    const crypto = makeCryptoVerdict();
    expect(cipher.hasCriticalCryptoFindings(crypto)).toBe(false);
  });

  it('returns false for non-critical findings', () => {
    const crypto = makeCryptoVerdict({
      cryptoFindings: [
        makeCryptoFinding({ severity: 'medium', category: 'weak-algorithm' }),
        makeCryptoFinding({ severity: 'low', category: 'key-management' }),
      ],
    });
    expect(cipher.hasCriticalCryptoFindings(crypto)).toBe(false);
  });

  it('returns true when any finding is critical', () => {
    const crypto = makeCryptoVerdict({
      cryptoFindings: [
        makeCryptoFinding({ severity: 'low', category: 'weak-algorithm' }),
        makeCryptoFinding({ severity: 'critical', category: 'hardcoded-secret' }),
      ],
    });
    expect(cipher.hasCriticalCryptoFindings(crypto)).toBe(true);
  });
});

describe('CipherService.cipherRoundPassed', () => {
  const cipher = new CipherService(0.3);

  it('passes when slop passes and no crypto verdict', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass', confidence: 0.9 }),
      makeReview('inspectah-deck', { verdict: 'pass', confidence: 0.9 }),
    ];
    const round = cipher.runCipherRound('cipher', 1, reviews);
    expect(cipher.cipherRoundPassed(round)).toBe(true);
  });

  it('passes when slop passes and crypto has no critical findings', () => {
    const reviews = [
      makeReview('inspectah-deck', { verdict: 'pass', confidence: 0.9 }),
    ];
    const crypto = makeCryptoVerdict({
      hasCryptoUsage: true,
      cryptoFindings: [makeCryptoFinding({ severity: 'medium' })],
    });
    const round = cipher.runCipherRound('cipher', 1, reviews, crypto);
    expect(cipher.cipherRoundPassed(round)).toBe(true);
  });

  it('fails when crypto has critical findings', () => {
    const reviews = [
      makeReview('inspectah-deck', { verdict: 'pass', confidence: 0.9 }),
    ];
    const crypto = makeCryptoVerdict({
      hasCryptoUsage: true,
      cryptoFindings: [makeCryptoFinding({ severity: 'critical', category: 'hardcoded-secret' })],
    });
    const round = cipher.runCipherRound('cipher', 1, reviews, crypto);
    expect(cipher.cipherRoundPassed(round)).toBe(false);
  });

  it('fails when slop fails even if crypto passes', () => {
    const reviews = [
      makeReview('gza', { verdict: 'pass', confidence: 0.95 }),
      makeReview('inspectah-deck', { verdict: 'fail', confidence: 0.95 }),
    ];
    const crypto = makeCryptoVerdict({ hasCryptoUsage: false });
    const round = cipher.runCipherRound('cipher', 1, reviews, crypto);
    expect(cipher.cipherRoundPassed(round)).toBe(false);
  });
});
