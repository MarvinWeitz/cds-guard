# Security Policy

## Supported Versions

Only the latest release of cds-guard (the npm package `cds-guard` and its CI templates) receives
security fixes. Upgrade to it before you report a problem.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a Vulnerability

Do not open a public issue for a security problem. Report it privately in one of these ways:

- Through [GitHub private vulnerability reporting](https://github.com/cbs-consulting/cds-guard/security/advisories/new).
- By email to [cp_opensource@cbs-consulting.de](mailto:cp_opensource@cbs-consulting.de),
  with [administrator@cbs-consulting.de](mailto:administrator@cbs-consulting.de) in copy.

Describe the problem, the affected version and the steps to reproduce it. If you know of a fix or
a workaround, add it as well.

We confirm that we received your report within five working days and keep you informed while we
work on a fix. Once the fix is released we publish a security advisory and credit you, unless you
would rather stay anonymous.

## Scope

This policy covers the `cds-guard` CLI, its programmatic API and the CI templates in `action.yml`
and `ci/`. Examples of what is in scope:

- A change to a protected item that `cds-guard check` does not report.
- A way to change a protected item and its lock file so that the platform's required reviewers
  are not asked, when the repository is set up as the README describes.
- Generated CODEOWNERS entries or Azure DevOps policies that protect less than the configuration says.
- Repository content that makes `cds-guard` run code or write files outside the repository.

cds-guard is a merge gate, not access control: anyone can still edit protected code locally, and
anyone with the right to bypass branch rules can merge without it. Enforcing the required check
and the required reviewers is the Git platform's job; problems there belong with that platform.
