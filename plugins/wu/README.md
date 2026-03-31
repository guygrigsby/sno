# wu

Enterprise multi-agent orchestration for Claude Code. Zero-slop development with Wu-Tang Clan personas, cipher round cross-verification, compliance gates, and cloud-first agent dispatch.

## Install

```
/plugin marketplace add guygrigsby/claude-plugins
/plugin install wu@guygrigsby-plugins
```

## The Loop

```
new -> learn -> plan -> build -> check -> ship
```

The check phase expands into sub-phases: risk-analysis, license-check, copyright-check, performance-tradeoff, and cipher rounds.

| Command | What it does |
|---------|-------------|
| `/wu:new` | Initialize a cycle. Creates `.wu/` state, branch, and config. |
| `/wu:learn` | Research phase. Parallel agents investigate the domain, then cipher rounds cross-verify. Produces a spec. |
| `/wu:plan` | Break the spec into a task graph with dependency DAG and wave scheduling. |
| `/wu:build` | Execute plan in parallel waves with cloud agent dispatch. |
| `/wu:check` | Full verification -- cipher rounds + 4 compliance gates (risk, license, copyright, performance). |
| `/wu:ship` | Commit, create PR, archive cycle. |
| `/wu:go` | Quick mode -- single-agent pass for small tasks, still applies all wu principles. |
| `/wu:abort` | Abandon the current cycle. Archives state and cleans up. |
| `/wu:cipher` | Manually trigger a cipher round on any artifact. |
| `/wu:status` | Agent execution dashboard -- who's running, what's done, token usage. |
| `/wu:replay` | Re-run a phase from scratch. |
| `/wu:override` | Force past a failed gate (logged to audit trail). |
| `/wu:crew` | Show current formation -- who's assigned where. |
| `/wu:audit` | Standalone license/copyright audit. |
| `/wu:risk` | Standalone risk assessment. |
| `/wu:gate` | Evaluate a specific quality gate. |
| `/wu` | Where am I? Routes to the next step. |

## The Clan

9 agents, each with a persona that shapes their analytical lens:

| Agent | Role | Default Model |
|-------|------|---------------|
| **RZA** | Orchestrator and final arbiter | Opus |
| **GZA** | Technical architect -- system design, patterns, abstractions | Opus |
| **Inspectah Deck** | Quality auditor -- code quality, test coverage, spec adherence | Sonnet |
| **Masta Killa** | Compliance reviewer -- correctness, edge cases, error handling | Sonnet |
| **Method Man** | Integration specialist -- interop, API boundaries, contracts | Sonnet |
| **Raekwon** | Real-world usage analyst -- edge cases, user workflows, failure modes | Sonnet |
| **Ghostface Killah** | Narrative coherence -- documentation, naming, developer experience | Sonnet |
| **U-God** | Infrastructure analyst -- performance, scalability, operational concerns | Sonnet |
| **ODB** | Chaos agent -- adversarial testing, creative fault injection | Haiku |

ODB is never the sole reviewer. ODB output is always processed separately from structured reviewers.

## Cipher Rounds

Cross-verification passes where multiple agents independently review the same artifact. Results are scored on:

- **Concordance**: percentage of findings where 2+ reviewers agree
- **Slop score**: ratio of unsupported/hallucinated claims to total claims (0.0-1.0)

Conflicts are resolved by quorum, RZA tiebreaker, or user escalation.

## Compliance Gates

The check phase runs 4 sub-phases (skippable via config):

- **Risk analysis** -- technical, operational, and security risk matrix
- **License check** -- dependency license compatibility (transitive)
- **Copyright check** -- headers and attribution verification
- **Performance tradeoff** -- algorithmic complexity, allocations, caching

## Cloud-First Architecture

Wu dispatches agents via the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) for parallel remote execution with:

- Batched dispatch (configurable concurrency)
- Timeout and retry with exponential backoff
- Cost estimation and soft budget warnings
- Token tracking per agent in the audit trail

## Cross-Cycle Memory

`.wu/memory/` holds human-curated knowledge that persists across cycles. Files in this directory are loaded during the learn phase. Wu never auto-writes to memory -- only humans curate it.

## State

All workflow state lives in `.wu/` in the user's project directory:

- `state.json` -- current cycle state
- `config.json` -- cycle configuration (skip phases, model overrides, budget, slop threshold)
- `phases/` -- per-phase records
- `audit.jsonl` -- append-only agent dispatch log
- `summaries/` -- context handoff summaries between phases

## License

MIT
