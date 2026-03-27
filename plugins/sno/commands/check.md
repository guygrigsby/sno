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

2. **Check acceptance criteria in parallel.** For each criterion in the spec's "Done when" section, spawn a **verification agent** (via Agent tool). If there are 3+ criteria, run them all in parallel — each criterion reads different code and can be checked independently. Each agent gets:
   - The specific criterion to verify
   - The relevant task(s) from the plan that implement it
   - The spec sections for context
   - Instructions to apply the **four-question review**:
     1. **Correctness**: Does the code actually satisfy this criterion, or does it only appear to?
     2. **Edge cases**: What happens with empty inputs, missing data, concurrent access, error paths?
     3. **Consistency**: Is the same pattern used elsewhere in the codebase? If so, does this implementation match?
     4. **Better approach**: Is there a simpler or more robust way to do this?
   - Each agent returns: pass/fail, evidence (what it checked), and any concerns.

   **In parallel with the verification agents**, also spawn a **README check agent** that:
   - Reads `README.md` and compares it against the spec and what was built
   - Checks if commands, features, or behaviors described in the README still match reality
   - Checks if the completed work adds anything the README should reflect
   - Returns: up-to-date (yes/no) and specific changes needed if not

   If there are only 1-2 criteria, check them directly instead of spawning agents — overhead isn't worth it.

3. **Collect results and update README.** Once all verification agents return, collect pass/fail results. If the README agent identified needed changes, apply them.

4. **Adversarial re-check.** After the initial pass, assume at least one criterion you marked as passing has a subtle gap. Re-check each passing criterion with adversarial intent — look for the 80% implementation (where the happy path works but edge cases don't).

5. **Report results** to the user:
   - List each criterion with pass/fail.
   - If something fails, explain what's wrong and suggest a fix.

6. If everything passes, update `.sno/state.json` phase to `ship`. Then tell the user: "Run `/sno:ship` to commit and ship."

**STOP.** Do not proceed to the ship phase. Do not start committing or shipping anything. Your job ends here — return control to the user. The next phase starts only when the user explicitly runs `/sno:ship`.

7. If something fails, **auto-diagnose**:
   - For each failing criterion, spawn a **debug agent per failure in parallel** (via Agent tool). Each gets:
     - The failing criterion
     - The relevant code files
     - Any test output or error messages
   - Each debug agent returns: what's wrong, why, and a concrete fix plan (specific files + changes).
   - Present all diagnoses to the user with fix plans.
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
