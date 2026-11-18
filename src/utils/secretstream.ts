import type Sodium from "libsodium-wrappers-sumo";
import type { StateAddress } from "libsodium-wrappers-sumo";

// Authenticate the end of the stream, not just its individual chunks.
export function pullChunk(
  sodium: typeof Sodium,
  state: StateAddress,
  chunk: ArrayBuffer | Uint8Array,
  last: boolean,
): Uint8Array {
  const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, new Uint8Array(chunk), null);
  const expected = last
    ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
  if (!result || result.tag !== expected) throw new Error("Invalid or incomplete encrypted file");
  return result.message;
}
