---
name: check
description: "Verify the work matches the spec. Run tests, review changes, check acceptance criteria."
arguments:
  - name: flags
    description: "Optional flags. Use --auto to skip confirmations and continue through all phases."
    required: false
---

You are in the **check** phase of sno. Your goal is to verify the work.

## What to do

1. Read `.sno/spec.md` and `.sno/plan.md`.

2. **Check each acceptance criterion** from the spec's "Done when" section:
   - Read the relevant code to verify it's implemented.
   - Run tests if they exist.
   - Run the build/lint if applicable.
   - Mark each criterion as met or not met.

3. **Check that the README is up to date.** Read `README.md` and compare it against the current spec and what was built:
   - Do any commands, features, or behaviors described in the README no longer match reality?
   - Does the work just completed add anything that should be reflected in the README?
   - If the README needs updating, update it before moving on.

4. **Report results** to the user:
   - List each criterion with pass/fail.
   - If something fails, explain what's wrong and suggest a fix.

5. If everything passes, update `.sno/state.json` phase to `ship`. Then tell the user: "Run `/sno:ship` to commit and ship."

**STOP.** Do not proceed to the ship phase. Do not start committing or shipping anything. Your job ends here — return control to the user. The next phase starts only when the user explicitly runs `/sno:ship`.

6. If something fails, **auto-diagnose**:
   - For each failing criterion, spawn a debug agent (via Agent tool) to investigate the root cause. Give it:
     - The failing criterion
     - The relevant code files
     - Any test output or error messages
   - The debug agent should return: what's wrong, why, and a concrete fix plan (specific files + changes).
   - Present the diagnosis to the user with the fix plan.
   - Offer options:
     - Apply the fix plans now (add them as tasks to `.sno/plan.md` and re-run `/sno:build`)
     - Fix it manually
     - Ship it anyway if the gap is acceptable

## Rules
- Be honest. Don't rubber-stamp. If something doesn't meet the spec, say so.
- But also be practical. If a criterion is 95% met and the gap is trivial, note it but don't block.
- Don't add new requirements during check. If you notice something that should be improved, suggest adding it to `/sno:todo`.

## --auto flag

The STOP gate above does NOT apply when `--auto` is set. With `--auto`:
- Run all checks and update the README without pausing.
- If everything passes, immediately advance to the ship phase and continue.
- If something fails, run auto-diagnosis. If the fix is small (< 20 lines total), apply it directly. If larger, log the failures and fix plans in `.sno/todos.md` and advance to ship anyway — don't block.
