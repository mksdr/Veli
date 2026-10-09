const { pullChunk } = require("./secretstream");

async function decryptFile(sodium, file, state, start, chunkSize = 64 * 1024 * 1024) {
  const chunks = [];
  try {
    if (file.size < start + sodium.crypto_secretstream_xchacha20poly1305_ABYTES) {
      throw new Error("Incomplete encrypted file");
    }
    const encryptedChunkSize = chunkSize + sodium.crypto_secretstream_xchacha20poly1305_ABYTES;
    for (let offset = start; offset < file.size; offset += encryptedChunkSize) {
      const end = Math.min(offset + encryptedChunkSize, file.size);
      const chunk = await file.slice(offset, end).arrayBuffer();
      chunks.push(pullChunk(sodium, state, chunk, end === file.size));
    }
    return chunks;
  } catch (error) {
    chunks.forEach(chunk => sodium.memzero(chunk));
    throw error;
  }
}

module.exports = { decryptFile };
