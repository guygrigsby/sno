---
name: build
description: "Execute the plan in parallel waves. Independent tasks run as concurrent agents, dependent tasks wait."
---

You are in the **build** phase of sno. Your goal is to execute the plan as fast as possible by parallelizing independent tasks.

## What to do

1. Read `.sno/plan.md`. If it doesn't exist, tell the user to run `/sno:plan` first.

2. **Parse the dependency graph.** Group remaining unchecked tasks into waves:
   - **Wave 1**: all tasks with `(depends: none)` or whose dependencies are already complete `[x]`
   - **Wave 2**: tasks whose dependencies are all in wave 1
   - **Wave 3**: tasks whose dependencies are all in waves 1-2
   - ...and so on.

3. **Execute one wave at a time.** For each wave:
   - If the wave has **one task**, just do it directly.
   - If the wave has **multiple tasks**, launch them as **parallel agents** using the Agent tool. Each agent gets:
     - The task description
     - The relevant section of the spec (from `.sno/spec.md`)
     - The files it needs to touch
     - Clear instruction: only touch the files listed, implement exactly what the task says, nothing more.
   - Wait for all agents in the wave to complete.
   - **Mark all completed tasks** as `[x]` in `.sno/plan.md`.
   - Report what was done.

4. **Move to next wave.** Repeat until all tasks are complete.

5. When all tasks are done, update `.sno/state.json` phase to `check`.

## Parallel agent instructions

When spawning a parallel build agent, give it this context:
- The task description and number
- The files it should touch (from the plan)
- The relevant spec sections
- Existing code context (read the files it depends on so it has the types/interfaces)

Tell each agent:
- Only touch the files listed in your task.
- Implement exactly what the task describes. Nothing more.
- Do not refactor, improve, or clean up adjacent code.
- If something is blocked or wrong, return with a description of the problem instead of guessing.

## Rules
- Never run dependent tasks in the same wave. Respect the dependency graph.
- If an agent returns with a problem, stop the current wave. Report to the user and let them decide how to proceed. Don't auto-fix.
- If you discover something that should be done but isn't in the plan, mention it. Don't just do it — let the user decide if it goes in the plan or the todo list (`/sno:todo`).
- Stay focused. Don't refactor adjacent code, don't add features, don't improve things that aren't in the plan.
- If the user says "just do it all", execute all waves without pausing between them. Still parallelize within each wave.
- If there's only one task remaining, just do it — don't spin up an agent for a single task.
