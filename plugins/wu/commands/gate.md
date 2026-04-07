---
name: gate
description: "Evaluate a specific quality gate."
---

You are running the **gate** command for wu.

## What to do

1. **Works without an active cycle.** Check if `.wu/` exists.
   - If it exists, use the existing state and audit log.
   - If it does **not** exist, create minimal state for logging:
     - Create `.wu/` directory
     - Create `.wu/audit.jsonl` (empty)
     - Do **not** create a full cycle state. This is a standalone operation.

2. **Ask the user which gate to evaluate.** If no gate argument is provided, ask:
   > Which quality gate do you want to evaluate?
   > - `slop-check` — Detect filler, hallucinations, and unsupported claims
   > - `concordance` — Verify agent agreement across outputs
   > - `license` — Check dependency license compatibility
   > - `copyright` — Verify copyright headers
   > - `risk` — Assess risk profile
   > - `performance` — Evaluate performance tradeoffs

   Wait for the user's answer. Do not guess or pick a default.

3. **Dispatch appropriate agents via the Messages API CLI** based on the selected gate. Use the Bash tool. Set Bash tool timeout to 600000ms (10 minutes) for this dispatch call.

   | Gate | Agents | Focus |
   |------|--------|-------|
   | `slop-check` | Inspectah Deck | Scan outputs for filler, vague claims, unsupported assertions. Score 0-100. |
   | `concordance` | Inspectah Deck, Masta Killa | Cross-check agent outputs for agreement. Score 0-100. |
   | `license` | Masta Killa | Scan dependency licenses for compatibility issues. |
   | `copyright` | Masta Killa | Check source files for copyright header compliance. |
   | `risk` | GZA, Raekwon | Assess architectural and implementation risks. |
   | `performance` | GZA, U-God | Evaluate performance implications and tradeoffs. |

   Write the prompt to a temp file first, then pass it via `--prompt-file`:

   ```bash
   npx wu-dispatch \
     --phase gate \
     --agents <agents-for-selected-gate> \
     --prompt-file /tmp/wu-dispatch-prompt.txt \
     --wu-dir .wu
   ```

   If `npx wu-dispatch` exits non-zero, show the error (exit code and stderr) to the user and **stop**. Do not attempt local dispatch as a fallback. The user must fix the issue (missing API key, network error, etc.) and re-run the command.

4. **Evaluate gate criteria.** Each gate has pass/fail criteria:
   - `slop-check`: Pass if slop score <= 15. Fail if > 15.
   - `concordance`: Pass if concordance score >= 80. Fail if < 80.
   - `license`: Pass if no incompatible licenses found. Fail if any found.
   - `copyright`: Pass if all files comply with project convention. Fail if violations found.
   - `risk`: Pass if no critical or high-severity risks. Fail if any found.
   - `performance`: Pass if no critical performance regressions identified. Fail if any found.

5. **Show results with detailed findings.** For the evaluated gate:
   - Gate name and verdict: **PASS**, **FAIL**, or **WARN**
   - Score (if applicable)
   - Individual findings with: severity, description, location, recommendation
   - Summary of what passed and what failed

6. **Log to audit.** Append to `.wu/audit.jsonl`:
   - Action: `"standalone-gate"` or `"gate"` (depending on whether a cycle is active)
   - Gate name
   - Agents dispatched
   - Verdict: pass, fail, warn
   - Score (if applicable)
   - Finding count by severity
   - Timestamp
   - Duration

## Notes

- This command does not require cycle state beyond the audit log.
- It can be run at any time to spot-check a specific quality dimension.
- If evaluating `concordance` or `slop-check` without prior agent outputs, note that these gates are most meaningful after a phase has produced output. Offer to run against whatever content is available.
- Show agent dispatch progress as each completes.
