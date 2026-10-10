# Libsodium 0.8.4 migration

Veli uses `libsodium-wrappers-sumo` 0.8.4 in the UI, utilities, and service
worker. The standard 0.8.4 package does not expose the `crypto_pwhash` API
required for password encryption. The upstream [standard versus Sumo
documentation](https://github.com/jedisct1/libsodium.js/blob/0.8.4/README.md#standard-vs-sumo-version)
describes the additional password-hashing functions in Sumo.

Next.js browser builds normalize Sodium's Node-only `node:` imports and
disable their Node built-ins. Server builds retain native Node support.
The existing esbuild service-worker bundler also stubs Node built-ins.
Both browser bundles use Sodium's browser random source.

## File compatibility

The migration preserves the existing hat.sh v2 signatures, X25519 key
exchange, XChaCha20-Poly1305 secretstream, and 64 MiB plaintext chunks.
Password files retain a 16-byte salt, a 24-byte stream header, and Argon2id
with operations limit 2, memory limit 67,108,864 bytes, and algorithm ID 2.
The derived key remains 32 bytes. Intermediate chunks use MESSAGE and the
last chunk uses FINAL, including empty files and exact chunk boundaries.

`libsodium-wrappers` and its `libsodium` dependency are pinned to 0.7.10 as
development dependencies only. `tests/helpers/legacyCrypto.js` uses this
pre-migration implementation to generate and decrypt reference files; no
application or worker module imports it. Keep these pins when updating
dependencies so compatibility tests retain an independent old implementation.

The security suite tests old-to-new and new-to-old password and public-key
files through the real worker protocol. It includes empty files, UTF-8
passwords, and a password file crossing the real 64 MiB boundary. Constants
are checked explicitly to catch accidental parameter changes.

The browser suite retains current-version round trips, checks that 0.7.10
can decrypt browser downloads, and adds decryption of 0.7.10 password and
public-key files. All five projects exercise this coverage: Chromium,
Firefox, desktop WebKit, iPhone WebKit, and iPad WebKit. They cover streaming
and buffered paths; WebKit device profiles do not replace physical iOS tests.

## Validation commands

```sh
npm ci
npm run lint
npm audit --omit=dev --audit-level=high
npm run test:security
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

The browser suite requires a static server on port 3000. Its configuration
starts `python3 -m http.server` automatically; Windows users can start a
Python static server manually and let Playwright reuse it.
