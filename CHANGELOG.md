# Changelog

What changed in each release of cds-guard, newest first. Add your change under "Unreleased" in
the same pull request. To release, raise the version and rename "Unreleased" to that version and
the date.

## Unreleased

- New `examples/` folder with a complete configuration for GitHub, GitLab, Bitbucket Cloud and
  Azure DevOps. Each one shows other kinds of rules and how the platform names users, groups,
  teams and roles as approvers.
- Docs, CI templates and the hint that `check` prints now run `npx @cbs-consulting/cds-guard`.
  A plain `npx cds-guard` outside a project that has the package installed fetches the unscoped
  `cds-guard` package from npm, which is not this tool.

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
