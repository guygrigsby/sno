---
name: cipher
description: "Manually trigger a cipher round with configurable reviewers."
---

You are running a standalone **cipher** round in wu.

This command can be run at any time during the wu lifecycle. It does NOT advance any phase -- it is a standalone verification tool for on-demand cross-agent review.

## What to do

1. **Check for wu state (optional).**
   - If `.wu/state.json` exists, read it for context (current phase, config, slop threshold).
   - If it doesn't exist, that's fine -- cipher can run independently. Use defaults.
   - Read `.wu/config.json` if available for `slop_threshold` and other settings.

2. **Ask the user: what artifact should be verified?**
   - Prompt: "What should the cipher round review? Provide one of:"
     - A file path or list of file paths
     - A PR diff (e.g., `gh pr diff <number>`)
     - A spec section (e.g., `.wu/summaries/learn-summary.md`)
     - A code snippet or concept to evaluate
   - Wait for the user's answer. Do not guess.

3. **Ask which reviewers to use.**
   - Default panel: **Inspectah Deck** (quality auditor) + **Masta Killa** (compliance).
   - Optional additions the user can request:
     - **GZA** (architecture and design)
     - **Raekwon** (real-world usage and edge cases)
     - **Ghostface Killah** (narrative coherence and documentation)
     - **Method Man** (integration and interop)
     - **RZA** (final arbiter, tiebreaker)
     - **ODB** (chaos agent -- remember constraints below)
   - Ask: "Use default reviewers (Inspectah Deck + Masta Killa), or add others?"
   - Wait for the user's answer.

   **ODB constraints (mandatory if ODB is selected):**
   - ODB is NEVER the sole reviewer. If the user tries to run cipher with only ODB, add at least Inspectah Deck + Masta Killa automatically and inform the user.
   - ODB output is always processed separately from structured reviewers.

4. **Ask for slop threshold.**
   - Default: from `config.slop_threshold` if available, otherwise 0.3.
   - Ask: "Slop threshold is set to <default>. Change it? (Enter a number 0.0-1.0, or press enter to keep default)"
   - Wait for the user's answer.

5. **Run cryptographic analysis via the Agent SDK CLI.**

   ```bash
   npx wu-dispatch \
     --phase cipher \
     --agents gza \
     --model opus \
     --prompt "<artifact content for crypto analysis>" \
     --wu-dir .wu
   ```

   **If the CLI fails**, fall back to local Agent tool dispatch using `wu:gza`. Log: `"Cloud dispatch failed, using local fallback."`

   GZA performs a dual-pass cryptographic analysis of the artifact:
     - **Code scan**: weak/deprecated algorithms, hardcoded secrets, insufficient key lengths, bad TLS config, insecure RNG, timing-vulnerable comparisons.
     - **Design review**: custom crypto vs established libraries, key management architecture, encryption at rest/in transit coverage, protocol-level flaws (replay, missing nonces, no forward secrecy), threat model alignment.
   - GZA produces a verdict with crypto-specific findings using the standard schema.
   - If GZA finds **critical** crypto findings, flag them immediately before continuing to the reviewer dispatch — the user may want to abort early.
   - If the artifact contains no cryptographic code or usage, GZA reports `verdict: "pass"` with an info-level finding: "No cryptographic usage detected in artifact."

6. **Dispatch the selected reviewers via the Agent SDK CLI.**

   ```bash
   npx wu-dispatch \
     --phase cipher \
     --agents <selected-reviewer-aliases> \
     --prompt "<artifact content for review>" \
     --wu-dir .wu
   ```

   **If the CLI fails**, fall back to local Agent tool dispatch. Each reviewer runs in parallel.
   - Each reviewer produces a verdict using the standard schema:
     ```json
     {
       "verdict": "pass|fail|conditional_pass|inconclusive",
       "confidence": 0.0-1.0,
       "findings": [
         {
           "severity": "critical|high|medium|low|info",
           "description": "...",
           "location": "file:line or section reference",
           "recommendation": "..."
         }
       ]
     }
     ```
   - If ODB is in the panel, dispatch in parallel but hold output for separate processing.

7. **Collect verdicts, compute concordance and slop score.**
   - **Concordance**: percentage of findings where 2+ structured reviewers agree.
   - **Slop score**: average slop score across structured reviewers (exclude ODB and GZA crypto analysis from this calculation).
   - Track per-reviewer breakdown.
   - Include GZA's crypto verdict as a separate section in the results — it is not averaged into concordance/slop but is a hard gate (any critical crypto finding = cipher round fails).

8. **Resolve conflicts.**
   If reviewers disagree on a finding:
   - **Quorum rule**: if a majority of structured reviewers agree, that verdict wins.
   - **RZA tiebreaker**: if no quorum and RZA is in the panel, RZA's verdict wins.
   - **User decides**: if no quorum and no RZA, present the conflict to the user and ask them to decide.
   - Record the resolution method for each conflict.
   - Crypto findings from GZA are not subject to quorum — they stand unless the user explicitly overrides via `/wu:override`.

9. **Present results.**
   Show a structured report:
   - **Overall**: passed/failed, concordance score, aggregate slop score.
   - **Cryptographic analysis** (from GZA): code scan findings, design review findings, crypto verdict. This section always appears, even if "No cryptographic usage detected."
   - **Per-reviewer verdicts**: each reviewer's pass/fail and issue list.
   - **Conflicts and resolutions**: any disagreements and how they were resolved.
   - **ODB insights** (if ODB was used): listed separately under their own heading, with a note that these are from the chaos agent and should be evaluated independently.
   - **Slop check**: whether the aggregate slop score is below the threshold.

10. **Log to audit.**
    - If `.wu/audit.jsonl` exists, append an entry:
      ```json
      {
        "event": "cipher_round",
        "timestamp": "<ISO 8601>",
        "artifact": "<what was reviewed>",
        "reviewers": ["<names>"],
        "crypto_analyst": "gza",
        "crypto_verdict": "pass|fail|conditional_pass",
        "concordance": 0.0-1.0,
        "slop_score": 0.0-1.0,
        "passed": true|false,
        "phase_context": "<current phase or 'standalone'>"
      }
      ```

This command does NOT advance any phase. It is a tool for verification on demand.
