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

2. **Check acceptance criteria and review code in parallel.** Spawn the following agents simultaneously (via Agent tool):

   **Verification agents** — one per criterion in the spec's "Done when" section. Each agent gets:
   - The specific criterion to verify
   - The relevant task(s) from the plan that implement it
   - The spec sections for context
   - Instructions to apply the **four-question review**:
     1. **Correctness**: Does the code actually satisfy this criterion, or does it only appear to?
     2. **Edge cases**: What happens with empty inputs, missing data, concurrent access, error paths?
     3. **Consistency**: Is the same pattern used elsewhere in the codebase? If so, does this implementation match?
     4. **Better approach**: Is there a simpler or more robust way to do this?
   - Each agent returns: pass/fail, evidence (what it checked), and any concerns.

   **PR review agent** (`pr-reviewer`) — runs in parallel with the verification agents. Spawn it with `subagent_type: "sno:pr-reviewer"`. It reviews the full diff against the base branch for code quality, security, performance, consistency, and maintainability. It returns a structured review with critical issues, warnings, nits, and a verdict (APPROVE / REQUEST CHANGES / COMMENT).

   **Codex review (conditional)** — if the codex plugin is available (the `/codex:review` skill exists in the current session), spawn it via `/codex:review` for an additional code review pass, run in parallel with the other agents. If the codex plugin is not installed, skip this silently — do not prompt the user or mention its absence.

   **Security auditor agent** (`security-auditor`) — also in parallel. Spawn with `subagent_type: "sno:security-auditor"`. It reviews the diff for security vulnerabilities, checks that security requirements from the spec are implemented, and verifies that threat mitigations from `.sno/research/security.md` are present in the code. Returns a structured audit with critical issues, warnings, coverage tables, and a verdict (PASS / FAIL). Critical security issues block shipping.

   **Test coverage agent** — also in parallel:
   - Identifies all new or modified code paths in the diff
   - Checks whether each code path has corresponding test coverage
   - Verifies that new tests actually run and pass
   - Returns: coverage assessment (complete/gaps found) and specific uncovered code paths if any

   **README check agent** — also in parallel:
   - Reads `README.md` and compares it against the spec and what was built
   - Checks if commands, features, or behaviors described in the README still match reality
   - Checks if the completed work adds anything the README should reflect
   - Returns: up-to-date (yes/no) and specific changes needed if not

   If there are only 1-2 criteria, check them directly instead of spawning agents — but always spawn the PR reviewer regardless.

3. **Collect results and update README.** Once all agents return:
   - Collect pass/fail results from verification agents.
   - Collect the PR review verdict and any critical issues or warnings.
   - If a codex review was run, collect its findings alongside the PR review.
   - Collect the security audit verdict and any critical issues or warnings.
   - Collect the test coverage assessment. Missing tests on new code paths are treated as critical issues — they block shipping, same as PR review critical issues.
   - If the README agent identified needed changes, apply them.

4. **Adversarial re-check.** After the initial pass, assume at least one criterion you marked as passing has a subtle gap. Re-check each passing criterion with adversarial intent — look for the 80% implementation (where the happy path works but edge cases don't).

5. **Report results** to the user:
   - List each criterion with pass/fail.
   - If something fails, explain what's wrong and suggest a fix.
   - Show the PR review summary: verdict, critical issues, and warnings. Include file:line references.
   - Show the security audit summary: verdict, critical issues, warnings, and coverage tables.
   - If a codex review was run, include its findings in the report.
   - Nits from the PR review can be listed briefly or omitted if the review is otherwise clean.

6. If everything passes **and** the PR review verdict is APPROVE or COMMENT (no critical issues) **and** the security audit verdict is PASS **and** test coverage has no gaps on new code paths, update `.sno/state.json` phase to `ship`. Then tell the user: "Run `/sno:ship` to commit and ship."

   If acceptance criteria pass but the PR review returns REQUEST CHANGES or the security audit returns FAIL, treat the critical issues as failures — do not advance to ship until they're resolved.

**STOP.** Do not proceed to the ship phase. Do not start committing or shipping anything. Your job ends here — return control to the user. The next phase starts only when the user explicitly runs `/sno:ship`.

7. If something fails (criteria or PR review critical issues), **auto-diagnose**:
   - For each failing criterion **and** each PR review critical issue, spawn a **debug agent per failure in parallel** (via Agent tool). Each gets:
     - The failing criterion or critical issue (with file:line from the PR review)
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
- Smallest diff that works. If the "better approach" review (question 4) finds improvements, note them for future work — don't require changes now unless correctness or security is at stake.
- Don't add new requirements during check. If you notice something that should be improved, suggest adding it to `/sno:todo`.

## --auto flag

The STOP gate above does NOT apply when `--auto` is set. With `--auto`:
- Run all checks (including PR review) and update the README without pausing.
- If everything passes and the PR review verdict is APPROVE or COMMENT, immediately advance to the ship phase and continue.
- If something fails (criteria or PR review critical issues), run auto-diagnosis. If the fix is small (< 20 lines total), apply it directly. If larger, log the failures and fix plans in `.sno/todos.md` and advance to ship anyway — don't block.
- PR review warnings are logged but don't block in `--auto` mode.
