import type Sodium from "libsodium-wrappers-sumo";
import type { StateAddress } from "libsodium-wrappers-sumo";
import { pullChunk } from "./secretstream.ts";

export async function decryptFile(
  sodium: typeof Sodium,
  file: Blob,
  state: StateAddress,
  start: number,
  chunkSize = 64 * 1024 * 1024,
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
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
