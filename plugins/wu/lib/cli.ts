#!/usr/bin/env node

/**
 * wu-dispatch CLI — fan out wu agents via the Claude Agent SDK.
 *
 * Usage:
 *   npx wu-dispatch --phase learn --agents gza,ghostface,raekwon,masta-killa --prompt "Analyze ..."
 *   npx wu-dispatch --phase check --agents gza,inspectah-deck --prompt-file .wu/prompts/check.txt
 *   npx wu-dispatch --phase cipher --agents inspectah-deck,masta-killa --prompt "Review ..." --wu-dir ./project/.wu
 *
 * Outputs JSON array of DispatchResult to stdout.
 * Progress and warnings go to stderr so they don't pollute the JSON output.
 */

import { resolve, dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AgentDispatcher, computeResultHash } from './dispatch.js';
import { MessagesApiDispatchAdapter } from './messages-adapter.js';
import { AuditLog } from './audit.js';
import { loadAgentsByAlias } from './agent-loader.js';
import type { AgentAlias, AuditEntry, DispatchResult, PhaseName } from './types.js';

// ---------------------------------------------------------------------------
// Arg parsing (no external deps)
// ---------------------------------------------------------------------------

interface CliArgs {
  phase: PhaseName;
  agents: AgentAlias[];
  prompt: string;
  promptFile?: string;
  dispatchId: string;
  wuDir?: string;
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  modelOverride?: string;
}

function usage(): never {
  console.error(`
wu-dispatch — fan out wu agents via the Anthropic Messages API.

Usage:
  wu-dispatch --phase <name> --agents <alias,...> --prompt-file <path>
  wu-dispatch --phase <name> --agents <alias,...> --prompt <text>  (deprecated)

Options:
  --phase         Phase name (learn, plan, build, check, cipher, etc.)
  --agents        Comma-separated agent aliases (gza, ghostface, etc.)
  --prompt-file   Read prompt from a file (preferred)
  --prompt        Prompt text (deprecated — use --prompt-file to avoid shell escaping)
  --dispatch-id   UUID to group audit entries from a single invocation (auto-generated if omitted)
  --wu-dir        Path to .wu/ directory for audit logging (optional)
  --batch-size    Max parallel agents (default: 4)
  --timeout       Timeout per agent in ms (default: 300000)
  --max-retries   Retry count per agent (default: 1)
  --model         Override model for all agents (opus, sonnet, haiku)
  --help          Show this help
`.trim());
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let phase: string | undefined;
  let agentsStr: string | undefined;
  let prompt: string | undefined;
  let promptFile: string | undefined;
  let dispatchId: string | undefined;
  let wuDir: string | undefined;
  let batchSize: number | undefined;
  let timeoutMs: number | undefined;
  let maxRetries: number | undefined;
  let modelOverride: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case '--phase': phase = next; i++; break;
      case '--agents': agentsStr = next; i++; break;
      case '--prompt':
        console.error('[wu-dispatch] Warning: --prompt is deprecated. Use --prompt-file to avoid shell escaping issues.');
        prompt = next; i++; break;
      case '--prompt-file': promptFile = next; i++; break;
      case '--dispatch-id': dispatchId = next; i++; break;
      case '--wu-dir': wuDir = next; i++; break;
      case '--batch-size': batchSize = Number(next); i++; break;
      case '--timeout': timeoutMs = Number(next); i++; break;
      case '--max-retries': maxRetries = Number(next); i++; break;
      case '--model': modelOverride = next; i++; break;
      case '--help': case '-h': usage();
      default:
        console.error(`Unknown argument: ${arg}`);
        usage();
    }
  }

  if (!phase) { console.error('--phase is required'); usage(); }
  if (!agentsStr) { console.error('--agents is required'); usage(); }
  if (!prompt && !promptFile) { console.error('--prompt or --prompt-file is required'); usage(); }

  const agents = agentsStr.split(',').map((a) => a.trim()) as AgentAlias[];

  return {
    phase: phase as PhaseName,
    agents,
    prompt: prompt ?? '',
    promptFile,
    dispatchId: dispatchId ?? randomUUID(),
    wuDir,
    batchSize,
    timeoutMs,
    maxRetries,
    modelOverride,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Read prompt from file if needed
  if (!args.prompt && args.promptFile) {
    args.prompt = await readFile(resolve(args.promptFile), 'utf-8');
  }
  if (!args.prompt) {
    console.error('[wu-dispatch] Error: no prompt provided');
    process.exit(1);
  }

  // Locate agents/ directory relative to this file
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const agentsDir = join(thisDir, '..', 'agents');

  // Load requested agents
  const agentDefs = await loadAgentsByAlias(resolve(agentsDir), args.agents);

  // Apply model override if specified
  if (args.modelOverride) {
    for (const def of agentDefs) {
      def.model = args.modelOverride as typeof def.model;
    }
  }

  // Create dispatch adapter and dispatcher
  const adapter = new MessagesApiDispatchAdapter({
    projectRoot: process.cwd(),
  });
  const dispatcher = new AgentDispatcher(adapter);

  // Dispatch with progress to stderr
  const startTime = Date.now();
  console.error(`[wu-dispatch] Phase: ${args.phase}`);
  console.error(`[wu-dispatch] Dispatch ID: ${args.dispatchId}`);
  console.error(`[wu-dispatch] Dispatching ${agentDefs.length} agents: ${agentDefs.map((a) => a.alias).join(', ')}`);

  const results = await dispatcher.dispatch(agentDefs, args.prompt, {
    batchSize: args.batchSize,
    timeoutMs: args.timeoutMs,
    maxRetries: args.maxRetries,
    onProgress: (agent, index, total) => {
      console.error(`[wu-dispatch] ${agent} completed (${index}/${total})`);
    },
  });

  const totalDuration = Date.now() - startTime;
  console.error(`[wu-dispatch] All agents completed in ${totalDuration}ms`);

  // Log to audit trail if wu-dir is provided
  if (args.wuDir) {
    const auditLog = new AuditLog(resolve(args.wuDir));
    for (const result of results) {
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        dispatch_id: args.dispatchId,
        dispatch_mode: result.dispatch_mode,
        agent: result.agent,
        phase: args.phase,
        target: 'cli-dispatch',
        duration_ms: result.durationMs,
        status: result.status === 'completed' || result.status === 'retried' ? 'completed' : result.status,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        result_hash: computeResultHash(result),
      };
      await auditLog.append(entry);
    }
    console.error(`[wu-dispatch] Audit entries written to ${args.wuDir}/audit.jsonl`);
  }

  // Summarize to stderr
  const passed = results.filter((r) => r.verdict?.verdict === 'pass' || r.verdict?.verdict === 'conditional_pass').length;
  const failed = results.filter((r) => r.status === 'failed' || r.status === 'timeout').length;
  console.error(`[wu-dispatch] Results: ${passed} passed, ${failed} failed, ${results.length - passed - failed} other`);

  // Output results as JSON to stdout
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err: unknown) => {
  console.error(`[wu-dispatch] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
