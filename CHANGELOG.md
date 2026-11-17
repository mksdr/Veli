# [CHANGELOG](#changelog)

## [3.2.4](https://github.com/mksdr/Veli/compare/v3.2.3...v3.2.4) (2026-11-17)


### Bug Fixes

* **ci:** introduce conventional commits and versioned releases ([#45](https://github.com/mksdr/Veli/issues/45)) ([426fe09](https://github.com/mksdr/Veli/commit/426fe090ee58f90554d5a249608c14c4fa11f595))

## v3.2.3

- Require dependency audit, security tests, static build, and browser regression tests to pass before Docker Hub publishing.
- Ignore environment files and private key files while keeping `.env.example` trackable.

---

## v3.2.2

- Add Docker Hub publishing workflow and container deployment documentation.
- Stabilize stalled streaming cancellation and password generation browser regression tests.

---

## v3.2.1

- Configure weekly Dependabot updates for npm dependencies, Docker images, and GitHub Actions.

---

## v3.2.0

- Migrate Service Worker bundler from Browserify to esbuild to eliminate 4 vulnerabilities in the legacy `crypto-browserify` / `elliptic` dependency chain.
- Optimize Service Worker bundle size by ~38.5% (1.44 MB to 886 KB) by removing unneeded Node polyfill packages.
- Add dedicated `scripts/build-sw.js` with empty module stubs for `fs`, `path`, and `crypto` to ensure clean browser runtime compatibility for `libsodium-wrappers`.

---

## v3.1.0

- Rebrand Hatsmith as Veli with a new logo, favicons, and updated project documentation, while retaining upstream credits.
- Simplify encryption and decryption into guided file, credential, and save steps, with public-key tools available as advanced options.
- Add Korean interface and help alongside English, with updated light/dark themes, keyboard focus, and mobile layouts.
- Improve password generation, private-key backup, clipboard fallback, draft preservation, and cancellation feedback.
- Reject truncated or malformed ciphertext by requiring the authenticated final secretstream tag, while preserving the hat.sh v2 file format.
- Isolate concurrent service-worker jobs and improve download startup, backpressure, cancellation, and error handling.
- Improve Safari/mobile buffered processing, release download resources, limit file-information hashes to 32 MiB, and handle unavailable browser storage or workers.
- Update Next.js and PostCSS, require Node.js 22 or newer, and add security and cross-browser regression tests and CI.

---

## v3.0.0

- Add file info dialog
- Add passphrase generation. (Thanks to [EFF Long Word List](https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt))
- Update packages
- - Migrate from zxcvbn to [zxcvbn-ts/zxcvbn](https://github.com/zxcvbn-ts/zxcvbn) for password strength checking.
- - Update cypress to v14.4.1
- - Update Material UI to v5
- - Update to React 18
- Rebrand to Hatsmith
