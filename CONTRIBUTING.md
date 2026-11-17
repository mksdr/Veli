# Contributing to Veli

Use the Node version in `.nvmrc` and install dependencies with `npm ci`.
Before opening a PR, run the verification commands in the README.

## Conventional Commits

PR titles must follow Conventional Commits:

```text
<type>(<optional scope>)!: <description>
```

Scope and `!` are optional. Descriptions may be English or Korean. Allowed types:
`feat`, `fix`, `perf`, `revert`, `docs`, `style`, `refactor`, `test`, `build`, `ci`,
`chore`. Examples:

```text
feat(keys): add key export
fix(crypto): 잘린 암호문 거부
chore(deps): update development tools
chore(master): release 3.2.4
```

The `conventional-pr-title` check validates titles, including Dependabot and
release PRs. Individual branch commits do not need this format because PRs are
squashed. Use **Squash and merge**; keep the PR title as the commit title and PR
body as the commit body. Do not replace the title with a generic merge message.

## Versions and compatibility

Veli uses SemVer (`MAJOR.MINOR.PATCH`): `feat` increases MINOR; `fix` and `perf`
increase PATCH. Other types alone do not create a release. Breaking changes of
any type increase MAJOR. Mark breaking changes with `!` in the title or a
`BREAKING CHANGE:` footer in the PR body, and explain migration steps:

```text
feat(keys)!: change the key export interface

BREAKING CHANGE: Explain the compatibility change and required migration here.
```

A PR should represent one logical change. Release Please selects the largest
required bump across merged PRs. Dependabot defaults to `chore(deps)`; change its
PR title to `fix(deps): ...` for a dependency fix that needs a release, or add `!`
for an application compatibility break.

`package.json` is the source of the application version. The UI reads it directly.
Do not manually bump versions or rewrite past changelog entries. Release Please
updates package metadata, the lockfile, its manifest, and the changelog in a
release PR. Review and merge that PR when ready to publish.

Application versions do not change hat.sh file signatures or the encrypted file
format. File-format compatibility changes require explicit compatibility review.
See [Release operations](docs/releases.md) for setup and recovery.
