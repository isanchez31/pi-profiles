# Changelog

All notable changes to this project will be documented in this file.

This project follows Conventional Commits for commit messages.

## 1.1.1 - 2026-08-28

### Changed

- Improve README with badges, project positioning, contribution ideas, and useful links.
- Add more npm keywords for discoverability.

## 1.1.0 - 2026-08-28

### Added

- Add dynamic profile configuration stored in `~/.pi/agent/pi-profiles.json`.
- Add `/profile set <name> <provider/model> <thinking>` to configure profile models and thinking levels.
- Add `/profile reset [name]` to reset one or all profile overrides.
- Add a `configure_profile` tool so the assistant can configure profiles on request.

## 1.0.1 - 2026-08-28

### Changed

- Use `gpt-5.6-sol` for the planner profile.
- Use `gpt-5.6-terra` for the coder profile.

## 1.0.0 - 2026-08-28

### Added

- Initial `pi-profiles` extension.
- Reviewer, planner, and coder profiles.
- Profile commands and function-key shortcuts.
- Profile-specific model, thinking level, tool selection, and system instructions.
- Read-only tool enforcement for reviewer and planner profiles.
