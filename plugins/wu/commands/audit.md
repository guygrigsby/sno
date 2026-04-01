---
name: audit
description: "Standalone compliance audit. Run license and copyright checks outside the normal flow."
---

You are running the **audit** command for wu.

## What to do

1. **Works without an active cycle.** Check if `.wu/` exists.
   - If it exists, use the existing state and audit log.
   - If it does **not** exist, create minimal state for logging:
     - Create `.wu/` directory
     - Create `.wu/audit.jsonl` (empty)
     - Do **not** create a full cycle state. This is a standalone operation.

2. **Dispatch Masta Killa via the Agent SDK CLI:**

   ```bash
   npx wu-dispatch \
     --phase license-check \
     --agents masta-killa \
     --prompt "<compliance audit scope and project context>" \
     --wu-dir .wu
   ```

   **If the CLI fails**, fall back to the local Agent tool — dispatch as `wu:masta-killa`. Log: `"Cloud dispatch failed, using local fallback."`

   Masta Killa (Compliance Specialist) runs the audit.

   Masta Killa should:
   - **Scan dependencies for license compatibility.**
     - Read package manifests (package.json, go.mod, requirements.txt, Cargo.toml, etc.).
     - Identify each dependency's license.
     - Flag incompatible licenses (e.g., GPL in an MIT project, AGPL in proprietary code).
     - Flag dependencies with no declared license.
   - **Check copyright headers.**
     - Scan source files for copyright headers.
     - Identify files missing headers (if the project uses them).
     - Check header format consistency.
   - **Produce findings using the Verdict schema.**
     - Each finding: severity (critical, high, medium, low, info), category (license, copyright), description, file/dependency affected, recommendation.

3. **Show results.** Present findings organized by:
   - **Severity breakdown:** count of findings per severity level.
   - **License compatibility matrix:** table of dependencies, their licenses, and compatibility status (compatible, incompatible, unknown).
   - **Copyright findings:** files with missing or inconsistent headers.
   - **Overall verdict:** pass, fail, or warn with summary.

4. **Log to audit trail.** Append to `.wu/audit.jsonl`:
   - Action: `"standalone-audit"`
   - Agent: `"masta-killa"`
   - Timestamp
   - Finding count by severity
   - Overall verdict
   - Duration

## Notes

- This command does not require or modify cycle state beyond the audit log.
- It can be run at any time, even between cycles or before starting one.
- If no dependency manifests are found, report that and skip the license scan.
- If no copyright convention is detected in the project, note it and skip the header check.
