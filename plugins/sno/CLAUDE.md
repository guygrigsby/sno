# sno

A lightweight Claude Code plugin for spec-driven development.

## The Loop

`learn -> plan -> build -> check -> ship`

- `/sno` -- routes to the next step
- `/sno:new` -- start a new cycle (pulls latest, creates branch, archives previous cycle if done)
- `/sno:learn` -- gather context, write a spec
- `/sno:plan` -- break spec into tasks (structured format with verify/done per task)
- `/sno:build` -- execute tasks in parallel waves (commits per wave)
- `/sno:check` -- verify work against spec (auto-diagnoses failures)
- `/sno:ship` -- commit remaining changes and ship
- `/sno:todo` -- parking lot for later
- `/sno:go` -- quick mode for small tasks, skip the full ceremony

## Design Principles

- **DDD always.** Every spec identifies bounded contexts and aggregates.
- **5NF target.** Data models normalize fully; denormalization requires justification.
- **No assumptions.** If the user didn't say it, it's an open question. Ask, don't guess.
- **Extensibility first.** Storage, network, parsing, alerting, syncing -- all abstracted as ports.
- **One question at a time.** Don't batch questions. Let each answer inform the next.
- **Research before decisions.** Parallel agents investigate before a single line of spec. Cheap thinking now, expensive rework avoided later.
- **Coverage, not trust.** Every phase cross-checks the previous one. Spec vs research, plan vs acceptance criteria, check vs spec.
- **Flag it, don't fix it.** Agents report scope surprises -- they don't silently add work. The user decides what's in scope.
- **Parallelize by default.** Structure work so independent things run simultaneously. Interfaces first to unblock everything else.
- **Domain names, not generic names.** No `model`, `types`, `utils`, `helpers`. Name things after what they are in the domain.
- **No triggers or stored procedures.** Avoid database triggers and stored procedures unless the user explicitly provides a compelling reason. They hide logic, complicate debugging, and create invisible coupling.
- **Tests are not optional.** Every code change ships with tests. Changes without tests break shit. If you're not testing it, you're not done. Opting out of tests requires the user to explicitly say so.
- **Errors compound downstream.** A mistake caught in the spec costs 1x to fix. The same mistake caught in the plan costs 5x. Caught in code, 25x. This is why learn and plan are thorough.

## Learn Phase Agents

The learn phase spawns parallel Opus agents:
- `prior-art-researcher` -- how similar problems are solved, domain-specific patterns, architectural patterns, domain gotchas
- `domain-researcher` -- DDD analysis (bounded contexts, aggregates, events)
- `data-modeler` -- entity/relationship modeling, 5NF normalization
- `codebase-scout` -- existing code patterns, conventions, risks
- `service-layer-analyst` -- API boundaries, orchestration, transaction scoping, cross-cutting concerns
- `requirements-interviewer` -- synthesizes open questions from all agents into focused interview

## Plan Phase Agents

The plan phase spawns parallel Opus agents, then a critical reviewer:

**Wave 1 (parallel):**
- `planner` -- task decomposition, dependency graph, wave planning, coverage matrix
- `ux-reviewer` -- interaction flows, error UX, CLI/TUI/GUI ergonomics, accessibility
- `antipattern-detector` -- tech stack gotchas, domain antipatterns, security pitfalls, dependency risks

**Wave 2 (after wave 1 completes):**
- `critical-reviewer` -- adversarial review of the assembled plan, checks coverage gaps, dependency correctness, missed risks, and scope drift

## Check Phase Agents

The check phase spawns agents in parallel alongside the acceptance criteria verification:

- `pr-reviewer` -- full PR-style code review of the diff against the base branch. Reviews correctness, security, performance, consistency, maintainability, and test coverage. Missing tests on new code paths are a critical (shipping-blocking) issue. Returns a structured review with verdict (APPROVE / REQUEST CHANGES / COMMENT). Critical issues block shipping.
- `test-coverage` -- identifies new/modified code paths in the diff and verifies each has corresponding test coverage. Gaps block shipping.
- `codex review` (conditional) -- if the codex plugin is installed, runs an additional code review pass via `/codex:rescue`. Skipped silently if not available.

## Project State

All workflow state lives in `.sno/` in the user's project directory:
- `state.json` -- current phase
- `spec.md` -- the spec
- `plan.md` -- the task list
- `todos.md` -- parking lot
- `research/` -- agent outputs from learn phase

## Plugin Structure

See [plugin-layout.md](plugin-layout.md) for details.
