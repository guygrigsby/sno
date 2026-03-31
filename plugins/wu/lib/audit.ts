import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AuditEntry, PhaseName } from './types.js';

export class AuditLog {
  private readonly auditFilePath: string;

  constructor(auditDir: string) {
    this.auditFilePath = path.join(auditDir, 'audit.jsonl');
  }

  async append(entry: AuditEntry): Promise<void> {
    await fs.mkdir(path.dirname(this.auditFilePath), { recursive: true });
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.auditFilePath, line, 'utf-8');
  }

  async readAll(): Promise<AuditEntry[]> {
    const raw = await this.readRaw();
    return this.parseLines(raw);
  }

  async readByPhase(phase: PhaseName): Promise<AuditEntry[]> {
    const entries = await this.readAll();
    return entries.filter((e) => e.phase === phase);
  }

  async readByAgent(agent: string): Promise<AuditEntry[]> {
    const entries = await this.readAll();
    return entries.filter((e) => e.agent === agent);
  }

  async totalTokens(): Promise<{ in: number; out: number }> {
    const entries = await this.readAll();
    let tokensIn = 0;
    let tokensOut = 0;
    for (const entry of entries) {
      tokensIn += entry.tokens_in;
      tokensOut += entry.tokens_out;
    }
    return { in: tokensIn, out: tokensOut };
  }

  private async readRaw(): Promise<string> {
    try {
      return await fs.readFile(this.auditFilePath, 'utf-8');
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      }
      throw err;
    }
  }

  private parseLines(raw: string): AuditEntry[] {
    if (raw.trim() === '') {
      return [];
    }
    return raw
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as AuditEntry);
  }
}
