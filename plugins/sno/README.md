# sno

> Named after [Sno\[w\] Tha Product](https://www.snowthaproduct.com/) because she just handles business.

A lightweight Claude Code plugin for spec-driven development. No bloat, no ceremony -- just a loop.

## Install

```
/plugin marketplace add guygrigsby/claude-plugins
/plugin install sno@guygrigsby-plugins
```

## The Loop

```
init -> learn -> plan -> build -> check -> ship
```

| Command | What it does |
|---------|-------------|
| `/sno:new` | Start a new cycle. Pulls latest, creates a branch, archives previous cycle. |
| `/sno:learn` | Understand the problem. Parallel Opus agents research the domain, data model, and codebase. Then asks you targeted questions. Produces a spec. |
| `/sno:plan` | Break the spec into structured tasks with verify/done criteria per task |
| `/sno:build` | Execute tasks in parallel waves with per-wave commits |
| `/sno:check` | Verify work against the spec. Auto-diagnoses failures with debug agents. |
| `/sno:ship` | Commit remaining changes and ship |
| `/sno:go` | Quick mode -- skip the ceremony for small tasks |
| `/sno:todo` | Parking lot for later |
| `/sno` | Where am I? Routes to the next step. |

## Design Principles

- **DDD always.** Every spec identifies bounded contexts, aggregates, factories, and repositories.
- **5NF target.** Data models normalize fully. Denormalization requires justification.
- **No assumptions.** Ambiguity becomes an open question, not a guess.
- **Extensibility first.** Storage, network, parsing, alerting, syncing -- all abstracted as ports.

## License

MIT
