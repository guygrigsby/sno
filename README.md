# guygrigsby-plugins

Claude Code plugins by Guy Grigsby.

## Install

```
/plugin marketplace add guygrigsby/claude-plugins
```

Then install individual plugins:

```
/plugin install <plugin>@guygrigsby-plugins
```

## Plugins

| Plugin | Description |
|--------|-------------|
| [sno](plugins/sno/) | Spec-driven development. Learn, plan, build, check, ship. |

## Adding a Plugin

1. Create a directory under `plugins/<name>/`
2. Add `.claude-plugin/plugin.json`, `commands/`, and optionally `agents/`
3. Add an entry to `.claude-plugin/marketplace.json`

## License

MIT
