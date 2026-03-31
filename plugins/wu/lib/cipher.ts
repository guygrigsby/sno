import type {
  PhaseName,
  Review,
  Verdict,
  Conflict,
  ConflictParty,
  CipherRound,
  SlopScore,
} from './types.js';

export class CipherService {
  private readonly slopThreshold: number;

  constructor(slopThreshold: number = 0.3) {
    this.slopThreshold = slopThreshold;
  }

  runCipherRound(phase: PhaseName, round: number, reviews: Review[]): CipherRound {
    const { structured, chaos } = this.separateOdbOutput(reviews);
    const concordance = this.computeConcordance(structured);
    const slopScore = this.computeSlopScore(structured);
    const conflicts = this.detectConflicts(reviews);

    return {
      phase,
      round,
      reviews,
      conflicts,
      concordance,
      slopScore,
    };
  }

  detectConflicts(reviews: Review[]): Conflict[] {
    const conflicts: Conflict[] = [];
    let conflictIndex = 0;

    for (let i = 0; i < reviews.length; i++) {
      for (let j = i + 1; j < reviews.length; j++) {
        const a = reviews[i];
        const b = reviews[j];

        // Verdict-level disagreement
        if (a.verdict.verdict !== b.verdict.verdict) {
          const severity = this.classifyConflictSeverity(a.verdict, b.verdict);
          const parties: ConflictParty[] = [
            { agent: a.agent, position: `verdict: ${a.verdict.verdict}`, confidence: a.verdict.confidence },
            { agent: b.agent, position: `verdict: ${b.verdict.verdict}`, confidence: b.verdict.confidence },
          ];
          conflicts.push({
            id: `conflict-${conflictIndex++}`,
            severity,
            description: `${a.agent} says ${a.verdict.verdict}, ${b.agent} says ${b.verdict.verdict}`,
            parties,
          });
        }

        // Contradictory findings: same location, one critical/high and the other low/info
        for (const findingA of a.verdict.findings) {
          for (const findingB of b.verdict.findings) {
            if (
              findingA.location === findingB.location &&
              this.findingsSeverityConflict(findingA.severity, findingB.severity)
            ) {
              const parties: ConflictParty[] = [
                { agent: a.agent, position: `${findingA.severity}: ${findingA.description}`, confidence: a.verdict.confidence },
                { agent: b.agent, position: `${findingB.severity}: ${findingB.description}`, confidence: b.verdict.confidence },
              ];
              conflicts.push({
                id: `conflict-${conflictIndex++}`,
                severity: 'medium',
                description: `Contradictory severity at ${findingA.location}: ${a.agent} rates ${findingA.severity}, ${b.agent} rates ${findingB.severity}`,
                parties,
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  separateOdbOutput(reviews: Review[]): { structured: Review[]; chaos: Review[] } {
    const structured: Review[] = [];
    const chaos: Review[] = [];

    for (const review of reviews) {
      if (review.agent === 'odb') {
        chaos.push(review);
      } else {
        structured.push(review);
      }
    }

    return { structured, chaos };
  }

  computeSlopScore(reviews: Review[]): SlopScore {
    if (reviews.length === 0) {
      return { score: 0, threshold: this.slopThreshold, passed: true };
    }

    const concordance = this.computeConcordance(reviews);
    // Slop = inverse of concordance, weighted by average confidence
    const avgConfidence = reviews.reduce((sum, r) => sum + r.verdict.confidence, 0) / reviews.length;
    const score = (1 - concordance) * avgConfidence;
    const passed = score <= this.slopThreshold;

    return { score, threshold: this.slopThreshold, passed };
  }

  computeConcordance(reviews: Review[]): number {
    if (reviews.length <= 1) {
      return 1.0;
    }

    // Count verdict occurrences
    const verdictCounts = new Map<string, number>();
    for (const review of reviews) {
      const v = review.verdict.verdict;
      verdictCounts.set(v, (verdictCounts.get(v) ?? 0) + 1);
    }

    // Concordance = majority faction size / total reviews
    let maxCount = 0;
    for (const count of verdictCounts.values()) {
      if (count > maxCount) {
        maxCount = count;
      }
    }

    return maxCount / reviews.length;
  }

  needsEscalation(conflicts: Conflict[]): { toRza: Conflict[]; toUser: Conflict[] } {
    const toRza: Conflict[] = [];
    const toUser: Conflict[] = [];

    for (const conflict of conflicts) {
      if (conflict.severity === 'unresolvable') {
        toUser.push(conflict);
      } else if (conflict.severity === 'high') {
        toRza.push(conflict);
      }
    }

    return { toRza, toUser };
  }

  private classifyConflictSeverity(
    a: Verdict,
    b: Verdict,
  ): 'low' | 'medium' | 'high' | 'unresolvable' {
    const verdicts = [a.verdict, b.verdict].sort();

    // pass vs fail with high confidence = unresolvable
    if (verdicts[0] === 'fail' && verdicts[1] === 'pass') {
      const minConfidence = Math.min(a.confidence, b.confidence);
      if (minConfidence >= 0.8) {
        return 'unresolvable';
      }
      return 'high';
    }

    // pass vs conditional_pass or fail vs conditional_pass = medium
    if (verdicts.includes('conditional_pass')) {
      return 'medium';
    }

    // inconclusive involved = low
    if (verdicts.includes('inconclusive')) {
      return 'low';
    }

    return 'medium';
  }

  private findingsSeverityConflict(a: string, b: string): boolean {
    const highSeverities = new Set(['critical', 'high']);
    const lowSeverities = new Set(['low', 'info']);
    return (
      (highSeverities.has(a) && lowSeverities.has(b)) ||
      (highSeverities.has(b) && lowSeverities.has(a))
    );
  }
}
