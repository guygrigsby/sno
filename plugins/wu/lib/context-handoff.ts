import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PhaseName } from './types.js';

export class ContextHandoff {
  private readonly maxChars: number;

  constructor(maxChars: number = 2000) {
    this.maxChars = maxChars;
  }

  async produceSummary(phase: PhaseName, content: string, outputDir: string): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    const summary = this.formatSummary(phase, content);
    const truncated = this.truncateToLimit(summary);
    const outputPath = path.join(outputDir, 'summary.md');
    await fs.writeFile(outputPath, truncated, 'utf-8');
    return truncated;
  }

  truncateToLimit(content: string): string {
    if (content.length <= this.maxChars) {
      return content;
    }

    // Cut to maxChars, then find the last sentence boundary
    const cut = content.slice(0, this.maxChars);
    const lastSentenceEnd = Math.max(
      cut.lastIndexOf('. '),
      cut.lastIndexOf('.\n'),
      cut.lastIndexOf('? '),
      cut.lastIndexOf('?\n'),
      cut.lastIndexOf('! '),
      cut.lastIndexOf('!\n'),
    );

    if (lastSentenceEnd > 0) {
      // Include the punctuation character
      return cut.slice(0, lastSentenceEnd + 1);
    }

    // No sentence boundary found; fall back to last newline
    const lastNewline = cut.lastIndexOf('\n');
    if (lastNewline > 0) {
      return cut.slice(0, lastNewline);
    }

    // Absolute fallback: hard cut
    return cut;
  }

  private formatSummary(phase: PhaseName, content: string): string {
    // Parse structured sections from content if present, otherwise wrap raw content
    const sections = this.extractSections(content);

    const lines: string[] = [
      `# ${phase} Summary`,
      '',
      '## Verdict',
      sections.verdict || 'No verdict recorded.',
      '',
      '## Key Findings',
      sections.findings || '- No findings recorded.',
      '',
      '## Decisions Made',
      sections.decisions || '- No decisions recorded.',
      '',
      '## Open Questions',
      sections.openQuestions || '- No open questions.',
      '',
      '## Artifacts Produced',
      sections.artifacts || '- No artifacts produced.',
      '',
      '## Next Phase Input',
      sections.nextPhaseContext || 'No specific context for next phase.',
      '',
    ];

    return lines.join('\n');
  }

  private extractSections(content: string): {
    verdict: string;
    findings: string;
    decisions: string;
    openQuestions: string;
    artifacts: string;
    nextPhaseContext: string;
  } {
    const sectionMap: Record<string, string> = {};
    const sectionPattern = /^##\s+(.+)$/gm;
    const matches: Array<{ key: string; start: number }> = [];

    let match: RegExpExecArray | null;
    while ((match = sectionPattern.exec(content)) !== null) {
      matches.push({ key: match[1].trim().toLowerCase(), start: match.index + match[0].length });
    }

    for (let i = 0; i < matches.length; i++) {
      const end = i + 1 < matches.length ? matches[i + 1].start - matches[i + 1].key.length - 4 : content.length;
      sectionMap[matches[i].key] = content.slice(matches[i].start, end).trim();
    }

    // If no sections found, treat entire content as findings
    if (matches.length === 0) {
      return {
        verdict: '',
        findings: content.trim(),
        decisions: '',
        openQuestions: '',
        artifacts: '',
        nextPhaseContext: '',
      };
    }

    return {
      verdict: sectionMap['verdict'] || '',
      findings: sectionMap['key findings'] || sectionMap['findings'] || '',
      decisions: sectionMap['decisions made'] || sectionMap['decisions'] || '',
      openQuestions: sectionMap['open questions'] || '',
      artifacts: sectionMap['artifacts produced'] || sectionMap['artifacts'] || '',
      nextPhaseContext: sectionMap['next phase input'] || sectionMap['next phase context'] || '',
    };
  }
}
