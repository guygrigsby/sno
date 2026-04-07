---
name: risk
description: "Standalone risk assessment. Analyze risks outside the normal flow."
---

You are running the **risk** command for wu.

## What to do

1. **Works without an active cycle.** Check if `.wu/` exists.
   - If it exists, use the existing state and audit log.
   - If it does **not** exist, create minimal state for logging:
     - Create `.wu/` directory
     - Create `.wu/audit.jsonl` (empty)
     - Do **not** create a full cycle state. This is a standalone operation.

2. **Ask the user what to assess.** Do not assume scope. Ask:
   > What would you like to assess for risk?
   > - A specific change or PR
   > - The entire codebase
   > - A dependency update
   > - A migration or refactor
   > - Something else (describe it)

   Wait for the user's answer before proceeding.

3. **Dispatch GZA + Raekwon via the Messages API CLI.** Use the Bash tool. Set Bash tool timeout to 600000ms (10 minutes) for this dispatch call.

   Write the prompt to a temp file first, then pass it via `--prompt-file`:

   ```bash
   npx wu-dispatch \
     --phase risk-analysis \
     --agents gza,raekwon \
     --prompt-file /tmp/wu-dispatch-prompt.txt \
     --wu-dir .wu
   ```

   If `npx wu-dispatch` exits non-zero, show the error (exit code and stderr) to the user and **stop**. Do not attempt local dispatch as a fallback. The user must fix the issue (missing API key, network error, etc.) and re-run the command.

   Agent focus areas:
   - **GZA** (Technical Architect) — Analyze architectural risks: complexity, coupling, scalability bottlenecks, single points of failure, data integrity concerns.
   - **Raekwon** (Implementation Strategist) — Analyze practical risks: breaking changes, migration difficulty, dependency fragility, operational impact, rollback difficulty.

4. **Produce a risk matrix.** Combine findings from both agents into a structured table:

   | Risk | Category | Severity | Likelihood | Impact | Mitigation |
   |------|----------|----------|------------|--------|------------|

   Categories: architectural, implementation, operational, security, data-integrity, dependency, performance.

   Severity levels: critical, high, medium, low.

   Likelihood: certain, likely, possible, unlikely, rare.

5. **Show results using the Verdict schema.** Each finding:
   - Severity, category, description, affected area, recommended mitigation.
   - Overall risk verdict: acceptable, cautionary, unacceptable.

6. **Log to audit.** Append to `.wu/audit.jsonl`:
   - Action: `"standalone-risk"`
   - Agents: `["gza", "raekwon"]`
   - Timestamp
   - Scope assessed (what the user described)
   - Finding count by severity
   - Overall verdict
   - Duration

## Notes

- This command does not require or modify cycle state beyond the audit log.
- It can be run at any time independently of the wu loop.
- Both agents must complete before results are synthesized. Show progress as each finishes.
- If the user's scope is unclear, ask a follow-up question. Do not guess.
