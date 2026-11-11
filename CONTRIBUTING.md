# Contributing

Thank you for helping to improve cds-guard. This guide explains how to propose a change. The rules
that tests and CI enforce are collected in [AGENTS.md](AGENTS.md); they apply to people and coding
agents alike.

By taking part in this project you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). To
report a security problem, follow the [Security Policy](SECURITY.md) instead of opening an issue.

## Reporting bugs and requesting features

Search the [existing issues](https://github.com/cbs-consulting/cds-guard/issues) first. If nothing
matches, open a new issue with the bug report or feature request form. For a larger change, such
as a new kind of protected item or a new platform, open an issue before you start so we can agree
on the approach.

Remove customer names and internal details from CDS snippets before you paste them.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Install the dependencies (Node.js 22 or newer):

   ```bash
   npm ci
   ```

3. Make your change and add or update the tests for it. Tests copy the fixture project in
   `test/fixtures/bookshop` to a temporary folder (`project(t)` in `test/helpers.js`) and never
   change the fixture itself.
4. Check that everything passes:

   ```bash
   npm test
   ```

   CI runs the suite on Windows, macOS and Linux against `@sap/cds` 8, 9 and 10. To try another
   major locally: `npm install --no-save @sap/cds@9 && npm test`.

5. Update the README when the behavior or the configuration changes.
6. Add a line under "Unreleased" in [CHANGELOG.md](CHANGELOG.md) that describes the change for
   users. A pull request that changes nothing a user notices, such as a CI, test or
   documentation fix, gets the label "no changelog" instead.
7. Open a pull request against `main` and fill in the template. It needs the checks
   **Test features** and **Changelog entry**.

Do not change the version: it is raised only when a release is prepared.

## Commit messages

Write the subject as an imperative sentence in plain words, for example "Protect JSON values by
pointer", and say in the body why the change is needed. Keep each pull request to one topic.

## License

By contributing you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE), the license of this project.
