# Release operations

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
