<p align="center">
  <img src="public/favicon.svg" width="88" alt="Veli" />
</p>

<h1 align="center">Veli</h1>

<p align="center">Protect and open files in your browser, without an account.</p>

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Current version: **v3.1.0**. See the [changelog](CHANGELOG.md) for release details.

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

Use Node.js 22 or newer.

```sh
git clone https://github.com/mksdr/Veli.git Veli
cd Veli
CYPRESS_INSTALL_BINARY=0 npm ci
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
npm run test:security
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

The browser suite covers Chromium, Firefox, desktop WebKit, and iPhone/iPad
WebKit profiles. It compares downloaded plaintext with original bytes and
rejects incomplete or tampered ciphertext. Device profiles do not replace
physical iOS Safari testing.

Read the [security and browser review](docs/security-browser-review.md) and the
[UI/UX implementation record](docs/ui-ux-implementation.md) for validation scope
and remaining follow-up. Supported translations are described in
[TRANSLATION.md](TRANSLATION.md); additional languages can be added later.

## Supporting the original project

The upstream donation link is available through
[hat.sh](https://github.com/sh-dv/hat.sh). This is support for the predecessor
project, not a Veli payment or donation flow.

## Acknowledgements and Credits

- Everyone who supported the project.
- [Samuel-lucas6](https://github.com/samuel-lucas6) from the [Kryptor](https://github.com/samuel-lucas6/Kryptor) project for being helpful and doing a lot of beta testing.
- [stophecom](https://github.com/stophecom) from the [Scrt.link](https://scrt.link/) project for translating to German.
- [bbouille](https://github.com/bbouille) for translating to French.
- [qaqland](https://github.com/qaqland) for translating to Chinese.
- [Ser-Bul](https://github.com/Ser-Bul) for translating to Russian.
- [matteotardito](https://github.com/matteotardito) for translating to Italian.
- [t0mzSK](https://github.com/t0mzSK) for translating to Slovak.
- [Xurdejl](https://github.com/Xurdejl) for translating to Spanish.
- [Franatrtur](https://github.com/Franatrtur) for translating to Czech.
- [darkao](https://github.com/darkao) for translating to Turkish.
- [Frank7sun](https://github.com/Frank7sun) for translating to Japanese.

The translation credits above include contributions inherited from earlier
projects. Veli currently ships English and Korean only; other translation
sources are retained for future expansion.

## License

Veli is licensed under the [MIT License](LICENSE). Original copyright notices
for sh-dv and contributors and mrtechtroid remain in the license, alongside
the copyright notice for Veli contributions by mksdr.
