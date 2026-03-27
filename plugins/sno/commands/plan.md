---
name: plan
description: "Break the spec into concrete tasks with dependency tracking. Produce a plan in .sno/plan.md."
arguments:
  - name: flags
    description: "Optional flags. Use --auto to skip confirmations and continue through all phases."
    required: false
---

You are in the **plan** phase of sno. Your goal is to turn the spec into an actionable task list with explicit dependencies so build can parallelize.

## What to do

1. Read `.sno/spec.md`. If it doesn't exist, tell the user to run `/sno:learn` first.

2. **Spawn parallel plan agents.** Launch these four agents **in parallel** using the Agent tool:

   1. **planner** — Analyzes the spec, research outputs, and codebase. Produces a draft plan with dependency-tracked tasks and a list of open questions/ambiguities. Uses Opus.
   2. **service-layer-analyst** — Analyzes service layer design: API boundaries, orchestration, transaction scoping, cross-cutting concerns. Uses Opus.
   3. **ux-reviewer** — Reviews user experience: interaction flows, error UX, CLI ergonomics, UI patterns, developer experience. Adapts to the interface type (CLI, TUI, GUI, API, library). Uses Opus.
   4. **antipattern-detector** — Identifies antipatterns, gotchas, and common mistakes specific to the tech stack and domain. Checks dependencies for known issues. Uses Opus.

   Give each agent the user's description and the paths to the spec and research outputs.

3. **Present open questions one at a time.** Collect open questions from ALL four agents. Deduplicate and prioritize them. Before showing the plan, ask each question individually. Wait for the user's answer before asking the next one. These are implementation-level questions that affect task scoping, architecture, or approach that the spec doesn't answer.

   If the user says "pick defaults" or similar, pick reasonable choices for all remaining questions and note them.

4. **Incorporate agent findings into the draft plan.** Take the planner's draft plan and enrich it with:
   - Service layer analyst's recommendations (transaction boundaries, API surface mapping, cross-cutting concerns)
   - UX reviewer's must-have recommendations (error UX, interaction flows, accessibility)
   - Antipattern detector's mitigations (add guardrails to relevant tasks, reorder if needed)

   Include a summary of what can run in parallel:
   - "**Wave 1** (parallel): tasks 1, 2"
   - "**Wave 2** (parallel): tasks 3, 5"
   - "**Wave 3** (sequential): task 4"

5. **Spawn the `critical-reviewer` agent** (Opus) on the assembled draft plan. Pass it the draft plan AND the outputs from all three analysis agents. It performs an adversarial review checking for:
   - Spec coverage gaps
   - Dependency correctness
   - Task quality issues
   - Missed risks from the antipattern report
   - UX recommendations that didn't make it into tasks
   - Service layer coherence

   If the critical reviewer's verdict is NEEDS REVISION, incorporate its recommended changes before showing the plan to the user. If PASS WITH CONCERNS, note the concerns when presenting.

6. **Verify coverage.** Before showing the plan to the user, check the planner's coverage matrix. Every "Done when" criterion from the spec must map to at least one task. If anything is uncovered, add tasks or ask the user whether it's in scope. Flag any tasks that don't map to a spec requirement — they may be scope creep.

7. **Review loop.** Ask the user to review. They can:
   - Request changes ("split task 3", "merge 2 and 4", "add X", "remove Y")
   - Ask questions about the plan
   - Approve it

   Iterate until the user approves. Don't rush to approval — a good plan prevents rework.

8. **Write the approved plan** to `.sno/plan.md` using the structured task format:

```markdown
# Plan: <title from spec>

## Tasks

### 1. <Task description> (depends: none)
- **status:** [ ]
- **files:** `path/to/file.ts`, `path/to/other.ts`
- **verify:** <How to confirm this task is done — a command to run, a check to perform, or a condition to inspect>
- **done:** <One-line success criterion>

### 2. <Task description> (depends: none)
- **status:** [ ]
- **files:** `path/to/file.ts`
- **verify:** <verification step>
- **done:** <success criterion>

### 3. <Task description> (depends: 1, 2)
- **status:** [ ]
- **files:** `path/to/file.ts`
- **verify:** <verification step>
- **done:** <success criterion>
```

Each task must have all five fields: status, files, verify, done, and dependencies in the heading.

9. Update `.sno/state.json` phase to `build`. Then tell the user: "Run `/sno:build` to start executing the plan."

**STOP.** Do not proceed to the build phase. Do not start implementing anything. Your job ends here — return control to the user. The next phase starts only when the user explicitly runs `/sno:build`.

## Dependency rules
- Every task must declare `(depends: none)` or `(depends: <task numbers>)`.
- A task depends on another only if it reads/modifies files the other creates, or if it uses types/interfaces the other defines.
- Be precise. Two tasks touching different files with no shared types have no dependency — they can run in parallel.
- Tasks that touch the same file MUST have a dependency between them.

## Rules
- Tasks should be small enough to do in one shot. If a task feels big, split it.
- Each task should name the files it touches so the user knows the blast radius.
- 3-10 tasks is the sweet spot. If you have more than 10, you're planning too granularly. If you have fewer than 3, the spec might be too small to need a plan (that's fine — just make 1-2 tasks).
- Don't add tasks the user didn't ask for. No "add tests" or "update docs" unless the spec says so.
- Maximize parallelism. If two tasks CAN be independent, make them independent. Structure the work to minimize sequential bottlenecks.

## --auto flag

The STOP gate above does NOT apply when `--auto` is set. With `--auto`:
- Still present open questions (step 3) — these MUST be answered even in auto mode, since guessing leads to rework.
- Skip the review loop (step 7). Write the plan and immediately advance to the build phase. Continue through remaining phases without stopping.
- All parallel agents (step 2) and critical review (step 5) still run — never skip analysis.
- Coverage verification (step 6) still runs — never skip it.
- If no agents have open questions, proceed directly to writing the plan and advancing.
