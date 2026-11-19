import _sodium from "libsodium-wrappers-sumo";

export interface AsymmetricKeyPair {
  publicKey: string;
  privateKey: string;
}

export const generateAsymmetricKeys = async (): Promise<AsymmetricKeyPair> => {
  await _sodium.ready;
  const sodium = _sodium;

  const keyPair = sodium.crypto_kx_keypair();
  const keys: AsymmetricKeyPair = {
    publicKey: sodium.to_base64(keyPair.publicKey),
    privateKey: sodium.to_base64(keyPair.privateKey),
  };

  return keys;
};

