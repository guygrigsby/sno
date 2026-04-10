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

   **Accessibility auditor agent** (`accessibility-auditor`) — also in parallel. Spawn with `subagent_type: "sno:accessibility-auditor"`. It audits the diff for WCAG 2.1 AA compliance — color contrast, keyboard navigation, screen reader support, semantic HTML, motion sensitivity. Cross-references accessibility requirements from the spec and recommendations from `.sno/research/accessibility.md` (if it exists from the plan phase). Returns a structured audit with critical issues, warnings, coverage tables, and a verdict (PASS / FAIL). Critical accessibility issues block shipping.

   **UX reviewer agent** (`ux-reviewer`, check-phase mode) — also in parallel. Spawn with `subagent_type: "sno:ux-reviewer"` and instruct it to run in **check-phase mode**. It audits the code diff against the 13 UX principles in `plugins/sno/ux-principles.md`. Returns a verdict (PASS / FAIL / WARN). Must-have principle violations (UX-P1b, UX-P3, UX-P5, UX-P7, UX-P10, UX-P11) FAIL and block shipping. Should-have violations are advisory only. Cross-references `.sno/research/ux-review.md` (the plan-phase output file) to verify that check-phase findings trace back to plan-phase coverage. If `.sno/research/ux-review.md` does not exist (backward-compat: cycle predates the UX-Pn principle set), the reviewer downgrades all findings to advisory and does not block shipping.

   **Deduper contract (ux-reviewer vs. accessibility-auditor).** Because both `ux-reviewer` and `accessibility-auditor` can surface overlapping findings (e.g., keyboard traps, focus indicators, tap-target sizes), their findings are deduplicated before the report is assembled:
   - Findings are keyed on the tuple `(file, line, category)` where `category` is a short semantic tag such as `keyboard-trap`, `focus-indicator`, or `tap-target-size`.
   - When both agents emit findings with the same `(file, line, category)` key, the **WCAG-primary** agent (`accessibility-auditor`) is the **primary owner** and wins the tiebreak — its finding is the canonical one shown in the report, and the `ux-reviewer` finding for that same key is suppressed so nothing double-fires.
   - Non-overlapping findings from either agent pass through untouched. The deduper only collapses exact `(file, line, category)` collisions; similar-but-distinct issues are still reported independently.
   - This deduplication prevents the double-fire bug identified in the plan's accessibility audit and keeps the check report crisp.

   **Test coverage agent** — also in parallel:
   - Identifies all new or modified code paths in the diff
   - Checks whether each code path has corresponding test coverage
   - Verifies that new tests actually run and pass
   - Returns: coverage assessment (complete/gaps found) and specific uncovered code paths if any

   **README check agent** — also in parallel:
   - Reads `README.md` and compares it against the spec, what was built, **and `CLAUDE.md`**
   - Checks if commands, features, agents, design principles, or behaviors described in the README still match reality
   - Checks if the completed work adds anything the README should reflect
   - Cross-references `CLAUDE.md` for drift — agents, phases, principles, or workflows documented in `CLAUDE.md` but missing or outdated in the README
   - Returns: up-to-date (yes/no) and specific changes needed if not

   If there are only 1-2 criteria, check them directly instead of spawning agents — but always spawn the PR reviewer regardless.

3. **Collect results and update README.** Once all agents return:
   - Collect pass/fail results from verification agents.
   - Collect the PR review verdict and any critical issues or warnings.
   - If a codex review was run, collect its findings alongside the PR review.
   - Collect the security audit verdict and any critical issues or warnings.
   - Collect the accessibility audit verdict and any critical issues or warnings.
   - Collect the UX reviewer verdict (check-phase) and any must-have violations. Apply the deduper contract above before presenting findings so `(file, line, category)` collisions with `accessibility-auditor` are not double-reported.
   - Collect the test coverage assessment. Missing tests on new code paths are treated as critical issues — they block shipping, same as PR review critical issues.
   - If the README agent identified needed changes, apply them.

4. **Adversarial re-check.** After the initial pass, assume at least one criterion you marked as passing has a subtle gap. Re-check each passing criterion with adversarial intent — look for the 80% implementation (where the happy path works but edge cases don't).

5. **Report results** to the user:
   - List each criterion with pass/fail.
   - If something fails, explain what's wrong and suggest a fix.
   - Show the PR review summary: verdict, critical issues, and warnings. Include file:line references.
   - Show the security audit summary: verdict, critical issues, warnings, and coverage tables.
   - Show the accessibility audit summary: verdict, critical issues, warnings, and coverage tables.
   - If a codex review was run, include its findings in the report.
   - Nits from the PR review can be listed briefly or omitted if the review is otherwise clean.

6. If everything passes **and** the PR review verdict is APPROVE or COMMENT (no critical issues) **and** the security audit verdict is PASS **and** the accessibility audit verdict is PASS **and** test coverage has no gaps on new code paths, update `.sno/state.json` phase to `ship`. Then tell the user, verbatim:

   > Check phase complete. The ship phase reads the spec and git state directly, so conversation history is no longer needed. Start the ship phase with a clean context:
   >
   >     /clear
   >     /sno:ship

   If acceptance criteria pass but the PR review returns REQUEST CHANGES, the security audit returns FAIL, or the accessibility audit returns FAIL, treat the critical issues as failures — do not advance to ship until they're resolved.

**STOP.** Do not proceed to the ship phase. Do not start committing or shipping anything. Your job ends here — return control to the user. The next phase starts only when the user explicitly runs `/sno:ship` (after `/clear`).

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
- If everything passes and the PR review verdict is APPROVE or COMMENT, **skip the `/clear` handoff** (a single run cannot clear its own context mid-execution) and immediately advance to the ship phase.
- If something fails (criteria or PR review critical issues), run auto-diagnosis. If the fix is small (< 20 lines total), apply it directly. If larger, log the failures and fix plans in `.sno/todos.md` and advance to ship anyway — don't block.
- PR review warnings are logged but don't block in `--auto` mode.
- Under `--auto`, a FAIL verdict from `ux-reviewer` check-phase on any **must-have** UX principle (UX-P1b, UX-P3, UX-P5, UX-P7, UX-P10, UX-P11) halts the cycle with the same hard-block semantics as security and accessibility failures — auto-diagnosis runs, and if the fix is not small enough to apply inline the cycle stops rather than advancing to ship. Should-have UX findings from `ux-reviewer` are logged to `.sno/todos.md` but do not block under `--auto`.
