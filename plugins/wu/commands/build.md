---
name: build
description: "Execute the plan in parallel waves with cloud-first agent dispatch."
---

You are in the **build** phase of wu.

## What to do

1. Read `.wu/state.json` and verify `current_phase` is `"build"`. If not, tell the user which phase they are actually in and stop.

2. Read the task graph from `.wu/phases/plan/tasks.md`. If it does not exist, tell the user to run `/wu:plan` first.

3. **Parse the dependency graph into waves.** Each wave is a set of tasks whose dependencies are all satisfied by prior waves. Validate:
   - No circular dependencies.
   - Exclusive file ownership within each wave (no two tasks in the same wave touch the same file).
   - If validation fails, report the issue and stop.

4. **For each wave, execute in order:**

   a. **Pre-dispatch cost warning** for this wave:
      - Show how many agents will run, which model tier, and estimated cost.
      - Ask the user for confirmation before dispatching. Do not proceed without it.

   b. **Dispatch agents via the Messages API CLI.** Use the Bash tool to run the CLI. Set Bash tool timeout to 600000ms (10 minutes) for this dispatch call.

      Build the prompt from the task description, file list, verification criteria, and plan/learn summaries. Write the prompt to a temp file first, then pass it via `--prompt-file`.

      ```bash
      npx wu-dispatch \
        --phase build \
        --agents <agent-aliases-for-this-wave> \
        --prompt-file /tmp/wu-dispatch-prompt.txt \
        --wu-dir .wu \
        --batch-size <from config, default 4>
      ```

      Assign agent personas based on task type: GZA for architecture tasks, Raekwon for implementation, Ghostface for spec-heavy work, etc.

      If `npx wu-dispatch` exits non-zero, show the error (exit code and stderr) to the user and **stop**. Do not attempt local dispatch as a fallback. The user must fix the issue (missing API key, network error, etc.) and re-run the command.

   c. **Batch concurrency**: the CLI respects `--batch-size` (default 4, configurable in `.wu/config.json`).

   d. **Enforce exclusive file ownership**: before dispatch, verify no two tasks in this wave will write to the same file. If a conflict is detected, split the wave or serialize the conflicting tasks.

   e. **Show progress** as each agent completes:
      - `"Task 3 (Create user model) completed [2/4 in wave 2]"`
      - Show running total: `"Overall: 5/12 tasks complete"`

   f. **Collect results and log to audit trail**:
      - Append to `.wu/audit.log` (or `.wu/audit.jsonl`).
      - Each entry: timestamp, task number, agent alias, phase, duration, status, model used, files touched.

   g. **Mark completed tasks** — Update the task status in `.wu/phases/plan/tasks.md` from `pending` to `done`.

   h. **Commit the wave** — Stage all files touched by the wave and create a git commit:
      - Message format: `"wu build: wave N — <brief summary of tasks completed>"`
      - Do not push unless the user asks.

5. **Handle agent failures.** If any agent in a wave fails:
   - Stop the current wave immediately (do not dispatch remaining tasks).
   - Report which task failed and what went wrong.
   - Offer the user options:
     - **Retry** — Re-dispatch the failed task.
     - **Skip** — Mark the task as skipped and continue (warn about downstream deps).
     - **Abort** — Stop the build phase entirely.
   - Do not proceed without user direction.

6. **After all waves complete**, produce summary.md for context handoff:
   - Write to `.wu/phases/build/summary.md`.
   - Hard cap: 2000 characters.
   - Include: tasks completed, tasks skipped (if any), files changed, wave count, total duration estimate.

7. **Advance phase** — Update `current_phase` to `"check"` in `.wu/state.json`.

8. Tell the user:
   > Build phase complete. Run `/wu:check` to verify the work.

## STOP gate

Do **not** proceed to the check phase automatically. The user must invoke `/wu:check` explicitly.
