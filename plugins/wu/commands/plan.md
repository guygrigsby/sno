---
name: plan
description: "Break the spec into tasks with dependency DAG and wave scheduling."
---

You are in the **plan** phase of wu.

## What to do

1. Read `.wu/state.json` and verify `current_phase` is `"plan"`. If not, tell the user which phase they are actually in and stop.

2. Read `.wu/phases/learn/summary.md` to load context from the learn phase. This is your input. If it does not exist, tell the user to run `/wu:learn` first.

3. **Pre-dispatch cost warning.** Before dispatching agents:
   - Count agents to dispatch (2 primary + 2 cipher agents × cipher rounds).
   - Show estimated cost by agent and model tier.
   - Ask the user for explicit confirmation. Do not proceed without it.

4. **Dispatch planning agents via the Agent SDK CLI.** Build the prompt from the learn summary. Then run:

   ```bash
   npx wu-dispatch \
     --phase plan \
     --agents gza,raekwon \
     --prompt "<learn summary + task decomposition instructions>" \
     --wu-dir .wu
   ```

   Each agent receives the learn summary as context:
   - **GZA** (Technical Architect) — Decompose the domain model and spec into concrete technical tasks. Make architecture decisions (file structure, module boundaries, API shape). Assign dependencies between tasks.
   - **Raekwon** (Implementation Strategist) — Scope each task practically. Estimate complexity, identify risky tasks, suggest implementation order. Flag tasks that need spikes or prototyping.

   **If the CLI fails**, fall back to the local Agent tool — dispatch each agent as a subagent with its wu alias. Log: `"Cloud dispatch failed, using local fallback."`

5. **Show progress** as each agent completes. The CLI prints progress to stderr automatically. If using local fallback, print:
   - `"GZA (Technical Architect) completed [1/2]"`
   - `"Raekwon (Implementation Strategist) completed [2/2]"`

6. **Run cipher rounds** (use count from config, default 3). For each round, dispatch via the CLI:

   ```bash
   npx wu-dispatch \
     --phase plan \
     --agents inspectah-deck,masta-killa \
     --prompt "<task graph for verification>" \
     --wu-dir .wu
   ```

   If CLI fails, fall back to local Agent tool dispatch. Inspectah Deck and Masta Killa verify the task graph.
   - They check for: missing dependencies, circular deps, scope gaps, tasks that are too large, file ownership conflicts.
   - Compute concordance and slop scores.
   - Show progress: `"Cipher round 1/3 complete — concordance: 91, slop: 8"`.

7. **Resolve conflicts** per protocol:
   - **Low severity** — Log, no action.
   - **Medium severity** — Quorum vote among planning agents.
   - **High severity** — Escalate to RZA.
   - **Unresolvable** — Ask user.

8. **Produce the task graph.** Write to `.wu/phases/plan/tasks.md`. Format:

   ```markdown
   ## Wave 1

   ### 1. Task Title (depends: none)
   - **status**: pending
   - **files**: src/foo.ts, src/bar.ts
   - **verify**: describe how to verify this task is done
   - **done**: acceptance criteria

   ### 2. Task Title (depends: none)
   ...

   ## Wave 2

   ### 3. Task Title (depends: 1)
   ...
   ```

   Rules for the task graph:
   - Tasks are numbered sequentially.
   - Dependencies reference task numbers.
   - Tasks within the same wave have no dependencies on each other.
   - **Exclusive file ownership**: no two tasks in the same wave may touch the same file.
   - Each task has: status, files, verify, done.

9. **Produce summary.md** for context handoff:
   - Write to `.wu/phases/plan/summary.md`.
   - Hard cap: 2000 characters.
   - Include: task count, wave count, critical path, key risks.

10. **Log all dispatches** to the audit trail:
    - Append to `.wu/audit.log` (or `.wu/audit.jsonl`).
    - Each entry: timestamp, agent alias, phase, duration, status, model used.

11. **Advance phase** — Determine next phase from config:
    - If risk-analysis phase is enabled: advance to `"risk-analysis"`.
    - Otherwise: advance to `"build"`.
    - Update `current_phase` in `.wu/state.json`.

12. Tell the user the next step:
    - If advancing to build: `"Run /wu:build to execute the plan."`
    - If advancing to risk-analysis or check: `"Run /wu:check for compliance review."`

## STOP gate

Do **not** proceed to the next phase automatically. The user must invoke the next command explicitly.
