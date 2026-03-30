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
| `/sno:learn` | Understand the problem. Parallel Opus agents research the domain, data model, and codebase. Then asks you targeted questions. Produces a spec. |
| `/sno:plan` | Break the spec into structured tasks with verify/done criteria per task. Parallel agents review for antipatterns, UX, and coverage gaps. |
| `/sno:build` | Execute tasks in parallel waves with per-wave commits |
| `/sno:check` | Verify work against the spec. Runs a PR-style code review agent alongside acceptance criteria checks. Auto-diagnoses failures. |
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
| `requirements-interviewer` | Synthesizes open questions from all agents into a focused interview (runs after the others complete) |

### Plan Phase

**Wave 1 (parallel):**

| Agent | Role |
|-------|------|
| `planner` | Task decomposition, dependency graph, wave planning, coverage matrix |
| `ux-reviewer` | Interaction flows, error UX, CLI/TUI/GUI ergonomics, accessibility |
| `antipattern-detector` | Tech stack gotchas, domain antipatterns, security pitfalls, dependency risks |

**Wave 2 (after wave 1):**

| Agent | Role |
|-------|------|
| `critical-reviewer` | Adversarial review of the assembled plan -- coverage gaps, dependency correctness, missed risks, scope drift |

### Check Phase

| Agent | Role |
|-------|------|
| `pr-reviewer` | Full PR-style code review of the diff against the base branch. Reviews correctness, security, performance, consistency, maintainability, and test coverage. Returns a structured verdict (APPROVE / REQUEST CHANGES / COMMENT). Critical issues block shipping. |

## Design Principles

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
- **Errors compound downstream.** A mistake caught in the spec costs 1x to fix. The same mistake caught in the plan costs 5x. Caught in code, 25x. This is why learn and plan are thorough.

## License

MIT
