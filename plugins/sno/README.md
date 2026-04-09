```
            *
           /|\
          / | \
    *--  /  |  \  --*
     \   ▐▛███▜▌  /
      \ ▝▜█████▛▘/
   ----   ▘▘ ▝▝  ----
      /          \
     /            \
    *--  \  |  /  --*
          \ | /
           \|/
            *
```
# sno

Named for [Snow Tha Product](https://www.snowthaproduct.com/) who just handles business.

A lightweight Claude Code plugin for spec-driven development. No bloat, no ceremony -- just a loop.

## Install

```
/plugin marketplace add guygrigsby/claude-plugins
/plugin install sno@guygrigsby-plugins
```

## The Loop

```
new -> learn -> plan -> build -> check -> ship
```

| Command | What it does |
|---------|-------------|
| `/sno:new` | Start a new cycle. Pulls latest, creates a branch, archives previous cycle. |
| `/sno:learn` | Understand the problem. 7 parallel Opus agents research domain, data model, codebase, security, and assumptions. Structured intake template, tiered interview (blocking questions first, refinement with opt-out). Produces a spec. |
| `/sno:plan` | Discover available MCP tools, then break the spec into structured tasks with verify/done criteria per task. Parallel agents review for antipatterns, UX, and coverage gaps. |
| `/sno:build` | Execute tasks in parallel waves with per-wave commits. MCP tools assigned to tasks are available to build agents. |
| `/sno:check` | Verify work against the spec. Runs PR review, security audit, and test coverage agents alongside acceptance criteria checks. Auto-diagnoses failures. |
| `/sno:ship` | Commit remaining changes, create a PR if needed, and close out the cycle |
| `/sno:go` | Quick mode -- skip the ceremony for small tasks |
| `/sno:todo` | Parking lot for later |
| `/sno` | Where am I? Routes to the next step. |

## Agents

### Learn Phase

The learn phase spawns parallel Opus agents to research before writing a single line of spec:

| Agent | Role |
|-------|------|
| `prior-art-researcher` | How similar problems are solved, domain-specific patterns, architectural approaches, gotchas |
| `domain-researcher` | DDD analysis -- bounded contexts, aggregates, events, ubiquitous language |
| `data-modeler` | Entity/relationship modeling, 5NF normalization |
| `codebase-scout` | Existing code patterns, conventions, dependencies, risks |
| `service-layer-analyst` | API boundaries, orchestration, transaction scoping, cross-cutting concerns |
| `assumption-miner` | Reads user's description, lists unstated assumptions for correction ("I'm assuming X because Y -- correct?") |
| `security-researcher` | Identifies security risks, attack vectors, OWASP concerns, bucket/DB permissions, supply chain risks, compliance |
| `requirements-interviewer` | Synthesizes open questions into a tiered interview -- blocking questions first, then refinement with opt-out (runs after the others complete) |

### Plan Phase

**Step 1: MCP Discovery** -- discovers available MCP servers/tools, writes recommendations to `.sno/research/available-tools.md`

**Wave 1 (parallel):**

| Agent | Role |
|-------|------|
| `planner` | Task decomposition, dependency graph, wave planning, coverage matrix, MCP tool assignment |
| `ux-reviewer` | Interaction flows, error UX, CLI/TUI/GUI ergonomics, WCAG 2.1 AA accessibility, colorblind safety |
| `accessibility-auditor` | WCAG 2.1 AA compliance, keyboard navigation, screen reader support, color contrast, motion sensitivity |
| `antipattern-detector` | Tech stack gotchas, domain antipatterns, security pitfalls, dependency risks |

**Wave 2 (after wave 1):**

| Agent | Role |
|-------|------|
| `critical-reviewer` | Adversarial review of the assembled plan -- coverage gaps, dependency correctness, missed risks, security coverage, scope drift |

### Check Phase

| Agent | Role |
|-------|------|
| `pr-reviewer` | Full PR-style code review of the diff against the base branch. Reviews correctness, security, performance, consistency, maintainability, and test coverage. Returns a structured verdict (APPROVE / REQUEST CHANGES / COMMENT). Critical issues block shipping. |
| `security-auditor` | Reviews code diff for security vulnerabilities. Verifies threat mitigations from learn phase are implemented. Checks security requirements coverage. Returns verdict (PASS / FAIL). Critical security issues block shipping. |
| `accessibility-auditor` | Audits code diff for WCAG 2.1 AA compliance (color contrast, keyboard navigation, screen reader support, semantic HTML, motion sensitivity). Cross-references plan-phase recommendations. Returns verdict (PASS / FAIL). Critical issues block shipping. |
| `test-coverage` | Identifies new/modified code paths in the diff and verifies each has corresponding test coverage. Gaps block shipping. |
| `codex review` (conditional) | If the codex plugin is installed, runs an additional code review pass via `/codex:rescue`. Skipped silently if not available. |
| `readme-check` | Compares `README.md` against the spec and what was built. Flags outdated commands, features, or behaviors. Identifies new work the README should reflect. Changes are applied before shipping. |

## Design Principles

- **Smallest diff that works.** Make the absolute minimum change to accomplish the exact goal. No drive-by refactors, no adjacent cleanup, no "while we're in here" improvements. If it's not in the spec, it's not in the diff.
- **Principle of Least Astonishment (PoLA).** Code, APIs, naming, behavior, and structure should do what a reasonable person would expect. No surprises. If something looks like X, it should behave like X.
- **DDD always.** Every spec identifies bounded contexts, aggregates, factories, and repositories.
- **5NF target.** Data models normalize fully. Denormalization requires justification.
- **No assumptions.** Ambiguity becomes an open question, not a guess.
- **Extensibility first.** Storage, network, parsing, alerting, syncing -- all abstracted as ports.
- **One question at a time.** Don't batch questions. Let each answer inform the next.
- **Research before decisions.** Parallel agents investigate before a single line of spec. Cheap thinking now, expensive rework avoided later.
- **Coverage, not trust.** Every phase cross-checks the previous one. Spec vs research, plan vs acceptance criteria, check vs spec.
- **Flag it, don't fix it.** Agents report scope surprises -- they don't silently add work. The user decides what's in scope.
- **Parallelize by default.** Structure work so independent things run simultaneously. Interfaces first to unblock everything else.
- **Domain names, not generic names.** No `model`, `types`, `utils`, `helpers`. Name things after what they are in the domain.
- **No triggers or stored procedures.** Avoid database triggers and stored procedures unless explicitly justified. They hide logic, complicate debugging, and create invisible coupling.
- **Tests are not optional.** Every code change ships with tests. Opting out requires explicit user approval.
- **Comments are part of the code.** Every public function, type, and interface gets a docstring. Non-obvious logic gets an inline comment explaining *why*, not *what*.
- **Errors compound downstream.** A mistake caught in the spec costs 1x to fix. The same mistake caught in the plan costs 5x. Caught in code, 25x. This is why learn and plan are thorough.
- **Minimize function parameters.** Aim for 3-4 parameters max. Group related parameters into a struct or config type when more are needed.

## License

MIT
