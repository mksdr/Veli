import _sodium from "libsodium-wrappers-sumo";

//compute publickey from a given privatekey
export const computePublicKey = async (privateKey: string): Promise<string> => {
  await _sodium.ready;
  const sodium = _sodium;

  const key = sodium.crypto_scalarmult_base(sodium.from_base64(privateKey));
  return sodium.to_base64(key);
};
