# pi-profiles

[![npm version](https://img.shields.io/npm/v/@isanchez31/pi-profiles.svg)](https://www.npmjs.com/package/@isanchez31/pi-profiles)
[![npm downloads](https://img.shields.io/npm/dm/@isanchez31/pi-profiles.svg)](https://www.npmjs.com/package/@isanchez31/pi-profiles)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/isanchez31/pi-profiles?style=social)](https://github.com/isanchez31/pi-profiles/stargazers)

Dynamic reviewer, planner, and coder profiles for [Pi](https://pi.dev). Switch model, thinking level, tools, and role-specific instructions with one command or shortcut.

If this project helps your workflow, consider starring the repository and sharing feedback through issues or pull requests.

## Why use it?

- Keep separate profiles for review, planning, and implementation.
- Use safer read-only profiles for code review and planning.
- Configure model, reasoning level, and shortcuts dynamically without editing the extension source.
- Persist profile and shortcut overrides in a simple JSON file.
- Let the assistant configure profiles through the `configure_profile` and `configure_profile_shortcut` tools.

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

Update an existing installation:

```bash
pi update npm:@isanchez31/pi-profiles
```

## Dynamic configuration

Profiles and shortcuts are configurable. Overrides are stored in:

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

Configure a shortcut from Pi:

```text
/profile shortcut <name|off> <shortcut>
```

Examples:

```text
/profile shortcut reviewer f2
/profile shortcut planner f3
/profile shortcut coder f4
/profile shortcut off f12
```

Shortcut changes reload Pi automatically when configured through the command. If you edit the JSON file manually, run `/reload` or restart Pi.

Reset one profile override and shortcut:

```text
/profile reset planner
```

Reset all profile overrides:

```text
/profile reset
```

Example configuration file:

```json
{
  "profiles": {
    "planner": {
      "provider": "openai-codex",
      "model": "gpt-5.6-sol",
      "thinkingLevel": "xhigh"
    },
    "coder": {
      "provider": "openai-codex",
      "model": "gpt-5.6-terra",
      "thinkingLevel": "high"
    }
  },
  "shortcuts": {
    "off": "f5",
    "reviewer": "f6",
    "planner": "f7",
    "coder": "f8"
  }
}
```

The extension also exposes `configure_profile` and `configure_profile_shortcut` tools so the assistant can configure profile models, thinking levels, and shortcuts when you ask it to.

## Default configuration

The built-in defaults are:

- reviewer: `openai-codex/gpt-5.6-luna`, thinking `medium`
- planner: `openai-codex/gpt-5.6-sol`, thinking `xhigh`
- coder: `openai-codex/gpt-5.6-terra`, thinking `high`

## Contributing

Contributions are welcome. Good first contributions include:

- Additional profile presets.
- Better documentation and examples.
- Safer profile policies.
- Tests or validation scripts.
- Compatibility improvements for more Pi providers.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Commit messages should follow Conventional Commits.

## Open source

- [Contributing guidelines](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Links

- GitHub: https://github.com/isanchez31/pi-profiles
- npm: https://www.npmjs.com/package/@isanchez31/pi-profiles
- Pi packages: https://pi.dev/packages

## License

MIT
