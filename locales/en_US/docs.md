# [Introduction](#introduction)

---
[Veli](https://github.com/mksdr/Veli) provides local file encryption and decryption in your browser, using chunked authenticated encryption.

## Project history

Veli continues [Hatsmith](https://github.com/mrtechtroid/hatsmith), maintained by mrtechtroid. Hatsmith was forked from [hat.sh](https://github.com/sh-dv/hat.sh), created by sh-dv and contributors. Veli preserves their v2 file format and credits while improving the interface and validation.

<br>

# [Features](#features)

---

### Security

- [XChaCha20-Poly1305] - for symmetric encryption.
- [Argon2id] - for password-based key derivation.
- [X25519] - for key exchange.

The libsodium library is used for all cryptographic algorithms. [Technical details here](#technical-details).

<br>

### Privacy

- The app runs locally in your browser.
- No data is ever collected or sent to anyone.​

<br>

### Functionality

- Secure encryption/decryption of files with passwords or keys.
- Secure random password generation.
- Asymmetric key pair generation.
- Authenticated key exchange.
- Password strength estimation.

<br>

# [Installation](#installation)

---

Use Node.js 22 or newer. Clone the current Veli repository and install the locked dependencies:

```bash
git clone https://github.com/mksdr/Veli.git Veli
cd Veli
CYPRESS_INSTALL_BINARY=0 npm ci
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Static hosting

```bash
npm run build
```

Serve the generated `out/` directory with a static web server. To preview it locally with Python:

```bash
python3 -m http.server 3991 --directory out
```

Open `http://localhost:3991`. Remote hosting should use HTTPS for service workers and browser APIs.

## Docker

Build and run the current source locally:

```bash
docker build -t veli:local .
docker run --rm -p 3991:80 veli:local
```

Or use the repository's Compose configuration:

```bash
docker compose up --build
```

These commands build Veli locally and do not require a published container image.

<br>

# [Usage](#usage)

---

## File Encryption

- ### using a password

1. Choose **Encrypt files** and select the files to protect.
2. Choose **Set a password**. Enter at least 12 characters, or choose a generation option and **Create a password**.
3. Keep the password somewhere safe, then choose **Review encryption**. A lost password cannot be recovered.
4. Check the selected files and protection method. Choose **Encrypt & download** in streaming mode, or **Encrypt file** followed by **Download encrypted file** in single-file mode.
5. Confirm the saved file in your browser's download list. The original file is kept.

If sharing the file, send the password through a separate channel. Veli does not send either for you.

- ### using public and private keys

1. Choose **Encrypt files**, select files, then choose **Set a password**.
2. Open **Use public keys · Advanced**.
3. Enter or load the recipient's public key and your private key. If you need a key pair, use the key generator and safely back up the private key.
4. Choose **Review encryption**, then encrypt and download as described above.
5. Share your public key with the recipient so they can decrypt the file. The public-key link and QR code contain only the public key; send the encrypted file separately.

> Never share your private key to anyone! Only public keys should be exchanged.

<br>

## File Decryption

- ### using a password

1. Choose **Decrypt files**, select the encrypted files, and choose **Check file**.
2. Enter the password used to encrypt the files.
3. In streaming mode, choose **Check password**, then **Decrypt & download**. In single-file mode, choose **Decrypt file**, then **Download decrypted file** after verification finishes.
4. Confirm the saved file in your browser's download list.

The app reports success only after verifying the whole file. If streaming fails, delete any partial download and retry with the original encrypted file.

- ### using public and private keys

1. Choose **Decrypt files**, select the encrypted files, and choose **Check file**. The file determines which credentials are needed.
2. Enter or load the sender's public key and your own private key.
3. In streaming mode, choose **Check keys**, then **Decrypt & download**. In single-file mode, choose **Decrypt file**, then **Download decrypted file**.
4. Confirm the saved file in your browser's download list.

Settings offers English and Korean. Changing language clears current inputs and results after confirmation, so save any needed result first. If clipboard access is denied, the copy dialog lets you select and copy the text manually.

<br>

# [Limitations](#limitations)

---

### File Signature

Files encrypted with Veli are identifiable by looking at the file signature that is used by the app to verify the content of a file, Such signatures are also known as magic numbers or Magic Bytes. These Bytes are authenticated and cannot be changed.

### Safari and Mobile Browsers

Safari and mobile browsers use single-file mode, with an input limit of 1 GiB. Available device memory may require a smaller file. This mode also applies when service-worker streaming is unavailable, for example in Firefox Private Browsing. Keep the page open until processing finishes.

<br>

# [Best Practices](#best-practices)

---

### Choosing Passwords

The majority of individuals struggle to create and remember passwords, resulting in weak passwords and password reuse. Password-based encryption is substantially less safe as a result of these improper practices. That's why it is recommended to use the built in password generator and use a password manager like [Bitwarden], where you are able to store the safe password.


If you want to choose a password that you are able to memorize then you should type a passphrase made of 8 words or more.

<br>

### Using public key encryption instead of a password

If you are encrypting a file that you are going to share it with someone else then you probably should encrypt it with the recipient public key and your private key.

<br>

### Sharing Encrypted Files

If you plan on sending someone an encrypted file, it is recommended to use your private key and their public key to encrypt the file.

The file can be shared in any safe file sharing app.

<br>

### Sharing the public key

Public keys are allowed to be shared, they can be sent as `.public` file or as text.

> Never share your private key to anyone! Only public keys should be exchanged.

<br>

### Storing the Public & Private keys

Make sure to store your encryption keys in a safe place and make a backup to an external storage.

Storing your private key in cloud storage is not recommended!

<br>

### Sharing Decryption Passwords

Sharing decryption password can be done using a safe end-to-end encrypted messaging app. It's recommended to use a _Disappearing Messages_ feature, and to delete the password after the recipient has decrypted the file.

> Never choose the same password for different files.

<br>

# [FAQ](#faq)

---

### Does the app log or store any of my data?

Veli processes files in your browser and does not upload file content, passwords, or private keys to a server. It stores language and appearance preferences locally.

<hr style="height: 1px">

### Is Veli free?

Yes, Veli is free and open source.
<!-- However, please consider [donating](https://github.com/sh-dv/hat.sh#donations) to support the project. -->

<hr style="height: 1px">

### Which file types are supported? Is there a file size limit?

Veli accepts all file types. There's no file size limit, meaning files of any size can be encrypted.

Safari and mobile browsers use single-file mode with a 1 GiB input limit. Device memory may require smaller files.

<hr style="height: 1px">

### I forgot my password, can I still decrypt my files?

No, we don't know your password. Always make sure to store your passwords in a password manager.

<hr style="height: 1px">

### Why does the app process one file at a time, up to 1 GiB?

Your browser uses single-file mode because streaming is unavailable or unsuitable in that environment. Available memory may require a smaller file. See [Limitations](#limitations) for more information.

<hr style="height: 1px" id="why-need-private-key">

### Is it safe to share my public key?

Yes. Public keys are allowed to be shared, they can be sent as `.public` file or as text.

But make sure to never share your private key with anyone!

<hr style="height: 1px">

### Why the app asks for my private key in the public key encryption mode?

Veli uses authenticated encryption. The sender must provide their private key, a new shared key will be computed from both keys to encrypt the file. Recipient has to provide their private key when decrypting also. this way can verify that the encrypted file was not tampered with, and was sent from the real sender.

<hr style="height: 1px">

### I have lost my private key, is it possible to recover it?

Nope. lost private keys cannot be recovered.

Also, if you feel that your private key has been compromised (e.g accidentally shared / computer hacked) then you must decrypt all files that were encrypted with that key, generate a new keypair and re-encrypt the files.

<hr style="height: 1px">

### How do I generate a keypair (Public & Private)?

You can generate keys by visit the [key generate page](/generate-keys/), make sure to [store the keys safely](#best-practices).

<hr style="height: 1px">

### Does the app measure password strength?

We use [zxcvbn-ts/zxcvbn](https://github.com/zxcvbn-ts/zxcvbn) ~~[zxcvbn](https://github.com/dropbox/zxcvbn)~~ JS implementation to check the entropy of the password input, this entropy will be converted to score that will be displayed on screen.

<hr style="height: 1px">

### Does the app connect to the internet?

Once you visit the site and the page loads, it runs only offline.

<hr style="height: 1px">

### How can I contribute?

Veli is an open-source application. You can contribute through the [current repository](https://github.com/mksdr/Veli).
<!-- [Donations](https://github.com/sh-dv/hat.sh#donations) of any size are appreciated. -->

<hr style="height: 1px">

### How do I report bugs?

Please report bugs via [Github] by opening an issue labeled with "bug".

<hr style="height: 1px">

### How do I report a security vulnerability?

Review the reporting options on [Veli's Security page](https://github.com/mksdr/Veli/security) before sharing vulnerability details.

<hr style="height: 1px">

### Why should I use Veli?

1. The app uses fast modern secure cryptographic algorithms.
2. It's super fast and easy to use.
3. It runs in the browser, no need to setup or install anything.
4. It's free opensource software and can be easily self hosted.

<hr style="height: 1px">

### When should I not use Veli?

1. If you want to encrypt a disk (e.g [VeraCrypt]).
2. If you want to frequently access encrypted files (e.g [Cryptomator]).
3. If you want to encrypt and sign files in the same tool. (e.g [Kryptor]).
4. If you prefer a command line tool (e.g [Kryptor]).
5. If you want something that adheres to industry standards, use [GPG].

<br>

# [Technical Details](#technical-details)

---

### Password hashing and Key derivation

Password hashing functions derive a secret key of any size from a password and a salt.

<br>

<!-- <div class="codeBox"> -->

```javascript
let salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
let key = sodium.crypto_pwhash(
  sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
  password,
  salt,
  sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
  sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  sodium.crypto_pwhash_ALG_ARGON2ID13
);
```

<!-- </div> -->

The `crypto_pwhash()` function derives an 256 bits long key from a password and a salt salt whose fixed length is 128 bits, which should be unpredictable.

`randombytes_buf()` is the easiest way to fill the 128 bits of the salt.

<br>

`OPSLIMIT` represents a maximum amount of computations to perform.

`MEMLIMIT` is the maximum amount of RAM that the function will use, in bytes.

<br>

`crypto_pwhash_OPSLIMIT_INTERACTIVE` and `crypto_pwhash_MEMLIMIT_INTERACTIVE` provide base line for these two parameters. This currently requires 64 MiB of dedicated RAM. which is suitable for in-browser operations.
<br>
`crypto_pwhash_ALG_ARGON2ID13` using the Argon2id algorithm version 1.3.

<br>

### File Encryption (stream)

In order to use the app to encrypt a file, the user has to provide a valid file and a password. this password gets hashed and a secure key is derived from it with Argon2id to encrypt the file.

<br>

<!-- <div class="codeBox"> -->

```javascript
let res = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
header = res.header;
state = res.state;

let tag = last
  ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
  : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;

let encryptedChunk = sodium.crypto_secretstream_xchacha20poly1305_push(
  state,
  new Uint8Array(chunk),
  null,
  tag
);

stream.enqueue(signature, salt, header, encryptedChunk);
```

<!-- </div> -->

The `crypto_secretstream_xchacha20poly1305_init_push` function creates an encrypted stream where it initializes a `state` using the key and an internal, automatically generated initialization vector. It then stores the stream header into `header` that has a size of 192 bits.

This is the first function to call in order to create an encrypted stream. The key will not be required any more for subsequent operations.

<br>

An encrypted stream starts with a short header, whose size is 192 bits. That header must be sent/stored before the sequence of encrypted messages, as it is required to decrypt the stream. The header content doesn't have to be secret because decryption with a different header would fail.

A tag is attached to each message accoring to the value of `last`, which indicates if that is the last chunk of the file or not. That tag can be any of:

1. `crypto_secretstream_xchacha20poly1305_TAG_MESSAGE`: This doesn't add any information about the nature of the message.
2. `crypto_secretstream_xchacha20poly1305_TAG_FINAL`: This indicates that the message marks the end of the stream, and erases the secret key used to encrypt the previous sequence.

The `crypto_secretstream_xchacha20poly1305_push()` function encrypts the file `chunk` using the `state` and the `tag`, without any additional information (`null`).
<br>

the XChaCha20 stream cipher Poly1305 MAC authentication are used for encryption.

`stream.enqueue()` function adds the Veli signature(magic bytes), salt and header followed by the encrypted chunks.

### File Decryption (stream)

<!-- <div class="codeBox"> -->

```javascript
let state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, key);

let result = sodium.crypto_secretstream_xchacha20poly1305_pull(
  state,
  new Uint8Array(chunk)
);

if (result) {
  let decryptedChunk = result.message;
  stream.enqueue(decryptedChunk);

  if (!last) {
    // continue decryption
  }
}
```

<!-- </div> -->

The `crypto_secretstream_xchacha20poly1305_init_pull()` function initializes a state given a secret `key` and a `header`. The key is derived from the password provided during the decryption, and the header sliced from the file. The key will not be required any more for subsequent operations.

<br>

The `crypto_secretstream_xchacha20poly1305_pull()` function verifies that the `chunk` contains a valid ciphertext and authentication tag for the given `state`.

This function will stay in a loop, until a message with the `crypto_secretstream_xchacha20poly1305_TAG_FINAL` tag is found.

If the decryption key is incorrect the function returns an error.

If the ciphertext or the authentication tag appear to be invalid it returns an error.

<br>

### Random password generation

<!-- <div class="codeBox"> -->

```javascript
let password = sodium.to_base64(
  sodium.randombytes_buf(16),
  sodium.base64_variants.URLSAFE_NO_PADDING
);
return password;
```

<!-- </div> -->

The `randombytes_buf()` function fills 128 bits starting at buf with an unpredictable sequence of bytes.

The `to_base64()` function encodes buf as a Base64 string without padding.

<br>

### Keys generation and exchange

<!-- <div class="codeBox"> -->

```javascript
const keyPair = sodium.crypto_kx_keypair();
let keys = {
  publicKey: sodium.to_base64(keyPair.publicKey),
  privateKey: sodium.to_base64(keyPair.privateKey),
};
return keys;
```
<!-- </div> -->

The `crypto_kx_keypair()` function randomly generates a secret key and a corresponding public key. The public key is put into publicKey and the secret key into privateKey. both of 256 bits.

<br>

<!-- <div class="codeBox"> -->

```javascript
let key = sodium.crypto_kx_client_session_keys(
  sodium.crypto_scalarmult_base(privateKey),
  privateKey,
  publicKey
);
```
<!-- </div> -->

Using the key exchange API, two parties can securely compute a set of shared keys using their peer's public key and their own secret key.

The `crypto_kx_client_session_keys()` function computes a pair of 256 bits long shared keys using the recipient's public key, the sender's private key.

The `crypto_scalarmult_base()` function used to compute the sender's public key from their private key.

<br>

### XChaCha20-Poly1305

XChaCha20 is a variant of ChaCha20 with an extended nonce, allowing random nonces to be safe.

XChaCha20 doesn't require any lookup tables and avoids the possibility of timing attacks.

Internally, XChaCha20 works like a block cipher used in counter mode. It uses the HChaCha20 hash function to derive a subkey and a subnonce from the original key and extended nonce, and a dedicated 64-bit block counter to avoid incrementing the nonce after each block.

<br>

### V2 vs V1

- switching to xchacha20poly1305 for symmetric stream encryption and Argon2id for password-based key derivation. instead of AES-256-GCM and PBKDF2.
- using the libsodium library for all cryptography instead of the WebCryptoApi.
- in this version, the app doesn't read the whole file in memory. instead, it's sliced into 64MB chunks that are processed one by one.
- since we are not using any server-side processing, the app registers a fake download URL (/file) that is going to be handled by the service-worker fetch api.
- if all validations are passed, a new stream is initialized. then, file chunks are transferred from the main app to the
  service-worker file via messages.
- each chunk is encrypted/decrypted on it's own and added to the stream.
- after each chunk is written on disk it is going to be immediately garbage collected by the browser, this leads to never having more than a few chunks in the memory at the same time.

<br>

[//]: # "links"
[xchacha20-poly1305]: https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction
[argon2id]: https://github.com/p-h-c/phc-winner-argon2
[x25519]: https://cr.yp.to/ecdh.html
[opensource]: https://github.com/mksdr/Veli
[bitwarden]: https://bitwarden.com/
[extending the salsa20 nonce paper]: https://cr.yp.to/snuffle/xsalsa-20081128.pdf
[soon]: https://tools.ietf.org/html/draft-irtf-cfrg-xchacha
[github]: https://github.com/mksdr/Veli
[veracrypt]: https://veracrypt.fr
[cryptomator]: https://cryptomator.org
[kryptor]: https://github.com/samuel-lucas6/Kryptor
[gpg]: https://gnupg.org
