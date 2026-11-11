# Copilot instructions

Follow [AGENTS.md](../AGENTS.md) at the repository root. It holds the layout, the test commands
and the rules CI enforces.

The short version:

- Changing how items are hashed or keyed breaks every user's lock files; only on purpose.
- The tool never calls a Git platform API; platform knowledge stays in `src/codeowners.js` and the CI templates.
- Every pull request adds a user-facing line under `## Unreleased` in `CHANGELOG.md`, or gets the label `no changelog`.
- Tests copy the fixture with `project(t)` and never change it.
- Code runs on Windows, macOS and Linux with Node.js 22 or newer.
- Dependencies and GitHub Actions are pinned exactly.
