# pi-profiles

Pi extension that adds named agent profiles for different phases of coding work.

## Profiles

- `/reviewer` or `F6`: read-only review mode.
- `/planner` or `F7`: read-only planning mode with higher thinking effort.
- `/coder` or `F8`: implementation mode with editing tools enabled.
- `/profile`: show the active profile.
- `/profile off` or `F5`: disable the active profile and restore the previous model, thinking level, and tool selection.

Each profile sets a model, thinking level, active tools, status-bar label, and extra system instructions. Reviewer and planner profiles also block non-allowlisted tools as a safety layer.

## Install

```bash
pi install npm:pi-profiles
```

Try without installing:

```bash
pi -e npm:pi-profiles
```

## Configuration

The default model IDs are defined in `extensions/agent-profiles.ts`:

- reviewer: `openai-codex/gpt-5.6-luna`
- planner: `openai-codex/gpt-5.6-terra`
- coder: `openai-codex/gpt-5.6-sol`

Fork or edit the package if you want different model IDs per profile.

## Open source

- [Contributing guidelines](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

MIT
