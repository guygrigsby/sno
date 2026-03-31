---
name: learn
description: "Understand the problem. Launch parallel research agents (Opus) for domain analysis, data modeling, and codebase scouting. Then interview for gaps. Produce a spec in .sno/spec.md."
arguments:
  - name: flags
    description: "Optional flags. Use --auto to skip confirmations and continue through all phases."
    required: false
---

You are in the **learn** phase of sno. Your goal is deep understanding before writing a single line of spec.

## What to do

### Step 0: Check state
If `.sno/state.json` doesn't exist, tell the user: "Run `/sno:new` first." and stop.

If `.sno/spec.md` already exists, read it and ask the user if they want to refine it or move on to `/sno:plan`.

### Step 1: Get the user's intent
Ask the user what they want to build — or read what they've already said. Get enough context to brief the research agents. You need at minimum:
- What is the goal?
- Any constraints they already know about?

Don't over-interview here. Get the basics, then let the agents dig.

### Step 2: Launch parallel research agents
Spawn these five agents **in parallel** using the Agent tool:

1. **prior-art-researcher** — How similar problems are solved in practice: established patterns, reference architectures, domain-specific gotchas, industry standards. Uses Opus.
2. **domain-researcher** — DDD analysis: bounded contexts, aggregates, entities, ubiquitous language, domain events. Uses Opus.
3. **data-modeler** — Entity identification, relationship mapping, 5NF normalization analysis. Uses Opus.
4. **codebase-scout** — Explores existing code for patterns, conventions, relevant modules, risks. Uses Opus.
5. **service-layer-analyst** — API boundaries, orchestration, transaction scoping, cross-cutting concerns. Uses Opus.

Give each agent the user's description of what they want to build. If there's existing context (prior conversation, existing code), include that too.

Write each agent's output to `.sno/research/`:
- `.sno/research/prior-art.md`
- `.sno/research/domain.md`
- `.sno/research/data-model.md`
- `.sno/research/codebase.md`
- `.sno/research/service-layer.md`

### Step 3: Synthesize and interview
Once all five agents return:

1. Read all five research outputs.
2. Collect ALL open questions from every agent.
3. Spawn the **requirements-interviewer** agent to synthesize and prioritize the questions.
4. Ask the user **one question at a time**. Wait for the answer before asking the next question. Each question must explain WHY it matters — what depends on the answer.
5. Record each answer in `.sno/research/answers.md` as you go.

If the user says "just pick defaults" for any question, pick a reasonable default and document it clearly as a chosen default (not a confirmed requirement).

### Step 4: Write the spec
Once all questions are resolved (or defaulted), write `.sno/spec.md`.

**Before writing, re-read every research output and every answer:**
- `.sno/research/prior-art.md` — how similar problems are solved, domain-specific patterns, architectural patterns, domain gotchas
- `.sno/research/domain.md` — bounded contexts, aggregates, factories, repositories, ports, events, open questions
- `.sno/research/data-model.md` — entities, relationships, normalization, open questions
- `.sno/research/codebase.md` — existing patterns, risks, open questions
- `.sno/research/service-layer.md` — application services, API surface, transaction boundaries, cross-cutting concerns, open questions
- `.sno/research/answers.md` — every user answer and every default chosen

Every finding from the research must land somewhere in the spec. If the prior art researcher identified domain-specific patterns or gotchas, they appear in the spec. If the domain researcher identified 4 aggregates, all 4 appear in the spec. If the data modeler flagged a 5NF violation, it's in Data Constraints. If the codebase scout found a risk, it's in Context. If the service layer analyst identified transaction boundaries or cross-cutting concerns, they're in the spec. If an answer resolved an open question, the decision appears in Decisions Log. Nothing gets silently dropped.

The spec structure:

