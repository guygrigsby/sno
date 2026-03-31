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

5. **Dispatch primary agents** in parallel using the Agent tool. Each agent gets its persona prompt from `plugins/wu/agents/`, plus any cross-cycle memory loaded in step 3:
   - **GZA** (Technical Architect) — Analyze the domain. Identify bounded contexts, key entities, architectural constraints, and system boundaries. Produce a domain model.
   - **Ghostface** (Domain Researcher) — Research the problem space. Write requirements, clarify user intent, identify edge cases, and produce a draft spec.
   - **Raekwon** (Implementation Strategist) — Survey practical implementation patterns. Identify libraries, frameworks, prior art, and pragmatic tradeoffs.
   - **Masta Killa** (Compliance) — Run an initial compliance scan. Check for licensing, security, accessibility, and regulatory concerns.

6. **Show progress** as each agent completes. Print a status line:
   - `"GZA (Technical Architect) completed [1/4]"`
   - `"Ghostface (Domain Researcher) completed [2/4]"`
   - Continue until all 4 are done.

7. **Run cipher rounds** (use the count from config, default 3). For each round:
   - Dispatch **Inspectah Deck** (Quality Verifier) and **Masta Killa** (Compliance Verifier) to cross-check the primary agents' output.
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
