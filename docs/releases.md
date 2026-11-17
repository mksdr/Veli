# Release operations

## One-time activation

The first automated release is **3.2.4**. Versions through 3.2.3 remain in
`CHANGELOG.md`; historical commits and tags are not rewritten or backfilled.
`bootstrap-sha` records the master revision before automation was introduced.
The adoption PR must have a Conventional Commit title and this standalone footer
in its body (and therefore in its squash commit body):

```text
Release-As: 3.2.4
```

This footer only affects the first release; never copy it into later PRs. Until
the first release, avoid merging competing Release-As overrides.

### GitHub App

An account owner must create a GitHub App in GitHub developer settings. Use a
unique name such as `veli-release-automation-<owner>`, disable webhooks, and grant
repository **Contents**, **Pull requests**, and **Issues** read/write permissions
(Metadata read is implicit). No account or administration permissions are needed.
Install the App with access to **only mksdr/Veli** and generate a private key.

In this repository's **Settings → Secrets and variables → Actions**, register:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `RELEASE_APP_ID` | The App ID, not the installation ID or client ID |
| Secret | `RELEASE_APP_PRIVATE_KEY` | The complete downloaded PEM private key |
| Secret | `DOCKERHUB_TOKEN` | Read/write Docker Hub token for `mksdr/veli` |

Keep private keys and tokens out of the repository, PRs, and logs. The workflow
creates a short-lived installation token. Using the default GITHUB_TOKEN for
Release Please would prevent its PR events from automatically starting required
CI. Container publishing uses the workflow's GITHUB_TOKEN for GHCR instead.
Ensure the GHCR package grants this repository Actions write access. Private
keys can be rotated in App settings and the Actions secret without code changes.

### Merge settings and master protection

Before merging the adoption PR, set **Settings → General → Pull Requests**:

- Enable squash merging only; disable merge commits and rebase merging.
- Squash default title: **Pull request title** (`PR_TITLE`).
- Squash default message: **Pull request description** (`PR_BODY`).

In **Settings → Rules → Rulesets → Protect master**, preserve existing branch
conditions, deletion/force-push protection, PR requirement, thread resolution,
and strict/up-to-date checks. Keep squash as the only allowed merge method.
After the adoption PR's title check has run successfully, add
**conventional-pr-title** to required checks, alongside **regression** and
**Analyze (javascript)**. No App bypass is needed: release PRs pass normal CI
and are merged by a maintainer.

The GitHub integration used to prepare this change may not have administration
or Actions-secret permissions even when the signed-in user owns the repository;
those settings must then be completed by the owner. Do not merge the adoption PR
until the App credentials and squash commit body settings are ready.

## Normal release

1. Merge Conventional Commit PRs into `master` using squash.
2. The **Release** workflow accumulates the next version and changelog in a
   `chore(master): release X.Y.Z` PR. Review its version, changelog, and passing
   CI. The UI version comes from `package.json`; the release PR also updates
   `package-lock.json` and `.release-please-manifest.json`.
3. Merge the release PR. Release Please creates `vX.Y.Z` and a GitHub Release,
   then calls **Publish release containers** with that tag.
4. The publisher resolves the tag to a commit in master history, checks that the
   Release is published/stable, and tests that exact commit. Each registry then
   builds an AMD64 smoke image and publishes AMD64/ARM64 version images. GHCR
   also receives provenance. The job summaries show each registry's result.
5. Only the highest SemVer published stable GitHub Release may update `latest`.
   This deliberately uses semantic version order, not GitHub's editable
   “latest release” flag or publication date.

The existing CI status names are preserved. A release PR does not bypass audit,
security, build, browser, CodeQL, or title checks. Pre-releases and npm package
publication are not enabled. Changes to the crypto file format are independent
of the application version and are outside this automation.

## Retry and partial failure

Do not delete a GitHub Release, move its tag, or increase its version to recover
from a failed upload. From **Actions → Publish release containers → Run workflow**,
choose `master` and enter the existing release tag, for example `v3.2.4`.
Alternatively, rerun failed jobs on the original run to retry only a failed
registry. The workflow is also callable by the Release workflow; there is no
additional tag-push or release-event publisher to create duplicate uploads.

Tests rerun against the resolved release SHA. Version/tag mismatches, draft or
prerelease Releases, and tags outside master history are rejected. An existing
version image is reused without rebuilding or overwriting it only if its OCI
version and revision match the release. Its AMD64 image is smoke-tested again.
Mismatched images fail rather than silently reusing another build. GHCR attestation
and latest promotion can still be retried after an upload succeeded. Registry
authentication and transport failures fail the job rather than being treated as
a missing image. Both registry jobs run independently, so Docker Hub failure
does not cancel GHCR publication or vice versa. Rerunning older releases never
changes `latest` when a higher stable GitHub Release exists.

If App setup failed during adoption, register the credentials and run **Release**
manually on `master`. This also recovers release-PR generation after a transient
API failure. If the GitHub Release already exists but container invocation was
interrupted, use the publisher's manual retry, since Release Please will not
report the same release as newly created again. Never enable a branch-only
publisher as a workaround.
