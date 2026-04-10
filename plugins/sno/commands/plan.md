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

### Step 0: Check and set state
If `.sno/state.json` doesn't exist, tell the user: "Run `/sno:new` first." and stop.

Update `.sno/state.json` phase to `plan`.

1. Read `.sno/spec.md`. If it doesn't exist, tell the user to run `/sno:learn` first.

2. **Discover available tools.** Before spawning plan agents, discover what MCP tools and servers are available in the current session:

   1. Use the ToolSearch tool to query for tools relevant to the project's tech stack and domain (e.g., database tools, cloud deployment tools, API tools, linting tools, testing tools).
   2. List all discovered MCP servers and their capabilities.
   3. Write the results to `.sno/research/available-tools.md`:

   ```markdown
   ## Available MCP Tools

   ### <Server/Tool Name>
   - **Capabilities:** <what it can do>
   - **Relevant to:** <which spec areas or tasks could use this>

   ### <Server/Tool Name>
   - **Capabilities:** <what it can do>
   - **Relevant to:** <which spec areas or tasks could use this>

   ## Tool Recommendations
   - Task area X → use <tool> for <reason>
   - Task area Y → use <tool> for <reason>
   ```

   If no relevant MCP tools are found, note that in the file and proceed — this step is informational, not blocking.

3. **Spawn parallel plan agents.** Launch these four agents **in parallel** using the Agent tool:

   1. **planner** — Analyzes the spec, research outputs, and codebase. Produces a draft plan with dependency-tracked tasks and a list of open questions/ambiguities. Uses Opus.
   2. **ux-reviewer** — Reviews user experience: interaction flows, error UX, CLI ergonomics, UI patterns, developer experience. Adapts to the interface type (CLI, TUI, GUI, API, library). Uses Opus.
   3. **antipattern-detector** — Identifies antipatterns, gotchas, and common mistakes specific to the tech stack and domain. Checks dependencies for known issues. Uses Opus.
   4. **accessibility-auditor** — Reviews the spec for accessibility requirements, gaps, and risks. Identifies applicable WCAG 2.1 AA criteria for the interface type and produces concrete recommendations for the planner to incorporate into tasks. Uses Opus.

   Give each agent the user's description and the paths to the spec and research outputs. Pass the planner the path to `.sno/research/available-tools.md` so it can assign MCP tools to specific tasks where appropriate. The spec already contains service layer analysis from the learn phase — the planner should use it.

4. **Present open questions one at a time.** Collect open questions from ALL four agents. Deduplicate and prioritize them. Before showing the plan, ask each question individually. Wait for the user's answer before asking the next one. These are implementation-level questions that affect task scoping, architecture, or approach that the spec doesn't answer.

   If the user says "pick defaults" or similar, pick reasonable choices for all remaining questions and note them.

5. **Incorporate agent findings into the draft plan.** Take the planner's draft plan and enrich it with:
   - UX reviewer's must-have recommendations (error UX, interaction flows)
   - Accessibility auditor's must-have recommendations (WCAG compliance, keyboard navigation, screen reader support, color contrast)
   - Antipattern detector's mitigations (add guardrails to relevant tasks, reorder if needed)

   Include a summary of what can run in parallel:
   - "**Wave 1** (parallel): tasks 1, 2"
   - "**Wave 2** (parallel): tasks 3, 5"
   - "**Wave 3** (sequential): task 4"

6. **Spawn the `critical-reviewer` agent** (Opus) on the assembled draft plan. Pass it the draft plan AND the outputs from the UX reviewer and antipattern detector. It performs an adversarial review checking for:
   - Spec coverage gaps
   - Dependency correctness
   - Task quality issues
   - Missed risks from the antipattern report
   - UX recommendations that didn't make it into tasks
   - Accessibility recommendations that didn't make it into tasks
   - Service layer coherence (cross-check against the spec's Service Layer section)

   Write the accessibility auditor's output to `.sno/research/accessibility.md` so the check phase can cross-reference it.

   If the critical reviewer's verdict is NEEDS REVISION, incorporate its recommended changes and **re-run the critical reviewer once more** on the revised plan. This catches issues introduced by the revision itself. Cap at 2 critical review rounds — if it still says NEEDS REVISION after two passes, present both the plan and the remaining concerns to the user and let them decide. If PASS WITH CONCERNS, note the concerns when presenting.

7. **Verify coverage.** Before showing the plan to the user, check the planner's coverage matrix. Every "Done when" criterion from the spec must map to at least one task. If anything is uncovered, add tasks or ask the user whether it's in scope. Flag any tasks that don't map to a spec requirement — they may be scope creep. Also verify test coverage mapping: every task that creates or modifies code must either include inline test work or have a dependency on a test task that covers it. If any implementation task has no test coverage, flag it.

8. **Review loop.** Ask the user to review. They can:
   - Request changes ("split task 3", "merge 2 and 4", "add X", "remove Y")
   - Ask questions about the plan
   - Approve it

   Iterate until the user approves. Don't rush to approval — a good plan prevents rework.

9. **Write the approved plan** to `.sno/plan.md` using the structured task format:

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

10. Update `.sno/state.json` phase to `build`. Then tell the user, verbatim:

> Plan phase complete. The build phase reads the plan from `.sno/plan.md`, so conversation history is no longer needed. Start the build phase with a clean context:
>
>     /clear
>     /sno:build

**STOP.** Do not proceed to the build phase. Do not start implementing anything. Your job ends here — return control to the user. The next phase starts only when the user explicitly runs `/sno:build` (after `/clear`).

## Dependency rules
- Every task must declare `(depends: none)` or `(depends: <task numbers>)`.
- A task depends on another only if it reads/modifies files the other creates, or if it uses types/interfaces the other defines.
- Be precise. Two tasks touching different files with no shared types have no dependency — they can run in parallel.
- Tasks that touch the same file MUST have a dependency between them.

## Rules
- Tasks should be small enough to do in one shot. If a task feels big, split it.
- Each task should name the files it touches so the user knows the blast radius.
- 3-10 tasks is the sweet spot. If you have more than 10, you're planning too granularly. If you have fewer than 3, the spec might be too small to need a plan (that's fine — just make 1-2 tasks).
- Every implementation task must include tests alongside the implementation. Tests are always required — they are part of "done," not bonus work. Only skip tests if the user explicitly opts out.
- Smallest diff that works. Each task should produce the minimum change needed. No bundled cleanup, no "while we're in here" improvements.
- Least code, best practices. Plan the simplest implementation that satisfies the task in a maintainable way — fewest files, fewest abstractions, fewest lines. Do not plan speculative flexibility, configuration hooks, or extension points the spec doesn't require. If a task's approach could be expressed more compactly without sacrificing clarity or best practices, plan the compact version.
- Don't add tasks the user didn't ask for. No "update docs" or unrelated cleanup unless the spec says so.
- Maximize parallelism. If two tasks CAN be independent, make them independent. Structure the work to minimize sequential bottlenecks.

## --auto flag

The STOP gate above does NOT apply when `--auto` is set. With `--auto`:
- Still present open questions (step 4) — these MUST be answered even in auto mode, since guessing leads to rework.
- Skip the review loop (step 8) **and skip the `/clear` handoff** — a single run cannot clear its own context mid-execution. Write the plan and immediately advance to the build phase. Continue through remaining phases in the current context.
- Tool discovery (step 2), all parallel agents (step 3), and critical review (step 6) still run — never skip analysis.
- Coverage verification (step 7) still runs — never skip it.
- If no agents have open questions, proceed directly to writing the plan and advancing.
