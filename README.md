<p align="center">
  <img src="public/favicon.svg" width="88" alt="Veli" />
</p>

<h1 align="center">Veli</h1>

<p align="center">Protect and open files in your browser, without an account.</p>

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Veli is a web app for local file encryption and decryption. Files are processed
in your browser rather than uploaded to a server. Its interface guides you
through choosing files, entering a password or keys, and saving the result.

## Project history

Veli continues [Hatsmith](https://github.com/mrtechtroid/hatsmith), maintained by
mrtechtroid. Hatsmith was a fork of [hat.sh](https://github.com/sh-dv/hat.sh),
created by sh-dv and its contributors. Their cryptographic implementation,
file format, and open-source contributions form the foundation of Veli.

Veli preserves the hat.sh v2 file signatures and 64 MiB chunk format while
improving the interface and validation. Existing copyright notices and upstream
credits are retained. The current project is
[mksdr/Veli](https://github.com/mksdr/Veli).

## Features

- Password and public-key file encryption and decryption.
- Random passwords and memorable word combinations.
- Key-pair generation, private-key backup, and public-key links and QR codes.
- Password-strength guidance, recovery instructions, and manual copy fallback.
- English and Korean interfaces and help, with light and dark themes.
- Local processing without an account or server upload.

Veli uses libsodium for XChaCha20-Poly1305 authenticated encryption, Argon2id
password-based key derivation, and X25519 key exchange. Passwords and private
keys are not saved in browser preferences. Keep them safe: losing the required
password or private key prevents recovery of an encrypted file.

## Usage

1. Choose **Encrypt files**, select your files, and choose **Set a password**.
2. Enter a password of at least 12 characters or create one. Public-key
   encryption is available under **Use public keys · Advanced**.
3. Keep the credentials safe, review the files, then encrypt and download.
4. To open an encrypted file, choose **Decrypt files** and enter the credentials
   used for encryption.
5. Confirm the saved result in your browser's download list.

For full instructions, read the [English help](locales/en_US/docs.md) or open
**Help** in the app. If sharing a file, send its password through a separate
channel. Veli does not transfer files or credentials for you.

## Development and self-hosting

Use Node.js 26 LTS (26.13.1), as pinned in `.nvmrc`. With nvm installed:

```sh
git clone https://github.com/mksdr/Veli.git Veli
cd Veli
nvm install
nvm use
npm ci
npm run dev
```

The development app runs at `http://localhost:3000`.

For a production build:

```sh
npm run build
```

Serve the generated `out/` directory with a static web server. For a local
preview using Python:

```sh
python3 -m http.server 3991 --directory out
```

Open `http://localhost:3991`. Use HTTPS when hosting remotely so service workers
and other browser APIs are available.

To build and run a container locally:

```sh
docker build -t veli:local .
docker run --rm -p 3991:80 veli:local
```

Alternatively, run `docker compose up --build`. Both build the current source.

### Container releases

Stable releases publish AMD64 and ARM64 images to
[`mksdr/veli`](https://hub.docker.com/r/mksdr/veli) and
[`ghcr.io/mksdr/veli`](https://github.com/mksdr/Veli/pkgs/container/veli).
To run the version checked out in your project directory:

```sh
veli_version=$(node -p "require('./package.json').version")
docker run --rm -p 3991:80 "mksdr/veli:$veli_version"
# Or use "ghcr.io/mksdr/veli:$veli_version".
```

The container listens on port 80. Each registry also provides `latest` for the
newest stable release; use a version tag for reproducible deployments.

Release Please opens a PR with the next SemVer version and changelog. Merging
that PR creates a `vX.Y.Z` tag and GitHub Release, then runs the dependency audit,
lint, security tests, build, browser tests and container smoke test before
publishing. A version tag must match `package.json`. Existing version images are
not overwritten; retrying an old release does not downgrade `latest`.

See [Contributing](CONTRIBUTING.md) for commit and version rules, and
[Release operations](docs/releases.md) for GitHub App setup, repository settings,
and recovery from a partially published release. `[docker]` commit messages,
tag pushes, and branch-only manual builds no longer trigger publication.

## Browser compatibility

Desktop browsers can stream file processing and downloads. Safari, mobile
browsers, and environments without service-worker streaming use a buffered
single-file path with a 1 GiB input limit. Available memory can require much
smaller files, particularly on iPhone and iPad. File-information hashes are
calculated only for files up to 32 MiB.

Keep the page open until processing finishes. A late streaming failure may
leave a partial download; delete it and retry with the original encrypted file.

## Verification

```sh
npm run lint
npm run test:release
npm run test:security
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

The browser suite covers Chromium, Firefox, desktop WebKit, and iPhone/iPad
WebKit profiles. It compares downloaded plaintext with original bytes and
rejects incomplete or tampered ciphertext. Device profiles do not replace
physical iOS Safari testing.

## License

Veli is licensed under the [MIT License](LICENSE). Original copyright notices
for sh-dv and contributors and mrtechtroid remain in the license, alongside
the copyright notice for Veli contributions by mksdr.
