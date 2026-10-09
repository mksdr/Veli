# Security and browser review

Reviewed on 2026-10-09 against `eb9159990080d0186e7587c2a48c3907498afa37`.
Scope: application source, dependency advisories, service-worker downloads,
and desktop Chromium/Firefox plus desktop and iPhone/iPad WebKit profiles.
This is a focused review, not a cryptographic certification or a production
deployment penetration test.

## Findings addressed

| Finding | Impact and repair |
| --- | --- |
| Decryption did not require the authenticated final secretstream tag | Removing complete trailing ciphertext chunks could leave an authenticated prefix that the app reported as a complete file. Both streaming and buffered decryption now require MESSAGE tags on intermediate chunks and FINAL on the last chunk; corruption, early FINAL, and trailing data fail. |
| One shared encryption/decryption state in the service worker | Concurrent tabs or operations could overwrite keys, stream state, and filenames. Jobs now have random operation IDs, client ownership checks, separate directions, serialized processing, cancellation, and cleanup. |
| Sensitive console logging | Worker messages could contain passwords, private keys, or plaintext; password-strength output also contained the password. These logs were removed. |
| Download startup and failure handling | Fixed startup delays, missing stream errors, and the relative `/headless/` download URL could leave failed or stalled downloads. Downloads now use absolute paths, a stream-start handshake, backpressure, and explicit failure/cancellation replies. |
| Safari/mobile resource handling | Buffered results and Blob URLs were retained; the file-information dialog read entire large files. Results are released on reset/unmount, Blob URLs are revoked after download startup, and full-file hashes are limited to 32 MiB. |
| Restricted storage and worker availability | Blocked localStorage could prevent startup, and registration did not guarantee an active controller. Storage now has an in-memory fallback; worker activation has a timeout and a protocol handshake, including safe fallback with an older worker. |
| Dependency and CI maintenance | Next.js and its PostCSS dependency were updated, Node 22 and a reproducible lockfile were specified, and unsupported CodeQL v1 actions were replaced by pinned v4 actions. Browser/security regression CI was added. |

The existing v2 signatures, Argon2id parameters, X25519 key exchange, and
64 MiB secretstream chunk format are preserved. Files legitimately generated
by the existing implementation retain their FINAL tag and remain compatible.
Files missing that tag are intentionally rejected. A streaming download may
have emitted earlier authenticated plaintext before a later failure; users
must not treat a failed or partial download as a complete decrypted file.

## Validation

- Clean `CYPRESS_INSTALL_BINARY=0 npm ci`, production build, and ESLint passed.
- Eleven Node/libsodium regression tests passed, including a real 64 MiB
  boundary, truncation/corruption, concurrent clients, cancellation, blocked
  storage, activation timeout, and worker protocol negotiation.
- Playwright tests compare actual downloaded plaintext bytes for password
  and public-key round trips, exercise `/` and `/headless/`, reject malformed
  or non-final ciphertext, and check large-file metadata and blocked storage.
  Projects cover Chromium, Firefox, desktop WebKit, iPhone 13 WebKit, and
  iPad Pro 11 WebKit. A persistent Firefox profile additionally checks its
  streaming path; ordinary isolated Firefox test contexts exercise fallback.
- `npm audit --omit=dev` reported zero known vulnerabilities on the review date.

## Remaining limits and follow-up

- WebKit device profiles are Linux automation, not physical iOS Safari.
  Before release, manually test iPhone/iPad Safari downloads to Files,
  password/public-key round trips, low-memory behavior, backgrounding,
  cancellation, private browsing, and reopening the app after a worker update.
- Buffered mode keeps the result in memory. Its 1 GiB input limit is an upper
  bound; device memory can require substantially smaller files. This change
  does not provide a streaming Safari download implementation.
- Full dependency audit still reports 14 development-tree advisories
  (7 high, 3 moderate, 4 low) in the legacy Cypress, ESLint glob, and Browserify
  crypto-polyfill chains. These need a separate toolchain migration and are
  not included in the zero production-dependency count. Browserify can bundle
  crypto polyfills; Veli's file encryption and key exchange use libsodium,
  not the affected elliptic operations. This distinction does not establish
  that the development toolchain is free of security risks.
- Repository Markdown is rendered as HTML from build-time documentation;
  it is not an untrusted file-upload rendering endpoint. Hosting headers,
  deployment credentials, extensions, and supply-chain compromise remain
  outside this code-level validation. The Docker image was not built here.
- Updated remote CodeQL and regression workflows require a GitHub Actions
  run after the PR is opened; local results do not certify remote CI success.
