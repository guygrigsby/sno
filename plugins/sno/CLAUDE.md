# sno

A straightforward Claude Code plugin for spec-driven development.

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

- **Smallest diff that works.** Make the absolute minimum change to accomplish the exact goal. No drive-by refactors, no adjacent cleanup, no "while we're in here" improvements. If it's not in the spec, it's not in the diff.
- **Less code is better code.** Within a task, write the minimum code that does the job in a maintainable way. Every line is a liability someone must read, test, debug, and maintain. Fewer files, fewer abstractions, fewer helpers, fewer lines. Terseness is not the goal — clarity is — but when two correct solutions exist, pick the smaller one. Do not build speculative flexibility, hypothetical extension points, or premature abstractions. Code you didn't write cannot break.
- **UX is measurable.** UI work is reviewed against the 13 UX principles in `plugins/sno/ux-principles.md`, sourced from Apple HIG, Nielsen NN/g, 1Password, Stripe, Linear, Material Design 3, Refactoring UI, and Shneiderman (1983). Must-have principles block shipping; should-have principles are advisory.
- **Principle of Least Astonishment (PoLA).** Code, APIs, naming, behavior, and structure should do what a reasonable person would expect. No surprises. If something looks like X, it should behave like X. If a pattern exists, follow it. If a convention is established, respect it. When in doubt, pick the option that would make someone say "of course" instead of "wait, what?"
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
- **Comments are part of the code.** Every public function, type, and interface gets a docstring. Every module gets a top-level description. Non-obvious logic gets an inline comment explaining *why*, not *what*. If a future reader would need the spec to understand a block of code, it needs a comment. Self-documenting names are necessary but not sufficient.
- **Errors compound downstream.** A mistake caught in the spec costs 1x to fix. The same mistake caught in the plan costs 5x. Caught in code, 25x. This is why learn and plan are thorough.
- **Keep files small.** Target ~200 lines per source file; never exceed 400. Files that outgrow this are signaling a missing boundary — split along domain seams (separate files, separate packages) before the file becomes unreadable. This sits downstream of "less code is better code": the smallest diff still belongs in the smallest reasonable file.
- **Minimize function parameters.** Keep function signatures short — aim for 3-4 parameters max. When more are needed, group related parameters into a struct, options object, or config type. Ten-parameter functions are a code smell that signals missing abstraction.
- **Clear context between phases.** Every phase reads its state from `.sno/` files on disk (spec, plan, research, state.json) — it does not need the prior phase's conversation history. After each phase completes, the handoff instructs the user to run `/clear` before the next `/sno:<phase>` command, so each phase starts with a lean context. Exception: `--auto` mode runs all phases in a single invocation and cannot clear its own context mid-execution; it intentionally trades context cleanliness for momentum.

## Learn Phase Agents

The learn phase spawns parallel Opus agents:
- `prior-art-researcher` -- how similar problems are solved, domain-specific patterns, architectural patterns, domain gotchas
- `domain-researcher` -- DDD analysis (bounded contexts, aggregates, events)
- `data-modeler` -- entity/relationship modeling, 5NF normalization
- `codebase-scout` -- existing code patterns, conventions, risks
- `service-layer-analyst` -- API boundaries, orchestration, transaction scoping, cross-cutting concerns
- `assumption-miner` -- reads user's description, lists unstated assumptions for correction
- `security-researcher` -- identifies security risks, attack vectors, OWASP concerns, compliance requirements
- `requirements-interviewer` -- synthesizes open questions from all agents into tiered interview (blocking vs. refinement)

## Plan Phase Agents

The plan phase discovers available MCP tools, then spawns parallel Opus agents and a critical reviewer:

**Step 1: MCP Discovery**
- Discovers available MCP servers/tools via ToolSearch, writes to `.sno/research/available-tools.md`

**Wave 1 (parallel):**
- `planner` -- task decomposition, dependency graph, wave planning, coverage matrix, MCP tool assignment
- `ux-reviewer` -- dual-phase (plan + check). Reviews against the 13 UX principles in `plugins/sno/ux-principles.md`. Writes plan-phase findings to `.sno/research/ux-review.md` for the check-phase handoff. WCAG 2.1 AA is delegated to `accessibility-auditor`.
- `accessibility-auditor` -- WCAG 2.1 AA compliance, keyboard navigation, screen reader support, color contrast, motion sensitivity
- `antipattern-detector` -- tech stack gotchas, domain antipatterns, security pitfalls, dependency risks

**Wave 2 (after wave 1 completes):**
- `critical-reviewer` -- adversarial review of the assembled plan, checks coverage gaps, dependency correctness, missed risks, security coverage, and scope drift

## Check Phase Agents

The check phase spawns agents in parallel alongside the acceptance criteria verification:

- `pr-reviewer` -- full PR-style code review of the diff against the base branch. Reviews correctness, security, performance, consistency, maintainability, and test coverage. Missing tests on new code paths are a critical (shipping-blocking) issue. Returns a structured review with verdict (APPROVE / REQUEST CHANGES / COMMENT). Critical issues block shipping.
- `security-auditor` -- reviews code diff for security vulnerabilities, verifies threat mitigations from learn phase are implemented, checks security requirements coverage. Returns verdict (PASS / FAIL). Critical security issues block shipping.
- `accessibility-auditor` -- audits code diff for WCAG 2.1 AA compliance (color contrast, keyboard navigation, screen reader support, semantic HTML, motion sensitivity). Cross-references plan-phase recommendations from `.sno/research/accessibility.md`. Returns verdict (PASS / FAIL). Critical accessibility issues block shipping.
- `ux-reviewer` (check-phase mode) -- audits the code diff against the 13 UX principles in `plugins/sno/ux-principles.md`. Returns verdict (PASS / FAIL / WARN). Must-have principle violations (UX-P1b, UX-P3, UX-P5, UX-P7, UX-P10, UX-P11) block shipping; should-have violations are advisory. Cross-references `.sno/research/ux-review.md` from the plan phase. Deduped with `accessibility-auditor` on overlapping `(file, line, category)` findings — `accessibility-auditor` wins the tiebreak on WCAG-primary issues.
- `test-coverage` -- identifies new/modified code paths in the diff and verifies each has corresponding test coverage. Gaps block shipping.
- `codex review` (conditional) -- if the codex plugin is installed, runs an additional code review pass via `/codex:rescue`. Skipped silently if not available.

## Project State

All workflow state lives in `.sno/` in the user's project directory:
- `state.json` -- current phase
- `spec.md` -- the spec
- `plan.md` -- the task list
- `todos.md` -- parking lot
- `research/` -- agent outputs from learn and plan phases
  - `prior-art.md`, `domain.md`, `data-model.md`, `codebase.md`, `service-layer.md`
  - `assumptions.md` -- unstated assumptions surfaced by assumption-miner
  - `security.md` -- security threats and mitigations from security-researcher
  - `accessibility.md` -- accessibility requirements and recommendations from accessibility-auditor (plan phase)
  - `ux-review.md` -- plan-phase `ux-reviewer` findings; check-phase `ux-reviewer` cross-references this file
  - `available-tools.md` -- MCP tools discovered during plan phase
  - `answers.md` -- user responses to interview questions

## Plugin Structure

See [plugin-layout.md](plugin-layout.md) for details.
