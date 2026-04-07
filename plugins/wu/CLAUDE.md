# wu

```
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⡀⠀⠀⠀
⠀⢀⣶⣶⣤⣤⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⣿⣿⣿⣿⣿⡄⠀⠀
⠀⣼⣿⣿⣿⣿⣿⣿⣿⣷⣶⡤⠀⠀⠀⠀⢤⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀
⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⢀⣀⠀⠙⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀
⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀⠰⣾⣿⣿⣷⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄⣿⣿⣿⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿
⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⠛⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇
⠀⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡁⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⠏⠀
⠀⠀⠀⠙⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⠀⠀⠀⣼⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⠀
⠀⠀⠀⠀⠀⠈⠙⠻⠿⣿⣿⣿⣿⣿⣿⡄⠀⠀⣿⣿⣿⣿⣿⣿⠿⠋⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠉⠉⠀⣸⣿⣿⣿⠿⠛⠁⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠟⠋⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
```

Zero-slop development with persona-driven analysis and remote LLM inference.

## The Loop

`learn -> plan -> risk-analysis -> license-check -> copyright-check -> performance-tradeoff -> build -> check -> cipher -> ship`

## Design Principles

### Inherited from sno

- **DDD always.** Every spec identifies bounded contexts and aggregates.
- **5NF target.** Data models normalize fully; denormalization requires justification.
- **No assumptions.** If the user didn't say it, it's an open question. Ask, don't guess.
- **Extensibility first.** Storage, network, parsing, alerting, syncing -- all abstracted as ports.
- **One question at a time.** Don't batch questions. Let each answer inform the next.
- **Research before decisions.** Parallel agents investigate before a single line of spec.
- **Coverage, not trust.** Every phase cross-checks the previous one.
- **Flag it, don't fix it.** Agents report scope surprises -- they don't silently add work.
- **Parallelize by default.** Structure work so independent things run simultaneously.
- **Domain names, not generic names.** No `model`, `types`, `utils`, `helpers`. Name things after what they are in the domain.
- **Tests are not optional.** Every code change ships with tests. No exceptions without explicit opt-out.
- **Errors compound downstream.** A mistake caught in the spec costs 1x. In the plan, 5x. In code, 25x.

### Wu-specific

- **Zero-slop tolerance.** Multi-pass cross-verification via cipher rounds. Every phase output is re-examined by independent agents to catch hallucinations, unsupported claims, and drift.
- **Persona-driven analysis.** Wu-Tang agents with decision-affecting personas. Each agent has a distinct analytical lens that shapes how it evaluates work.
- **Remote LLM inference (MANDATORY).** Agent dispatch goes through `npx wu-dispatch` which calls the Anthropic Messages API directly. LLM inference runs on Anthropic infrastructure. Tool execution (file reads/writes for build agents) runs locally. No local Agent tool fallback — if the CLI fails, it fails.
- **Context handoff between every phase.** Each phase produces a summary.md, clears context, and the next phase reloads from that summary. No implicit state leakage.
- **Append-only audit trail.** Every agent dispatch, result, and token cost is recorded in .wu/audit.jsonl. Immutable history for debugging and cost analysis.

## Project State

All workflow state lives in `.wu/` in the user's project directory:

- `state.json` -- current cycle state (see schemas/state.json)
- `config.json` -- cycle configuration (see schemas/config.json)
- `phases/` -- per-phase records (see schemas/phase.json)
- `audit.jsonl` -- append-only agent dispatch log (see schemas/audit-entry.json)
- `summaries/` -- context handoff summaries per phase (see schemas/summary-template.md)

## Plugin Structure

```
plugins/wu/
├── .claude-plugin/plugin.json
├── schemas/
│   ├── state.json
│   ├── config.json
│   ├── phase.json
│   ├── audit-entry.json
│   └── summary-template.md
├── package.json
├── tsconfig.json
└── CLAUDE.md
```
