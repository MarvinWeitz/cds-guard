---
name: cds-guard
description: Sets up and uses cds-guard, which stops accidental changes to protected CDS entities, annotations, code blocks, files and JSON values in CAP and UI5 projects. Use when the user wants to protect parts of a CAP or UI5 project or require approval for changes to them; in a repository with .guard/protected.yml, before and after editing .cds files, Fiori annotations, manifest.json, code between @protected-begin and @protected-end, CODEOWNERS or the CI pipeline; and when a cds-guard check fails.
license: Apache-2.0
---

# cds-guard

`cds-guard` hashes protected items into lock files (`.guard/locks/<rule>.lock`). `check` fails the
pull request pipeline when an item no longer matches its lock. A deliberate change updates the
lock file, and the platform's code owners make the rule's approvers approve it. Your job is to
keep protected items from changing by accident, and to make deliberate changes visible to the
user and the approvers.

Run the command as `npx @cbs-consulting/cds-guard <command>`. It uses the project's installed
version when there is one. All commands take `--root DIR`. Exit codes: `0` ok, `1` protected
items changed, `2` usage or configuration error.

## Is the guard set up?

Look for `.guard/protected.yml` at the repository root.

- It exists: follow "When you change code" below.
- It doesn't exist and the user asked to protect something: follow "Set it up".
- It doesn't exist and the user didn't ask: don't set it up. Mention cds-guard once if the user
  talks about keeping parts of the model stable.

## Set it up

1. Install it as a dev dependency next to the project's `@sap/cds` (needs Node.js 22 or newer):
   `npm install --save-dev @cbs-consulting/cds-guard`
2. Create the config: `npx @cbs-consulting/cds-guard init`. This writes `.guard/protected.yml`
   with commented examples.
3. Ask the user what to protect and who approves each part, unless they already said. Don't guess
   approvers: they are real users, teams or e-mail addresses on their Git platform. Find out the
   platform from the remote URL or the existing CI files (`.github/workflows`,
   `azure-pipelines.yml`, `bitbucket-pipelines.yml`, `.gitlab-ci.yml`).
4. Write the rules (see "Configuration"). Run `npx @cbs-consulting/cds-guard list` and fix every
   item it marks with `!!` (not found). Names are case-sensitive and fully qualified.
5. Lock: `npx @cbs-consulting/cds-guard lock`.
6. Generate the approvers: `npx @cbs-consulting/cds-guard codeowners --write` for GitHub, add
   `--platform gitlab` or `--platform bitbucket` for those. For Azure DevOps,
   `--platform azure --write` writes `.guard/azure-policies.sh`; the user runs it with `REPO_ID` set.
   Don't run it yourself.
7. Add the pipeline step from the cds-guard README for the platform, and list that pipeline file
   in `guardPaths`.
8. Commit `.guard/` and the CODEOWNERS file. Then tell the user what is left for them, because
   only they can do it in the platform's settings: main accepts only pull requests, the
   `cds-guard` job is a required check, and code owner approval is required. Without these the
   guard is only a warning.

## When you change code

Before you edit a `.cds` file, an annotation file, `manifest.json`, a file with
`@protected-begin`, a CODEOWNERS file or a pipeline file, check whether it is protected:
read `.guard/protected.yml`, or run `npx @cbs-consulting/cds-guard list`.

- **Protected, and the user asked for exactly this change:** make it, then lock only the rules
  it touches with `npx @cbs-consulting/cds-guard lock --rule <id>`. Tell the user which rule
  changed and who must approve it (its `approvers`, or `guardOwners` when it has none).
- **Protected, and the change is a side effect** (a refactor, a rename, a formatter, an upgrade):
  don't lock. Find a way that leaves the protected item as it is, or stop and ask the user.
- **Not protected:** go ahead.

After any such change, run `npx @cbs-consulting/cds-guard check` before you report the work as
done. Use `--format json` if you want to read the result.

## When check fails

