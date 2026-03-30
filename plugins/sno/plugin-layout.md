# Plugin Layout

```
sno/
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest
├── commands/
│   ├── sno.md                       # Router — /sno
│   ├── new.md                       # /sno:new (init cycle)
│   ├── learn.md                     # /sno:learn (orchestrates agents)
│   ├── plan.md                      # /sno:plan
│   ├── build.md                     # /sno:build
│   ├── check.md                     # /sno:check
│   ├── ship.md                      # /sno:ship
│   ├── go.md                        # /sno:go (quick mode)
│   └── todo.md                      # /sno:todo
├── agents/
│   ├── prior-art-researcher.md      # Prior art & industry patterns (Opus)
│   ├── domain-researcher.md         # DDD analysis (Opus)
│   ├── data-modeler.md              # 5NF data modeling (Opus)
│   ├── codebase-scout.md            # Existing code analysis (Opus)
│   ├── service-layer-analyst.md     # API boundaries & orchestration (Opus)
│   ├── requirements-interviewer.md  # Gap synthesis & interview (Opus)
│   ├── planner.md                   # Task decomposition & wave planning (Opus)
│   ├── ux-reviewer.md              # UX & interaction review (Opus)
│   ├── antipattern-detector.md     # Tech stack & domain antipatterns (Opus)
│   ├── critical-reviewer.md        # Adversarial plan review (Opus)
│   └── pr-reviewer.md              # Full PR-style code review (Opus)
├── hooks/
│   └── sno-statusline.js           # Blue/white statusline
├── .gitignore
└── CLAUDE.md
```

## How it works

Each command is a markdown file with YAML frontmatter. Claude Code discovers them automatically from the `commands/` directory. Agents are discovered from `agents/`.

The plugin prefix is `sno` (from `plugin.json` name), so `commands/learn.md` becomes `/sno:learn`.

## Learn phase agent flow

```
/sno:learn
  ├── prior-art-researcher   ─┐
  ├── domain-researcher      ─┤
  ├── data-modeler           ─┤ parallel (Opus)
  ├── codebase-scout         ─┤
  └── service-layer-analyst  ─┘
              │
              ▼
  requirements-interviewer → user Q&A → spec.md
```

## Plan phase agent flow

```
/sno:plan
  ├── planner              ─┐
  ├── ux-reviewer          ─┤ wave 1: parallel (Opus)
  └── antipattern-detector ─┘
              │
              ▼
  critical-reviewer → final plan.md
```

## Check phase agent flow

```
/sno:check
  ├── pr-reviewer              ─┐ parallel
  └── acceptance criteria check ─┘
              │
              ▼
  verdict → ship or fix
```

## Runtime state

When used in a project, sno creates a `.sno/` directory to track workflow state. This is gitignored — it's local to the developer, not committed.

```
.sno/
├── state.json          # Current phase
├── spec.md             # The spec (from learn)
├── plan.md             # Task list (from plan)
├── todos.md            # Parking lot
└── research/           # Agent outputs
    ├── prior-art.md
    ├── domain.md
    ├── data-model.md
    ├── codebase.md
    ├── service-layer.md
    └── answers.md
```
