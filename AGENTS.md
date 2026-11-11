# Agent instructions

Instructions for AI coding agents (Claude Code, Codex, OpenCode, Copilot and others) working in
this repository. People are welcome to read them too. What the tool does is in the
[README](README.md).

## What this repository is

`cds-guard` (npm package `cds-guard`, Node.js 22+, plain CommonJS, no build step) stops accidental
changes to protected CDS entities, elements, annotations, marker blocks, files and JSON values.
`lock` hashes each protected item into `.guard/locks/<rule>.lock`; `check` compares and fails CI.
Approval of lock file changes is left to the Git platform's own code owners, which `codeowners`
generates. The tool never calls a Git platform API.

| Path | What it is |
| --- | --- |
| `bin/cds-guard.js` | CLI entry point. |
| `src/cli.js` | Argument parsing, commands, output. |
| `src/config.js` | Loads and validates `.guard/protected.yml`. |
| `src/collect.js` | Runs all collectors for one rule; the rule's scope hash. |
| `src/cds.js` | Loads the CDS model with the project's `@sap/cds`, resolves definitions, elements and annotations. |
| `src/markers.js`, `src/files.js` | Marker blocks; files and JSON pointers. |
| `src/hash.js` | Canonical JSON and text normalisation. Changing it changes every user's hashes. |
| `src/lock.js`, `src/check.js` | Lock file writing and comparison, text and JUnit output. |
| `src/codeowners.js` | CODEOWNERS blocks and the Azure DevOps policy script. |
| `action.yml`, `ci/`, `Dockerfile` | CI templates for GitHub, Azure Pipelines, Bitbucket, GitLab and other systems. |
| `test/` | `node:test` suite; `test/fixtures/bookshop` is a small CAP project. |

## Commands

| What | Command |
| --- | --- |
| Install | `npm ci` |
| Whole suite (always run this) | `npm test` |
| One file | `node --test test/check.test.js` |
| Other `@sap/cds` major | `npm install --no-save @sap/cds@9 && npm test` |
| Try the CLI | `node bin/cds-guard.js check --root test/fixtures/bookshop` (run `lock` first) |

There is no linter or formatter configured. Match the style of the surrounding code (two spaces,
no semicolons, single quotes).

## Rules

- **Hashes are a contract.** A change to `src/hash.js`, to what goes into an item's hash, or to
  item keys (`cds:…`, `annotation:…`, `marker:…`, `file:…`, `json:…`) makes every existing lock
  file fail. Only do it on purpose, say so in the changelog, and raise the minor version.
- **No Git platform APIs.** Platform knowledge lives only in `src/codeowners.js` and the CI
  templates.
- **Use the project's `@sap/cds`.** `src/cds.js` resolves it from the project first. Don't add
  `@sap/cds` as a runtime dependency.
- **Every pull request adds a line under `## Unreleased` in `CHANGELOG.md`**, written for users,
  or gets the label `no changelog`.
- **Tests never change the fixture.** Use `project(t)` from `test/helpers.js`.
- **CI runs on Windows, macOS and Linux.** Use `path`, report paths with `/`, don't assume a POSIX
  shell in tests.
- **Dependencies are pinned exactly** (npm versions without `^`, GitHub Actions by commit SHA).
  Don't add a runtime dependency without asking; the CLI has two (`yaml`, `fast-glob`).

## Conventions

- **Writing style.** Docs, comments, messages and changelog use short, plain sentences in the
  present tense and say what happens for the user. Docstrings are one line where possible.
- **Commits and PRs.** The subject is an imperative sentence in plain words; the body says why,
  and the PR fills in `.github/pull_request_template.md`.

## Don'ts

- Don't skip, disable or loosen a test to make CI pass.
- Don't run the Release workflow, publish to npm or push tags.
- Don't commit `node_modules/`, `*.tgz` or `.env*`.
