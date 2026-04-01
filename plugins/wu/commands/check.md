---
name: check
description: "Full verification with cipher rounds and compliance gates."
---

You are in the **check** phase of wu.

## What to do

1. **Read state and validate phase.**
   - Read `.wu/state.json`. Verify `current_phase` is one of: `check`, `risk-analysis`, `license-check`, `copyright-check`, `performance-tradeoff`, or `cipher`.
   - If the phase doesn't match, tell the user: "Current phase is **<current_phase>**. Run `/wu` to see what's next." Stop here.
   - Read `.wu/config.json` for `cipher_rounds.check`, `slop_threshold`, `skip_phases`, and `budget`.

2. **Read build summary for context.**
   - Load `.wu/summaries/build-summary.md` (or the most recent summary in `.wu/summaries/`).
   - If no summary exists, warn the user: "No build summary found. Did the build phase complete?"

3. **Pre-dispatch cost warning.**
   - This phase dispatches many agents in parallel. Warn the user:
     > "The check phase will dispatch multiple reviewer agents and run 4 compliance sub-phases. This is the most agent-intensive phase. Continue?"
   - Wait for confirmation before proceeding.

4. **Run cipher rounds** (default: 2 rounds per `config.cipher_rounds.check`).
   For each round:
   - Dispatch **GZA** (at opus tier) for cryptographic analysis — code scan + design review. If GZA finds critical crypto findings, flag them immediately before continuing.
   - Dispatch **Inspectah Deck** (quality auditor): reviews code quality, test coverage, spec adherence.
   - Dispatch **Masta Killa** (compliance reviewer): reviews for correctness, edge cases, error handling.
   - Dispatch at least **one additional reviewer** from the wu roster (e.g., Raekwon for real-world usage patterns).
   - Dispatch **ODB (chaos agent)** in parallel with the structured reviewers.

   **ODB constraints (mandatory):**
   - ODB is NEVER the sole reviewer. There must always be at least 2 structured reviewers alongside ODB.
   - ODB's output is processed separately from structured reviewers. Do not merge ODB findings into the main verdict without cross-referencing against structured reviewer output.
   - ODB findings that contradict all structured reviewers are flagged for user review, not auto-accepted.

   After each round:
   - Collect all verdicts (structured reviewers only for scoring).
   - Compute **concordance score**: percentage of findings where reviewers agree.
   - Compute **slop score**: ratio of unsupported/hallucinated claims to total claims.
   - Process ODB output separately: flag any unique insights, discard noise.
   - Log each dispatch and result to `.wu/audit.jsonl`.

5. **Run 4 compliance sub-phases.**
   Check `config.skip_phases` before each. If a sub-phase is listed there, skip it and record status as `skipped` in its phase record.

   a. **risk-analysis**
      - Dispatch agents to assess technical, operational, and security risks.
      - Produce a risk matrix: likelihood x impact for each identified risk.
      - Each risk gets a verdict: `{verdict, confidence, findings}`.
      - Write phase record to `.wu/phases/risk-analysis.json`.

   b. **license-check**
      - Scan all dependencies for license compatibility.
      - Flag any copyleft, unknown, or restrictive licenses.
      - Produce verdict per the standard schema: `{verdict, confidence, findings}`.
      - Write phase record to `.wu/phases/license-check.json`.

   c. **copyright-check**
      - Verify copyright headers exist on new/modified files.
      - Check attribution for any vendored or copied code.
      - Produce verdict: `{verdict, confidence, findings}`.
      - Write phase record to `.wu/phases/copyright-check.json`.

   d. **performance-tradeoff**
      - Analyze performance implications of the changes.
      - Flag any O(n^2) or worse algorithms, unnecessary allocations, missing caching.
      - Produce verdict: `{verdict, confidence, findings}`.
      - Write phase record to `.wu/phases/performance-tradeoff.json`.

6. **Soft budget warnings.**
   - Read `config.budget.total_tokens_used` and `config.budget.warning_threshold_tokens`.
   - If tokens used exceed 80% of the warning threshold, warn:
     > "Token usage is at <N> of <threshold> warning threshold. Consider wrapping up."
   - If tokens exceed the threshold, warn more strongly but do not block.

7. **Quality gate evaluation.**
   Aggregate all verdicts from cipher rounds and compliance sub-phases. The gate passes only if ALL of the following are true:
   - No unresolved **critical** findings across any verdict.
   - Aggregate **slop score** is below `config.slop_threshold`.
   - **Concordance** score is above 0.7 (70% agreement among structured reviewers).
   - All compliance gates passed — or were explicitly overridden by the user via `/wu:override`.

8. **If gate passes:**
   - Update `state.json`: set `current_phase` to `cipher`, then advance to `ship`.
   - Write phase record for `check` with status `passed`.
   - Tell the user: "All gates passed. Run `/wu:ship` to commit and create a PR."

9. **If gate fails:**
   - Show each failing criterion with details.
   - Offer the user three options:
     - **Fix**: go back and address the issues, then re-run `/wu:check`.
     - **Override**: use `/wu:override` to explicitly bypass specific gates (logged to audit).
     - **Abort**: abandon the cycle.
   - Wait for the user to choose. Do not auto-advance.

10. **Produce summary.**
    - Write `.wu/summaries/check-summary.md` with:
      - Cipher round results (concordance, slop scores per round).
      - Compliance sub-phase verdicts.
      - Gate pass/fail status and details.
      - ODB notable findings (separated from main results).
    - Append final check entry to `.wu/audit.jsonl`.

11. **Tell user next step.**
    - If passed: "Run `/wu:ship` to finish."
    - If failed: show the options from step 9.

STOP gate. Do not auto-advance to ship.
