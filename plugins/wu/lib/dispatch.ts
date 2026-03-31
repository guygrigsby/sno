/**
 * AgentDispatcher — batched, retrying, cost-aware agent dispatch via the Claude Agent SDK.
 */

import { createHash } from 'node:crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  AgentAlias,
  AgentDefinition,
  CostEstimate,
  DispatchOptions,
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
// Dispatcher
// ---------------------------------------------------------------------------

export class AgentDispatcher {
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      throw new Error(
        'AgentDispatcher requires an API key. Pass one to the constructor or set ANTHROPIC_API_KEY.',
      );
    }
    this.apiKey = key;
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
          fallbackUsed: false,
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
          this.dispatchSingle(agent, prompt, timeoutMs, maxRetries).then(
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
  ): Promise<DispatchResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = Date.now();
      try {
        const response = await withTimeout(
          this.invokeAgent(agent, prompt),
          timeoutMs,
        );

        return {
          agent: agent.alias,
          verdict: response.verdict,
          status: attempt > 0 ? 'retried' : 'completed',
          durationMs: Date.now() - start,
          tokensIn: response.tokensIn,
          tokensOut: response.tokensOut,
          fallbackUsed: false,
        };
      } catch (err: unknown) {
        const elapsed = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        lastError = message;

        if (message === 'TimeoutError') {
          // Timeouts are not retried — the agent is too slow.
          console.warn(`[wu] Agent ${agent.alias} timed out after ${elapsed}ms`);
          return {
            agent: agent.alias,
            verdict: null,
            status: 'timeout',
            durationMs: elapsed,
            tokensIn: 0,
            tokensOut: 0,
            error: `Timed out after ${timeoutMs}ms`,
            fallbackUsed: false,
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

    // All retries exhausted.
    console.warn(`[wu] Agent ${agent.alias} failed after ${maxRetries + 1} attempts: ${lastError}`);
    return {
      agent: agent.alias,
      verdict: null,
      status: 'failed',
      durationMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      error: lastError,
      fallbackUsed: false,
    };
  }

  /**
   * Call the Agent SDK's `query()` for a single agent and parse the verdict.
   *
   * `query()` returns an async generator of messages. We consume all messages
   * and extract the final text result.
   */
  private async invokeAgent(
    agent: AgentDefinition,
    prompt: string,
  ): Promise<{ verdict: Verdict; tokensIn: number; tokensOut: number }> {
    const systemPrompt = [
      `You are ${agent.displayName} (${agent.alias}).`,
      `Role: ${agent.role}`,
      `Persona: ${agent.persona}`,
      '',
      'Respond with a JSON object matching the Verdict schema:',
      '{ "verdict": "pass"|"fail"|"conditional_pass"|"inconclusive", "confidence": 0-1, "findings": [{ "severity": "critical"|"high"|"medium"|"low"|"info", "description": "...", "location": "...", "recommendation": "..." }] }',
      '',
      'Respond ONLY with the JSON object. No markdown, no explanation.',
    ].join('\n');

    let finalText = '';
    let tokensIn = 0;
    let tokensOut = 0;

    for await (const message of query({
      prompt,
      options: {
        systemPrompt,
        allowedTools: agent.tools,
        model: agent.model,
      },
    })) {
      // Collect text from messages that have it
      const msg = message as Record<string, unknown>;
      if (typeof msg['result'] === 'string') {
        finalText = msg['result'];
      } else if (typeof msg['text'] === 'string') {
        finalText = msg['text'];
      }
      // Collect usage if present
      if (msg['usage'] && typeof msg['usage'] === 'object') {
        const usage = msg['usage'] as Record<string, number>;
        tokensIn = usage['input_tokens'] ?? tokensIn;
        tokensOut = usage['output_tokens'] ?? tokensOut;
      }
    }

    if (!finalText) {
      throw new Error(`Agent ${agent.alias} returned no text output`);
    }

    const verdict = this.parseVerdict(finalText);
    return { verdict, tokensIn, tokensOut };
  }

  /**
   * Parse a Verdict from the agent's text response. Throws on malformed output.
   */
  private parseVerdict(text: string): Verdict {
    // Strip markdown fences if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    const parsed: unknown = JSON.parse(cleaned);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('verdict' in parsed) ||
      !('confidence' in parsed) ||
      !('findings' in parsed)
    ) {
      throw new Error('Agent response does not match Verdict schema');
    }

    // Trust the structure after basic shape check — full validation is the
    // caller's responsibility (or a future Zod layer).
    return parsed as Verdict;
  }
}

/**
 * Compute a SHA-256 hex digest of a dispatch result for audit logging.
 */
export function computeResultHash(result: DispatchResult): string {
  return resultHash(result);
}
