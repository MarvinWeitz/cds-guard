# Changelog

What changed in each release of cds-guard, newest first. Add your change under "Unreleased" in
the same pull request. To release, raise the version and rename "Unreleased" to that version and
the date.

## Unreleased

- New `examples/` folder with a complete configuration for GitHub, GitLab, Bitbucket Cloud and
  Azure DevOps. Each one shows other kinds of rules and how the platform names users, groups,
  teams and roles as approvers.
- `check` now fails when a generated CODEOWNERS block or `.guard/azure-policies.sh` no longer
  matches `protected.yml`, so a changed approver list can't be forgotten. After upgrading, run
  `cds-guard codeowners --write` once: the block now also gives the guard owners the CODEOWNERS
  file itself. `cds-guard codeowners --check` runs only this comparison.
- `check --base REF` shows how each changed item looked at a git ref, as a short diff under the
  finding. The GitHub Action and the CI templates pass the pull request's target branch.
- `check --format github` and `--format azure` mark each finding on its file and line in the
  pull request, and `--codequality FILE` writes a GitLab Code Quality report. The GitHub Action,
  the Azure Pipelines template and the GitLab template use them.
- `lock` lists what changed in each lock file and leaves lock files without changes untouched.
- `codeowners --platform bitbucket --write` writes `.bitbucket/CODEOWNERS`, where Bitbucket
  reads it. An existing `CODEOWNERS` in the repository root is still checked.
- The Azure DevOps policy script replaces the policies of earlier runs, so it can run again after
  approvers change.
- Each release moves the `v0` tag that `uses: cbs-consulting/cds-guard@v0` points at.
- There is no Docker image any more. CI systems without Node.js run `npx @cbs-consulting/cds-guard
  check` in a `node:22` container, after `npm ci` so the project's own `@sap/cds` is used.

## 0.1.1 - 2026-11-11

- The package is now published from the release workflow, with npm provenance that links each
  version to the commit and workflow run that built it.

## 0.1.0 - 2026-11-11

- Published on npm as `@cbs-consulting/cds-guard`; the command stays `cds-guard`.
- First version. `cds-guard check` fails a pipeline when a protected CDS entity, element or
  annotation, a code block between `@protected-begin` and `@protected-end`, a file or a value in a
  JSON file changes without its lock file being updated.
- `cds-guard lock` writes one lock file per rule to `.guard/locks/`. Changing a protected item
  means updating its lock file, and the lock file needs approval from the rule's approvers.
- `cds-guard codeowners` writes those approvers to CODEOWNERS for GitHub, GitLab and Bitbucket,
  or prints `az repos policy` commands for Azure DevOps.
- `cds-guard init` creates `.guard/protected.yml`, and `cds-guard list` shows every protected item.
- `check --format json` and `--format junit` for pipelines that show test results.
- Ready-made CI steps for GitHub Actions, Azure Pipelines, Bitbucket Pipelines and GitLab CI.
- Works the same on Windows, macOS and Linux: messages show paths with `/`, and line endings do not change hashes.
