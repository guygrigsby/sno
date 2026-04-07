/**
 * AgentDispatcher — batched, retrying, cost-aware agent dispatch via DispatchPort.
 */

import { createHash } from 'node:crypto';
import type {
  AgentAlias,
  AgentDefinition,
  CostEstimate,
  DispatchOptions,
  DispatchPort,
  DispatchResult,
  ModelTier,
  Verdict,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 4;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_RETRIES = 1;
const BASE_BACKOFF_MS = 1_000;

/** Rough per-agent token estimates used for cost projections. */
const TOKEN_ESTIMATES: Record<ModelTier, { tokensIn: number; tokensOut: number }> = {
  opus: { tokensIn: 15_000, tokensOut: 4_000 },
  sonnet: { tokensIn: 12_000, tokensOut: 3_500 },
  haiku: { tokensIn: 8_000, tokensOut: 2_000 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resultHash(payload: unknown): string {
  const serialized = JSON.stringify(payload ?? null);
  return createHash('sha256').update(serialized).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Race a promise against a timeout. Rejects with a `TimeoutError` message. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TimeoutError')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err); },
    );
  });
}

function buildCostEstimate(agents: AgentDefinition[]): CostEstimate {
  const modelCounts = new Map<ModelTier, number>();
  let totalIn = 0;
  let totalOut = 0;

  for (const agent of agents) {
    const est = TOKEN_ESTIMATES[agent.model];
    totalIn += est.tokensIn;
    totalOut += est.tokensOut;
    modelCounts.set(agent.model, (modelCounts.get(agent.model) ?? 0) + 1);
  }

  // Use the most expensive model present as the headline model.
  const tiers: ModelTier[] = ['opus', 'sonnet', 'haiku'];
  const headlineModel = tiers.find((t) => modelCounts.has(t)) ?? 'sonnet';

  const warning =
    totalIn + totalOut > 100_000
      ? `Estimated ${totalIn + totalOut} total tokens across ${agents.length} agents`
      : undefined;

  return {
    agents: agents.map((a) => a.alias),
    estimatedTokensIn: totalIn,
    estimatedTokensOut: totalOut,
    model: headlineModel,
    warning,
  };
}

// ---------------------------------------------------------------------------
// Verdict parsing (exported for testing)
// ---------------------------------------------------------------------------

const VALID_VERDICTS = new Set(['pass', 'fail', 'conditional_pass', 'inconclusive']);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

/**
 * Parse and validate a Verdict from an agent's text response.
 * This is a system boundary where untrusted LLM output enters typed code,
 * so we validate thoroughly.
 */
export function parseVerdict(text: string): Verdict {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  const parsed: unknown = JSON.parse(cleaned);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Agent response is not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  // Validate verdict field
  if (!VALID_VERDICTS.has(obj['verdict'] as string)) {
    throw new Error(
      `Invalid verdict value: "${String(obj['verdict'])}". ` +
      `Expected one of: ${[...VALID_VERDICTS].join(', ')}`
    );
  }

  // Validate confidence field
  if (typeof obj['confidence'] !== 'number' || obj['confidence'] < 0 || obj['confidence'] > 1) {
    throw new Error(
      `Invalid confidence value: ${String(obj['confidence'])}. Expected a number between 0 and 1.`
    );
  }

  // Validate findings field
  if (!Array.isArray(obj['findings'])) {
    throw new Error('Findings must be an array');
  }

  // Validate each finding
  for (let i = 0; i < obj['findings'].length; i++) {
    const finding = obj['findings'][i] as Record<string, unknown>;
    if (typeof finding !== 'object' || finding === null) {
      throw new Error(`Finding at index ${i} is not an object`);
    }
    if (!VALID_SEVERITIES.has(finding['severity'] as string)) {
      throw new Error(
        `Finding at index ${i} has invalid severity: "${String(finding['severity'])}". ` +
        `Expected one of: ${[...VALID_SEVERITIES].join(', ')}`
      );
    }
    if (typeof finding['description'] !== 'string') {
      throw new Error(`Finding at index ${i} is missing a string "description" field`);
    }
  }

  return parsed as Verdict;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export class AgentDispatcher {
  private readonly port: DispatchPort;

  constructor(port: DispatchPort) {
    this.port = port;
  }

  /**
   * Dispatch a set of agents against a prompt, returning collected results.
   *
   * Agents are dispatched in batches (default 4). Each agent gets up to
   * `maxRetries` retry attempts with exponential backoff before being marked
   * as failed.
   */
  async dispatch(
    agents: AgentDefinition[],
    prompt: string,
    options?: DispatchOptions,
  ): Promise<DispatchResult[]> {
    const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

    // ---- Cost gate --------------------------------------------------------
    if (options?.onCostEstimate) {
      const estimate = buildCostEstimate(agents);
      const approved = await options.onCostEstimate(estimate);
      if (!approved) {
        return agents.map((a) => ({
          agent: a.alias,
          verdict: null,
          status: 'failed' as const,
          durationMs: 0,
          tokensIn: 0,
          tokensOut: 0,
          error: 'Dispatch aborted: cost estimate rejected by user',
          dispatch_mode: this.port.mode,
        }));
      }
    }

    // ---- Batched dispatch --------------------------------------------------
    const results: DispatchResult[] = [];
    let completedCount = 0;

    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((agent) =>
          this.dispatchSingle(agent, prompt, timeoutMs, maxRetries, options).then(
            (result) => {
              completedCount++;
              options?.onProgress?.(agent.alias, completedCount, agents.length);
              return result;
            },
          ),
        ),
      );
      results.push(...batchResults);
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async dispatchSingle(
    agent: AgentDefinition,
    prompt: string,
    timeoutMs: number,
    maxRetries: number,
    options?: DispatchOptions,
  ): Promise<DispatchResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = Date.now();
      try {
        const [result] = await withTimeout(
          this.port.dispatch([agent], prompt, options),
          timeoutMs,
        );

        return {
          ...result,
          status: attempt > 0 ? 'retried' : result.status,
          durationMs: Date.now() - start,
        };
      } catch (err: unknown) {
        const elapsed = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        lastError = message;

        if (message === 'TimeoutError') {
          console.warn(`[wu] Agent ${agent.alias} timed out after ${elapsed}ms`);
          return {
            agent: agent.alias,
            verdict: null,
            status: 'timeout',
            durationMs: elapsed,
            tokensIn: 0,
            tokensOut: 0,
            error: `Timed out after ${timeoutMs}ms`,
            dispatch_mode: this.port.mode,
          };
        }

        if (attempt < maxRetries) {
          const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[wu] Agent ${agent.alias} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoff}ms: ${message}`,
          );
          await sleep(backoff);
        }
      }
    }

    console.warn(`[wu] Agent ${agent.alias} failed after ${maxRetries + 1} attempts: ${lastError}`);
    return {
      agent: agent.alias,
      verdict: null,
      status: 'failed',
      durationMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      error: lastError,
      dispatch_mode: this.port.mode,
    };
  }
}

/**
 * Compute a SHA-256 hex digest of a dispatch result for audit logging.
 */
export function computeResultHash(result: DispatchResult): string {
  return resultHash(result);
}
