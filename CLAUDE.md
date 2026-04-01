# guygrigsby-plugins

A Claude Code plugin marketplace by Guy Grigsby.

## Structure

Each plugin lives in its own directory under `plugins/`:

```
plugins/
├── sno/           # spec-driven development
│   ├── .claude-plugin/plugin.json
│   ├── commands/
│   ├── agents/
│   └── CLAUDE.md
└── wu/            # zero-slop development
    ├── .claude-plugin/plugin.json
    ├── schemas/
    ├── agents/
    └── CLAUDE.md
```

## Adding a New Plugin

1. Create `plugins/<name>/` with a `.claude-plugin/plugin.json`
2. Add commands in `plugins/<name>/commands/` and agents in `plugins/<name>/agents/`
3. Add an entry to `.claude-plugin/marketplace.json` with `git-subdir` source pointing to `plugins/<name>`
4. Add a `CLAUDE.md` in the plugin directory describing the plugin

## Plugins

- **[sno](plugins/sno/CLAUDE.md)** -- spec-driven development loop (learn, plan, build, check, ship)
- **[wu](plugins/wu/CLAUDE.md)** -- zero-slop development with persona-driven analysis and cloud-first dispatch