```markdown
# Spec: <title>

## Goal
<What we're building and why, 2-3 sentences>

## Context
<What exists, what we're working with>

## Prior Art & Domain Patterns
<From prior art research — how similar problems are solved, domain-specific patterns adopted, domain gotchas to guard against>

## Domain Model

### Bounded Contexts
<From domain research — refined by user answers>

### Aggregates & Entities
<From domain research — each aggregate with its factory and repository>

### Repositories
<Repository interfaces the domain defines — persistence is abstracted>

### Infrastructure Ports
<Every external concern abstracted: storage, network, parsing, alerting, syncing, etc.>
<Each port lists its interface and known adapters>

### Domain Services
<Cross-entity behavior and coordination>

### Domain Events
<Key state transitions and triggers>

## Service Layer
### Application Services
<From service layer research — use cases, what each service coordinates, transaction boundaries>

### API Surface
<How external requests map to service operations>

### Cross-Cutting Concerns
<Auth, logging, error translation, rate limiting — where enforced and how>

## Data Model
### Entities & Relationships
<From data modeling — 5NF normalized>

### Data Constraints
- <Cardinality, nullability, uniqueness decisions>
- <Normalization decisions and rationale>

## Requirements
- <Concrete, testable requirement 1>
- <Concrete, testable requirement 2>
- ...

## Test Strategy
- **Framework/tools:** <From codebase scout — what test framework, runner, assertion library is used>
- **Patterns:** <From codebase scout — how existing tests are structured, where they live, naming conventions>
- **Required coverage:** <What must be tested: unit tests for domain logic, integration tests for ports/adapters, e2e for critical paths>
- **What to test:** <Specific behaviors derived from Requirements above — each requirement should map to at least one test>

## Done when
- [ ] <Acceptance criterion 1>
- [ ] <Acceptance criterion 2>
- ...
- [ ] All new code paths have tests
- [ ] Tests pass

## Decisions Log
- <Decision made>: <rationale> (user-confirmed | default-chosen)

## Research Coverage
<For each research output, list what was incorporated and what was intentionally excluded with rationale>
```

### Step 5: Verify coverage
Before showing the spec, cross-check:
- Every domain-specific pattern and gotcha from `prior-art.md` is addressed in Prior Art & Domain Patterns or Requirements
- Every aggregate, entity, and bounded context from `domain.md` appears in Domain Model
- Every entity and relationship from `data-model.md` appears in Data Model
- Every risk from `codebase.md` is addressed in Context or Requirements
- The codebase scout's testing approach findings (framework, patterns, conventions) are reflected in the Test Strategy section
- Every application service, transaction boundary, and cross-cutting concern from `service-layer.md` appears in Service Layer
- Every answer from `answers.md` is reflected in the spec (as a requirement, constraint, or decision)
- Every open question from all research outputs is either answered (in Decisions Log) or still explicitly open

If anything was dropped, either add it or document why it was excluded in the Research Coverage section.

### Step 6: Confirm
Show the spec to the user. When they confirm, update `.sno/state.json` phase to `plan`. Then tell the user: "Run `/sno:plan` when you're ready to break this into tasks."

**STOP.** Do not proceed to the plan phase. Do not start planning, building, or implementing anything. Your job ends here — return control to the user. The next phase starts only when the user explicitly runs `/sno:plan`.

## Rules

- **Never assume.** If the user didn't say it and you can't derive it from code, it's an open question.
- **DDD is not optional.** Every spec must identify bounded contexts and aggregates, even for small features.
- **5NF is the target.** Any denormalization must be explicitly justified, not accidental.
- **Keep the spec under 2 pages.** Domain model and data constraints replace prose — they're more precise.
- Requirements must be concrete and testable. "Good UX" is not a requirement. "User can complete checkout in under 3 clicks" is.
- Don't gold-plate. Capture what the user said. Flag what they didn't say as defaults.
- If the user says "just do X", still run the agents but be fast about it. Minimal questions, reasonable defaults, tight spec.
- The research agents use Opus because this phase is where bad assumptions compound. Cheap models here means expensive bugs later.

## --auto flag

The STOP gate above does NOT apply when `--auto` is set. With `--auto`:
- In step 1, use whatever context is already available. Don't ask the user for more — just brief the agents with what you have.
- In step 3, pick reasonable defaults for all open questions instead of interviewing the user. Document each as `(default-chosen)`.
- In step 6, skip confirmation. Write the spec and immediately advance to the plan phase. Continue through remaining phases without stopping.
- Step 5 (coverage verification) still runs — never skip it. A spec that drops research findings causes rework downstream.
