---
name: ship
description: "Commit the work, open a PR to main, and close out the cycle."
arguments:
  - name: flags
    description: "Optional flags. Use --auto to commit and close without confirmations."
    required: false
---

You are in the **ship** phase of sno. Your goal is to ship the work.

## What to do

1. Read `.sno/spec.md` for context on what was built.

2. **Stage and commit** any remaining changes:
   - Review what's changed with `git status` and `git diff`.
   - Note: build waves may have already committed most changes. Only stage and commit what's left (e.g., README updates from check phase, any manual fixes).
   - Stage the relevant files (not `.sno/` — that's local state).
   - If there are unstaged changes, write a clear commit message based on the spec's goal. Ask the user before committing.
   - If nothing to commit (waves already covered everything), skip to step 3.

3. **Create PR**:
   - Check the current branch name. If it starts with `sno/`, push the branch and create a PR to `main`:
     - `git push -u origin <branch>`
     - Use `gh pr create --base main` with the spec's goal as the title and requirements as the body.
   - If the branch does NOT start with `sno/`, skip this step.
   - If `gh pr create` fails (e.g., PR already exists), note the error and continue — don't block the cycle close.

4. **Monitor PR checks and fix failures.** If a PR was created in step 3 and `gh` is available:
   - Run `gh pr checks <pr-number> --watch` to wait for CI checks to complete.
   - If all checks pass, proceed to step 5.
   - If any checks fail:
     1. Retrieve the failing check's log with `gh run view <run-id> --log-failed` to understand what went wrong.
     2. Diagnose the failure — read the relevant code, test output, and error messages.
     3. Fix the issue locally, commit, and push. Use a clear commit message referencing what CI failure was fixed.
     4. Wait for the new CI run to complete (`gh pr checks <pr-number> --watch`).
     5. If checks fail again, repeat: diagnose, fix, push. Try up to **3 fix attempts** total.
     6. If checks still fail after 3 attempts, stop and report the situation to the user with the failure details and what you've tried. Do not close the cycle with failing checks.
   - If no PR was created (non-sno branch or PR already existed), skip this step.

5. **Close the cycle**:
   - Update `.sno/state.json` phase to `done`.
   - Tell the user the cycle is complete.
   - Check for outstanding todo items. Use the same backend preference as `/sno:todo` (beads → GitHub → local):
     - Beads: `bd list --label sno:todo --status open` (if beads is initialized in the project)
     - GitHub: `gh issue list --label "sno:todo" --state open` (if `gh` is available)
     - Local: `.sno/todos.md`
   - If there are items in any, mention them: "You have N items in the todo list for next time." Include the issue list URL when applicable.

## Rules
- On `sno/` branches, push and create a PR to main automatically — no confirmation needed.
- On non-sno branches, never push without explicit user confirmation.
- Smallest diff that works. Before committing, review the diff — if you see changes beyond the spec (drive-by refactors, unplanned improvements), flag them to the user.
- Don't commit `.sno/` files — they're local workflow state.
- Keep commit messages concise and tied to what was actually built, not the process.

## --auto flag

If `--auto` is set:
- Stage and commit without asking. Write the commit message from the spec's goal.
- Create the PR (same as step 3 — push and `gh pr create` on `sno/` branches).
- Monitor and fix PR check failures (same as step 4 — up to 3 fix attempts).
- Close the cycle once checks pass (or halt if they don't after 3 attempts).
