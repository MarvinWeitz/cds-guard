# Examples

One complete `.guard/protected.yml` per Git platform, together with what
`cds-guard codeowners` generates from it. Each example uses different kinds of rules and
different ways to name approvers, so between them they show every option.

The examples protect the small CAP project in [`test/fixtures/bookshop`](../test/fixtures/bookshop).
The test suite locks every example against it and compares the generated files, so the examples
always work with the current version.

| Platform | Config | Generated | Approvers shown |
| --- | --- | --- | --- |
| GitHub | [`github/protected.yml`](github/protected.yml) | [`CODEOWNERS`](github/CODEOWNERS) | user, team, e-mail address, fallback to `guardOwners` |
| GitLab | [`gitlab/protected.yml`](gitlab/protected.yml) | [`CODEOWNERS`](gitlab/CODEOWNERS) | user, e-mail address, group, subgroup, role (`@@maintainer`) |
| Bitbucket Cloud | [`bitbucket/protected.yml`](bitbucket/protected.yml) | [`CODEOWNERS`](bitbucket/CODEOWNERS), [`teams.yaml`](bitbucket/teams.yaml) | user, e-mail address, group with reviewer strategy, team from `teams.yaml` |
| Azure DevOps | [`azure-devops/protected.yml`](azure-devops/protected.yml) | [`azure-policies.sh`](azure-devops/azure-policies.sh) | e-mail address, project group, mix of both, fallback to `guardOwners` |

| Kind of rule | GitHub | GitLab | Bitbucket | Azure DevOps |
| --- | --- | --- | --- | --- |
| CDS entity and element (`cds`) | `pricing-model` | | `pricing-model` | `pricing-model` |
| CDS structure only (`ignoreAnnotations`) | | `schema-structure` | | `schema-structure` |
| Annotations on an entity or element | `order-ui` | `fiori-annotations` | `order-ui` | `pricing-model` |
| Code block (`markers`) | `tax-formula` | `tax-formula` | `tax-formula` | `tax-formula` |
| Whole files (`paths`) | `frozen-ui` | | `frozen-ui` | `frozen-ui` |
| JSON values (`json`) | `frozen-ui` | `app-identity` | `frozen-ui` | `frozen-ui` |

To use one, copy `protected.yml` to `.guard/protected.yml`, change the names and items to your
project's, then run `npx cds-guard lock` and the `codeowners` command below.

## GitHub

```bash
npx cds-guard codeowners --write   # updates the block in .github/CODEOWNERS
```

- `alice` becomes `@alice`. A team is `@org/team` and needs write access to the repository.
  An e-mail address works when it belongs to a GitHub account.
- Any one of the owners on a line can approve. To require a specific person, give the rule only
  that person.
- Turn on "Require review from Code Owners" for main, or the entries only add reviewers.

## GitLab

```bash
npx cds-guard codeowners --platform gitlab --write   # updates the [cds-guard] section in CODEOWNERS
```

- Users are `@user` or an e-mail address. Groups are `@group` and subgroups `@group/subgroup`;
  only direct members of the group can approve.
- Roles are `@@developer`, `@@maintainer` and `@@owner` (GitLab 17.9 and later). They mean the
  direct project members with exactly that role, so `@@developer` does not include Maintainers.
- One approval from any owner on the line is enough. Code owner approval needs GitLab Premium or
  Ultimate, and "Code owner approval" on the protected branch.

## Bitbucket Cloud

```bash
npx cds-guard codeowners --platform bitbucket --write .bitbucket/CODEOWNERS
```

- Bitbucket Cloud reads `.bitbucket/CODEOWNERS`, so pass that path to `--write`. Put
  `teams.yaml` next to it.
- Users are `@user` or an e-mail address. Groups are `@workspace/group`. Without a strategy,
  Bitbucket adds one random member of the group as reviewer.
- A strategy after the group decides who is added: `:random(2)`, `:least_busy(3)` or `:all`.
- `@teams/name` refers to a team in `.bitbucket/teams.yaml`, which lists its members and its own
  strategy. A strategy in CODEOWNERS wins over the one in `teams.yaml`.
- Make approval binding with a merge check in the branch restrictions of main (check what your
  plan offers).

## Azure DevOps

```bash
npx cds-guard codeowners --platform azure --write   # writes .guard/azure-policies.sh
REPO_ID=$(az repos show --repository my-repo --query id -o tsv) sh .guard/azure-policies.sh
```

- Azure DevOps has no CODEOWNERS. The script creates one required-reviewer branch policy per lock
  file, plus one for the guard configuration and one for each `guardPaths` entry.
- Approvers are e-mail addresses or group names as Azure DevOps shows them, such as
  `[Bookshop]\Backend Team`. Write group names in single quotes in YAML, so the backslash stays.
- For a group, the approval of one member counts.
- Run the script again after approvers change. It adds policies; remove outdated ones in the
  branch policy screen.
