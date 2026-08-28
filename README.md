# pi-profiles

Pi extension that adds named agent profiles for different phases of coding work.

## Profiles

- `/reviewer` or `F6`: read-only review mode.
- `/planner` or `F7`: read-only planning mode with higher thinking effort.
- `/coder` or `F8`: implementation mode with editing tools enabled.
- `/profile`: show the active profile and available profile configuration.
- `/profile <name>`: activate a profile by name.
- `/profile off` or `F5`: disable the active profile and restore the previous model, thinking level, and tool selection.

Each profile sets a model, thinking level, active tools, status-bar label, and extra system instructions. Reviewer and planner profiles also block non-allowlisted tools as a safety layer.

## Install

```bash
pi install npm:@isanchez31/pi-profiles
```

Try without installing:

```bash
pi -e npm:@isanchez31/pi-profiles
```

## Dynamic configuration

Profiles are configurable. Overrides are stored in:

```text
~/.pi/agent/pi-profiles.json
```

Configure a profile from Pi:

```text
/profile set <name> <provider/model> <thinking>
```

Examples:

```text
/profile set planner openai-codex/gpt-5.6-sol xhigh
/profile set coder openai-codex/gpt-5.6-terra high
/profile set reviewer openai-codex/gpt-5.6-luna medium
```

Supported thinking levels:

```text
off, minimal, low, medium, high, xhigh, max
```

Reset one profile override:

```text
/profile reset planner
```

Reset all profile overrides:

```text
/profile reset
```

The extension also exposes a `configure_profile` tool so the assistant can configure profile models and thinking levels when you ask it to.

## Default configuration

The built-in defaults are:

- reviewer: `openai-codex/gpt-5.6-luna`, thinking `medium`
- planner: `openai-codex/gpt-5.6-sol`, thinking `xhigh`
- coder: `openai-codex/gpt-5.6-terra`, thinking `high`

## Open source

- [Contributing guidelines](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

MIT
