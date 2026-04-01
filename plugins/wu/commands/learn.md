---
name: learn
description: "Research phase. Dispatch Wu-Tang agents for parallel domain analysis with cipher verification."
---

You are in the **learn** phase of wu.

## What to do

1. Read `.wu/state.json` and verify `current_phase` is `"learn"`. If not, tell the user which phase they are actually in and stop.

2. Read `.wu/config.json` for:
   - Model overrides per agent
   - Cipher round count (default 3 for learn)
   - Budget threshold
   - Any disabled agents

3. **Load cross-cycle memory.** Check if `.wu/memory/` contains any files. If it does, read all `.md` files in that directory and include their content as context for the primary agents. This is human-curated knowledge from previous cycles — never auto-written, always valuable. If `.wu/memory/` is empty or doesn't exist, skip this step silently.

4. **Pre-dispatch cost/duration warning.** Before dispatching any agents:
   - Count the number of agents to dispatch (4 primary + 2 cipher agents × cipher rounds).
   - Note the model tier each agent will use (from config overrides or defaults).
   - Present a summary table: agent name, model tier, estimated cost tier (low/medium/high).
   - Ask the user for explicit confirmation before proceeding. Do not proceed without it.

5. **Dispatch primary agents via the Agent SDK CLI.** Build the prompt from the user's task description plus any cross-cycle memory from step 3. Then run:

   ```bash
   npx wu-dispatch \
     --phase learn \
     --agents gza,ghostface,raekwon,masta-killa \
     --prompt "<the prompt you built>" \
     --wu-dir .wu
   ```

   This fans out 4 agents in parallel on Anthropic's infrastructure via the Agent SDK. The CLI outputs JSON results to stdout and progress to stderr.

   **If the CLI fails** (missing API key, network error, SDK unavailable), fall back to the local Agent tool — dispatch each agent as a subagent with `subagent_type` matching its alias (e.g., `wu:gza`, `wu:ghostface`). Log a warning: `"Cloud dispatch failed, using local fallback."` Each agent gets its persona from `plugins/wu/agents/`, plus:
   - **GZA** (Technical Architect) — Analyze the domain. Identify bounded contexts, key entities, architectural constraints, and system boundaries.
   - **Ghostface** (Domain Researcher) — Research the problem space. Write requirements, clarify user intent, identify edge cases.
   - **Raekwon** (Implementation Strategist) — Survey practical implementation patterns, libraries, frameworks, prior art.
   - **Masta Killa** (Compliance) — Run an initial compliance scan for licensing, security, accessibility.

6. **Show progress** as each agent completes. The CLI prints progress to stderr automatically. If using local fallback, print:
   - `"GZA (Technical Architect) completed [1/4]"`
   - `"Ghostface (Domain Researcher) completed [2/4]"`
   - Continue until all 4 are done.

7. **Run cipher rounds** (use the count from config, default 3). For each round, dispatch via the CLI:

   ```bash
   npx wu-dispatch \
     --phase learn \
     --agents inspectah-deck,masta-killa \
     --prompt "<primary agent outputs for cross-check>" \
     --wu-dir .wu
   ```

   If CLI fails, fall back to local Agent tool dispatch. Inspectah Deck and Masta Killa cross-check the primary agents' output.
   - They should detect conflicts, assess confidence, and compute:
     - **Concordance score**: how much the agents agree (0-100).
     - **Slop score**: how much output looks like filler or hallucination (0-100, lower is better).
   - Show cipher round progress: `"Cipher round 1/3 complete — concordance: 87, slop: 12"`.

8. **Resolve conflicts** detected during cipher rounds:
   - **Low severity** — Log the conflict, no action needed.
   - **Medium severity** — Run a quorum vote among the primary agents.
   - **High severity** — Escalate to RZA (Orchestrator) for a decision.
   - **Unresolvable** — Present the conflict to the user and ask for direction.

9. **Produce summary.md** for context handoff:
   - Synthesize all agent outputs into a single summary.
   - Write to `.wu/phases/learn/summary.md`.
   - Hard cap: 2000 characters. Be dense and precise.
   - Include: domain model, key requirements, constraints, risks, compliance notes.

10. **Log all dispatches** to the audit trail:
    - Append to `.wu/audit.log` (or `.wu/audit.jsonl`).
    - Each entry: timestamp, agent alias, phase, duration, status, model used.

11. **Advance phase** — Update `current_phase` to `"plan"` in `.wu/state.json`.

12. Tell the user:
    > Learn phase complete. Run `/wu:plan` to break the spec into tasks.

## STOP gate

Do **not** proceed to the plan phase automatically. The user must invoke `/wu:plan` explicitly.
