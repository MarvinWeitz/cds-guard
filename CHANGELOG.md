# Changelog

What changed in each release of cds-guard, newest first. Add your change under "Unreleased" in
the same pull request. To release, raise the version and rename "Unreleased" to that version and
the date.

## Unreleased

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
