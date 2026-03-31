/**
 * Wu domain types — agent identity, verdicts, cipher rounds, and dispatch contracts.
 */

// ---------------------------------------------------------------------------
// Agent identity
// ---------------------------------------------------------------------------

export type AgentAlias =
  | 'rza'
  | 'gza'
  | 'method-man'
  | 'raekwon'
  | 'ghostface'
  | 'inspectah-deck'
  | 'u-god'
  | 'masta-killa'
  | 'odb';

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export type PhaseName =
  | 'learn'
  | 'plan'
  | 'risk-analysis'
  | 'license-check'
  | 'copyright-check'
  | 'performance-tradeoff'
  | 'build'
  | 'check'
  | 'cipher'
  | 'ship';

// ---------------------------------------------------------------------------
// Verdict (common schema all agents produce)
// ---------------------------------------------------------------------------

export interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  location: string;
  recommendation: string;
}

export interface Verdict {
  verdict: 'pass' | 'fail' | 'conditional_pass' | 'inconclusive';
  confidence: number;
  findings: Finding[];
}

// ---------------------------------------------------------------------------
// Slop scoring
// ---------------------------------------------------------------------------

export interface SlopScore {
  score: number;
  threshold: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Cipher
// ---------------------------------------------------------------------------

export interface CipherRound {
  phase: PhaseName;
  round: number;
  reviews: Review[];
  conflicts: Conflict[];
  concordance: number;
  slopScore: SlopScore;
}

export interface Review {
  agent: AgentAlias;
  verdict: Verdict;
  timestamp: string;
}

export interface Conflict {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'unresolvable';
  description: string;
  parties: ConflictParty[];
  resolution?: Resolution;
}

export interface ConflictParty {
  agent: AgentAlias;
  position: string;
  confidence: number;
}

export interface Resolution {
  type: 'agent_consensus' | 'user_decision' | 'escalation' | 'automated_tiebreak';
  decidedBy?: string;
  decision: string;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  alias: AgentAlias;
  displayName: string;
  role: string;
  persona: string;
  model: ModelTier;
  tools: string[];
}

export interface DispatchOptions {
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  onProgress?: (agent: AgentAlias, index: number, total: number) => void;
  onCostEstimate?: (estimate: CostEstimate) => Promise<boolean>;
}

export interface DispatchResult {
  agent: AgentAlias;
  verdict: Verdict | null;
  status: 'completed' | 'failed' | 'timeout' | 'retried';
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  error?: string;
  fallbackUsed: boolean;
}

export interface CostEstimate {
  agents: AgentAlias[];
  estimatedTokensIn: number;
  estimatedTokensOut: number;
  model: ModelTier;
  warning?: string;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditEntry {
  timestamp: string;
  agent: string;
  phase: string;
  target: string;
  duration_ms: number;
  status: 'dispatched' | 'completed' | 'failed' | 'timeout' | 'retried';
  tokens_in: number;
  tokens_out: number;
  result_hash: string;
}