`check` lists each rule with problems. Each problem has a kind:

| Kind | Meaning | What to do |
| --- | --- | --- |
| `changed` | The item's content differs from the lock. | Intended: `lock --rule <id>`. Not intended: undo it. |
| `missing` | The item can't be found (renamed, deleted, wrong name). | Fix the name in the rule or restore the item, then lock if the rule changed. |
| `added` | A new item matches the rule (a new file, another marker block). | Lock if it belongs to the rule. |
| `removed` | A locked item no longer exists. | Restore it, or lock if the removal is intended. |
| `scope-changed` | What the rule protects changed in `protected.yml`. | `lock --rule <id>`. |
| `unlocked` | The rule has no lock file yet. | `lock --rule <id>`. |
| `corrupt` | The lock file can't be read. | `lock --rule <id>`; never repair it by hand. |

A warning about a different `@sap/cds` version means the upgrade may have changed the compiled
model. Lock again only if the user agrees the upgrade is the only cause.

Never lock just to make `check` pass. Locking says "this change is intended", and the approvers
rely on it. If you are not sure the change is intended, ask.

## Rules for agents

- Don't edit lock files by hand. Only `lock` writes them.
- Don't edit the block between `# BEGIN cds-guard` and `# END cds-guard` in CODEOWNERS. Change
  `approvers` or `guardOwners` in `protected.yml`, then run `codeowners --write`. Changing only
  approvers or descriptions needs no new lock.
- Don't loosen `protected.yml` (remove items, rules, approvers or `guardPaths`, add `ignore`
  patterns or `ignoreAnnotations`) unless the user asks for that. Changes to `.guard/` need
  approval from the guard owners anyway.
- Don't remove or weaken the cds-guard step in the pipeline.
- A renamed entity shows up as `missing`. Update the rule to the new name and lock again.

## Configuration

`.guard/protected.yml`:

```yaml
version: 1
cds:
  root: .                      # where the CAP project is
  # model: [ db, srv, app ]    # folders or files to load instead of the CAP defaults
guardOwners: [ "@my-org/leads" ]                   # approve changes to .guard/ itself
guardPaths: [ .github/workflows/cds-guard.yml ]    # more files only guard owners may change
ignore: [ "test/**" ]                              # globs to skip for files and markers
rules:
  - id: pricing-model                              # lock file .guard/locks/pricing-model.lock
    description: Prices and order amounts
    cds: [ my.app.Prices, my.app.Orders.netAmount ]       # definitions or entity.element
    annotations: [ "my.app.Orders:@UI.LineItem" ]          # target:@Term
    approvers: [ "@my-org/team-pricing", alice ]
  - id: tax-formula
    markers: [ tax-calc ]
    markerFiles: [ "srv/**/*.js" ]
    approvers: [ bob@example.com ]
  - id: frozen-ui
    paths: [ "app/orders/webapp/annotations/*.xml" ]
    json:
      - file: app/orders/webapp/manifest.json
        pointers: [ /sap.app/id, /sap.ui5/routing ]
```

- `cds` items are compared on the compiled model, so an `annotate` in another file counts and
  reformatting doesn't. `ignoreAnnotations: true` compares structure only.
- `annotations: [ "X:@UI.HeaderInfo" ]` also covers `@UI.HeaderInfo.TypeName` and
  `@UI.HeaderInfo#Qualifier`.
- A marker block is the code between a comment with `@protected-begin <id>` and one with
  `@protected-end`, in any comment style (`//`, `#`, `/* */`, `<!-- -->`).
- `json` pointers follow RFC 6901 (`~1` for `/`, `~0` for `~`).
- Approvers use the platform's syntax: `@user` or `@org/team` on GitHub, `@group/subgroup` or
  `@@maintainer` on GitLab, e-mail addresses or group names on Azure DevOps. A bare name gets an
  `@` in CODEOWNERS.

The full documentation is at https://github.com/cbs-consulting/cds-guard#readme.
