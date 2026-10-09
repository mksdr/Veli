// Authenticate the end of the stream, not just its individual chunks.
function pullChunk(sodium, state, chunk, last) {
  const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, new Uint8Array(chunk));
  const expected = last
    ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
  if (!result || result.tag !== expected) throw new Error("Invalid or incomplete encrypted file");
  return result.message;
}

module.exports = { pullChunk };
