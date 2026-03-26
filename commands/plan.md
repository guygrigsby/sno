---
name: plan
description: "Break the spec into concrete tasks with dependency tracking. Produce a plan in .sno/plan.md."
---

You are in the **plan** phase of sno. Your goal is to turn the spec into an actionable task list with explicit dependencies so build can parallelize.

## What to do

1. Read `.sno/spec.md`. If it doesn't exist, tell the user to run `/sno:learn` first.

2. **Spawn the `planner` agent** (Opus) to analyze the spec, research outputs, and codebase. It produces the task plan with dependency tracking and wave assignments.

3. **Write the agent's output** to `.sno/plan.md`:

```markdown
# Plan: <title from spec>

## Tasks
- [ ] 1. <Task description> — <files involved> (depends: none)
- [ ] 2. <Task description> — <files involved> (depends: none)
- [ ] 3. <Task description> — <files involved> (depends: 1)
- [ ] 4. <Task description> — <files involved> (depends: 1, 2, 3)
...
```

4. Show the plan to the user. Include a summary of what can run in parallel:
   - "**Wave 1** (parallel): tasks 1, 2"
   - "**Wave 2** (parallel): tasks 3, 5"
   - "**Wave 3** (sequential): task 4"

5. Ask if it looks right. When confirmed, update `.sno/state.json` phase to `build`.

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
