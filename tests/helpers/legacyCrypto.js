// Keep the exact pre-upgrade implementation as a test-only compatibility oracle.
const sodium = require("libsodium-wrappers");
const chunkSize = 64 * 1024 * 1024;

function passwordKey(password, salt) {
  return sodium.crypto_pwhash(32, password, salt, 2, 67108864, 2);
}

async function encryptLegacy(plaintext, password, keys) {
  await sodium.ready;
  const salt = keys ? null : sodium.randombytes_buf(16);
  const key = keys
    ? sodium.crypto_kx_client_session_keys(keys.sender.publicKey, keys.sender.privateKey, keys.receiver.publicKey).sharedTx
    : passwordKey(password, salt);
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  const chunks = [];
  for (let offset = 0; offset < plaintext.length || offset === 0; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, plaintext.length);
    chunks.push(sodium.crypto_secretstream_xchacha20poly1305_push(
      state, plaintext.subarray(offset, end), null, end === plaintext.length ? 3 : 0
    ));
  }
  sodium.memzero(key);
  return Buffer.concat([
    Buffer.from(keys ? "hTWKbfoikeg" : "zDKO6XYXioc"),
    ...(salt ? [Buffer.from(salt)] : []), Buffer.from(header), ...chunks.map(chunk => Buffer.from(chunk)),
  ]);
}

async function decryptLegacy(bytes, password, keys) {
  await sodium.ready;
  const start = keys ? 35 : 51;
  const key = keys
    ? sodium.crypto_kx_server_session_keys(keys.receiver.publicKey, keys.receiver.privateKey, keys.sender.publicKey).sharedRx
    : passwordKey(password, bytes.subarray(11, 27));
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(bytes.subarray(start - 24, start), key);
  sodium.memzero(key);
  const chunks = [];
  for (let offset = start; offset < bytes.length; offset += chunkSize + 17) {
    const end = Math.min(offset + chunkSize + 17, bytes.length);
    const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, bytes.subarray(offset, end));
    if (!result || result.tag !== (end === bytes.length ? 3 : 0)) throw new Error("Invalid legacy file");
    chunks.push(Buffer.from(result.message));
  }
  if (!chunks.length) throw new Error("Missing final chunk");
  return Buffer.concat(chunks);
}

module.exports = { encryptLegacy, decryptLegacy, chunkSize };
