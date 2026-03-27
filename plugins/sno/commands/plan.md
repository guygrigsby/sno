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

2. **Spawn the `planner` agent** (Opus) to analyze the spec, research outputs, and codebase. It produces a draft plan AND a list of open questions/ambiguities it found.

3. **Present open questions one at a time.** Before showing the plan, ask each question the planner identified individually. Wait for the user's answer before asking the next one. These are implementation-level questions that affect task scoping, architecture, or approach that the spec doesn't answer.

   If the user says "pick defaults" or similar, pick reasonable choices for all remaining questions and note them.

4. **Show the draft plan.** After questions are resolved, show the plan incorporating the user's answers. Include a summary of what can run in parallel:
   - "**Wave 1** (parallel): tasks 1, 2"
   - "**Wave 2** (parallel): tasks 3, 5"
   - "**Wave 3** (sequential): task 4"

5. **Verify coverage.** Before showing the plan to the user, check the planner's coverage matrix. Every "Done when" criterion from the spec must map to at least one task. If anything is uncovered, add tasks or ask the user whether it's in scope. Flag any tasks that don't map to a spec requirement — they may be scope creep.

6. **Review loop.** Ask the user to review. They can:
   - Request changes ("split task 3", "merge 2 and 4", "add X", "remove Y")
   - Ask questions about the plan
   - Approve it

   Iterate until the user approves. Don't rush to approval — a good plan prevents rework.

7. **Write the approved plan** to `.sno/plan.md` using the structured task format:

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

8. Update `.sno/state.json` phase to `build`. Then tell the user: "Run `/sno:build` to start executing the plan."

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
- Skip the review loop (step 6). Write the plan and immediately advance to the build phase. Continue through remaining phases without stopping.
- Coverage verification (step 5) still runs — never skip it.
- If the planner has no open questions, proceed directly to writing the plan and advancing.
