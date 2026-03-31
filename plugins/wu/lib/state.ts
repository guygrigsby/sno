import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { PhaseName } from './types.js';

export interface CycleConfig {
  skip_phases?: PhaseName[];
  model_overrides?: Partial<Record<PhaseName, 'opus' | 'sonnet' | 'haiku'>>;
  budget?: {
    warning_threshold_tokens?: number;
    total_tokens_used?: number;
  };
  concurrency?: {
    max_parallel_agents?: number;
  };
  slop_threshold?: number;
  cipher_rounds?: Partial<Record<PhaseName, number>>;
}

export interface CycleState {
  cycle_slug: string;
  created_at: string;
  updated_at: string;
  description: string;
  current_phase: PhaseName;
  status: 'active' | 'paused' | 'completed' | 'aborted';
  config: CycleConfig;
}

export interface PhaseRecord {
  phase_name: PhaseName;
  ordinal: number;
  status: 'pending' | 'active' | 'passed' | 'failed' | 'skipped';
  started_at: string | null;
  completed_at: string | null;
  verdict: Record<string, unknown> | null;
  model_override: 'opus' | 'sonnet' | 'haiku' | null;
}

const PHASE_ORDER: readonly PhaseName[] = [
  'learn', 'plan', 'risk-analysis', 'license-check', 'copyright-check',
  'performance-tradeoff', 'build', 'check', 'cipher', 'ship',
] as const;

export class StateManager {
  private readonly wuDir: string;
  private readonly statePath: string;
  private readonly configPath: string;
  private readonly phasesDir: string;

  constructor(wuDir: string) {
    this.wuDir = wuDir;
    this.statePath = path.join(wuDir, 'state.json');
    this.configPath = path.join(wuDir, 'config.json');
    this.phasesDir = path.join(wuDir, 'phases');
  }

  async init(cycleSlug: string, description: string, config: CycleConfig): Promise<void> {
    // Create directory structure
    await fs.mkdir(this.wuDir, { recursive: true });
    await fs.mkdir(path.join(this.wuDir, 'memory'), { recursive: true });
    await fs.mkdir(path.join(this.wuDir, 'audit'), { recursive: true });
    await fs.mkdir(this.phasesDir, { recursive: true });

    // Create phase subdirectories
    for (const phase of PHASE_ORDER) {
      await fs.mkdir(path.join(this.phasesDir, phase), { recursive: true });
    }

    const now = new Date().toISOString();
    const state: CycleState = {
      cycle_slug: cycleSlug,
      created_at: now,
      updated_at: now,
      description,
      current_phase: 'learn',
      status: 'active',
      config,
    };

    await this.atomicWrite(this.statePath, state);
    await this.atomicWrite(this.configPath, config);

    // Initialize phase records
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      const phaseName = PHASE_ORDER[i];
      const record: PhaseRecord = {
        phase_name: phaseName,
        ordinal: i,
        status: 'pending',
        started_at: null,
        completed_at: null,
        verdict: null,
        model_override: config.model_overrides?.[phaseName] ?? null,
      };
      await this.writePhase(phaseName, record);
    }
  }

  async readState(): Promise<CycleState> {
    const raw = await fs.readFile(this.statePath, 'utf-8');
    try {
      return JSON.parse(raw) as CycleState;
    } catch {
      // Attempt recovery: trim trailing garbage after last valid brace
      const lastBrace = raw.lastIndexOf('}');
      if (lastBrace !== -1) {
        const trimmed = raw.slice(0, lastBrace + 1);
        try {
          return JSON.parse(trimmed) as CycleState;
        } catch {
          // Fall through to error
        }
      }
      throw new Error(
        `Corrupted state file at ${this.statePath}. ` +
        `Content begins with: "${raw.slice(0, 80)}...". ` +
        `Recovery failed. Delete .wu/ and re-initialize.`
      );
    }
  }

  async writeState(state: CycleState): Promise<void> {
    state.updated_at = new Date().toISOString();
    await this.atomicWrite(this.statePath, state);
  }

  async readConfig(): Promise<CycleConfig> {
    const raw = await fs.readFile(this.configPath, 'utf-8');
    return JSON.parse(raw) as CycleConfig;
  }

  async readPhase(phase: PhaseName): Promise<PhaseRecord | null> {
    const phasePath = path.join(this.phasesDir, phase, 'phase.json');
    try {
      const raw = await fs.readFile(phasePath, 'utf-8');
      return JSON.parse(raw) as PhaseRecord;
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async writePhase(phase: PhaseName, record: PhaseRecord): Promise<void> {
    const phaseDir = path.join(this.phasesDir, phase);
    await fs.mkdir(phaseDir, { recursive: true });
    const phasePath = path.join(phaseDir, 'phase.json');
    await this.atomicWrite(phasePath, record);
  }

  async advancePhase(to: PhaseName): Promise<void> {
    const state = await this.readState();
    state.current_phase = to;
    await this.writeState(state);
  }

  async isCorrupted(): Promise<boolean> {
    try {
      const stateRaw = await fs.readFile(this.statePath, 'utf-8');
      JSON.parse(stateRaw);
    } catch {
      return true;
    }
    try {
      const configRaw = await fs.readFile(this.configPath, 'utf-8');
      JSON.parse(configRaw);
    } catch {
      return true;
    }
    return false;
  }

  private async atomicWrite(filePath: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2) + '\n';
    const tmpPath = filePath + '.tmp.' + crypto.randomBytes(6).toString('hex');
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  }
}
