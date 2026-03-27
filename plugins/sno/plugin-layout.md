# Plugin Layout

```
sno/
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest
├── commands/
│   ├── sno.md                       # Router — /sno
│   ├── learn.md                     # /sno:learn (orchestrates agents)
│   ├── plan.md                      # /sno:plan
│   ├── build.md                     # /sno:build
│   ├── check.md                     # /sno:check
│   ├── ship.md                      # /sno:ship
│   └── todo.md                      # /sno:todo
├── agents/
│   ├── domain-researcher.md         # DDD analysis (Opus)
│   ├── data-modeler.md              # 5NF data modeling (Opus)
│   ├── codebase-scout.md            # Existing code analysis (Opus)
│   └── requirements-interviewer.md  # Gap synthesis & interview (Opus)
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
  ├── domain-researcher  ─┐
  ├── data-modeler       ─┤ parallel (Opus)
  └── codebase-scout     ─┘
          │
          ▼
  requirements-interviewer → user Q&A → spec.md
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
    ├── domain.md
    ├── data-model.md
    ├── codebase.md
    └── answers.md
```
