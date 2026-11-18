import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useDropzone } from "react-dropzone";
import _sodium, { type StateAddress } from "libsodium-wrappers-sumo";
import FileWorkflow, { type EncryptionMethod, type PasswordGenerationKind } from "../FileWorkflow";
import { getTranslations as t } from "../../../locales";
import { generatePassword, generatePassPhrase } from "../../utils/generatePassword";
import { computePublicKey } from "../../utils/computePublicKey";
import { downloadBlob } from "../../utils/downloadBlob";
import { MAX_FILE_SIZE, SIGNATURES, CHUNK_SIZE, encoder } from "../../config/Constants";

let file: File | null = null,
  limitedIndex: number | null = null,
  limitedSalt: Uint8Array | null = null,
  limitedKey: Uint8Array | null = null,
  limitedState: StateAddress | null = null,
  limitedHeader: Uint8Array | null = null,
  limitedEncFileBuff: Uint8Array[] | null = null,
  encRx: Uint8Array | null = null,
  encTx: Uint8Array | null = null;

export interface LimitedEncryptionPanelProps {
  active?: boolean;
}

const LimitedEncryptionPanel = ({ active = true }: LimitedEncryptionPanelProps) => {
  useEffect(() => () => { limitedEncFileBuff = null; limitedState = null; file = null; encRx = null; encTx = null; }, []);
  const [operationError, setOperationError] = useState(false);
  const handleOperationError = () => {
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    limitedEncFileBuff = null;
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    limitedState = null;
    setIsEncrypting(false);
    setOperationError(true);
  };

  const router = useRouter();

  const query = router.query;

  const [activeStep, setActiveStep] = useState(0);

  const [File, setFile] = useState<File | undefined>();

  const [largeFile, setLargeFile] = useState(false);

  const [Password, setPassword] = useState<string | undefined>();

  const [PublicKey, setPublicKey] = useState<string | undefined>();

  const [PrivateKey, setPrivateKey] = useState<string | undefined>();

  const [wrongPublicKey, setWrongPublicKey] = useState(false);

  const [wrongPrivateKey, setWrongPrivateKey] = useState(false);

  const [keysError, setKeysError] = useState(false);

  const [keysErrorMessage, setKeysErrorMessage] = useState<string | undefined>();

  const [shortPasswordError, setShortPasswordError] = useState(false);

  const [encryptionMethod, setEncryptionMethod] = useState<EncryptionMethod>("secretKey");

  const [isEncrypting, setIsEncrypting] = useState(false);

  const [shareableLink, setShareableLink] = useState<string | undefined>();

  const [pkAlert, setPkAlert] = useState(false);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (acceptedFile) => {
      handleLimitedFileInput(acceptedFile[0]);
    },
    noClick: true,
    noKeyboard: true,
    disabled: activeStep !== 0 || isEncrypting,
  });

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setShortPasswordError(false);
  };

  const handleRadioChange = (method: EncryptionMethod) => {
    setEncryptionMethod(method);
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setShortPasswordError(false);
  };

  const handleReset = () => {
    setLargeFile(false);
    setOperationError(false);
    limitedKey = null;
    limitedState = null;
    setActiveStep(0);
    setFile(undefined);
    setPassword(undefined);
    setIsEncrypting(false);
    setPublicKey(undefined);
    setPrivateKey(undefined);
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setShortPasswordError(false);
    setShareableLink(undefined);
    setPkAlert(false);
    file = null;
    limitedEncFileBuff = null;
    limitedIndex = null;
    encRx = null;
    encTx = null;
    router.replace(router.pathname);
  };

  const handleMethodStep = () => {
    if (encryptionMethod === "secretKey") {
      if (Password && Password.length >= 12) {
        setActiveStep(2);
      } else {
        setShortPasswordError(true);
      }
    }

    if (encryptionMethod === "publicKey") {
      const mode: "test" | "derive" = "test";
      const privateKey = PrivateKey;
      const publicKey = PublicKey;
      encKeyPair(privateKey, publicKey, mode);
    }
  };

  const generatedPassword = async (kind: PasswordGenerationKind) => {
    const generated = await (kind === "words" ? generatePassPhrase() : generatePassword());
    setPassword(generated);
    setShortPasswordError(false);
  };

  const handleLimitedFileInput = (selectedFile?: File) => {
    if (!selectedFile) return;
    setOperationError(false);
    file = selectedFile;

    if (file.size > MAX_FILE_SIZE) {
      setLargeFile(true);
      setFile(undefined);
    } else {
      setFile(selectedFile);
      setLargeFile(false);
    }
  };

  const handlePasswordInput = (selectedPassword: string) => {
    setShortPasswordError(false);
    setPassword(selectedPassword);
  };

  const handlePublicKeyInput = (selectedKey: string) => {
    setPublicKey(selectedKey);
    setWrongPublicKey(false);
  };

  const handlePrivateKeyInput = (selectedKey: string) => {
    setPrivateKey(selectedKey);
    setWrongPrivateKey(false);
  };

  const encKeyPair = async (csk = "", spk = "", mode: "test" | "derive") => {
    await _sodium.ready;
    const sodium = _sodium;

    try {
      const computed = sodium.to_base64(
        sodium.crypto_scalarmult_base(sodium.from_base64(csk)),
      );
      if (csk === spk || spk === computed) {
        //wrong keypair
        setKeysError(true);
        setKeysErrorMessage(t("invalid_key_pair"));
        return;
      }

      if (sodium.from_base64(csk).length !== sodium.crypto_kx_SECRETKEYBYTES) {
        //wrong private key
        setWrongPrivateKey(true);
        return;
      }

      if (sodium.from_base64(spk).length !== sodium.crypto_kx_PUBLICKEYBYTES) {
        //wrongPublicKey
        setWrongPublicKey(true);
        return;
      }

      const key = sodium.crypto_kx_client_session_keys(
        sodium.crypto_scalarmult_base(sodium.from_base64(csk)),
        sodium.from_base64(csk),
        sodium.from_base64(spk)
      );

      if (key) {
        [encRx, encTx] = [key.sharedRx, key.sharedTx];

        if (mode === "test" && encRx && encTx) {
          //good keypair
          setActiveStep(2);
        }

        if (mode === "derive" && encRx && encTx) {
          const limitedRes =
            sodium.crypto_secretstream_xchacha20poly1305_init_push(encTx);
          limitedState = limitedRes.state;
          limitedHeader = limitedRes.header;
          //keyPairReady
        }
      } else {
        //wrong keypair
        setKeysError(true);
        setKeysErrorMessage(t("invalid_key_pair"));
        return;
      }
    } catch {
      setKeysError(true);
      setKeysErrorMessage(t("invalid_keys_input"));
      return;
    }
  };

  const handleEncryptionRequest = async () => {
    setOperationError(false);
    setIsEncrypting(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
      limitedState = null;
      if (encryptionMethod === "secretKey") {
        await limitedEncKeyGenerator(Password ?? "");
      } else {
        await encKeyPair(PrivateKey, PublicKey, "derive");
      }
      if (!limitedState || !File) throw new Error("Invalid keys");
      startLimitedEncryption(File);
    } catch {
      handleOperationError();
    }
  };

  const limitedEncKeyGenerator = async (password: string) => {
    await _sodium.ready;
    const sodium = _sodium;

    limitedSalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

    limitedKey = sodium.crypto_pwhash(
      sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
      password,
      limitedSalt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    const limitedRes =
      sodium.crypto_secretstream_xchacha20poly1305_init_push(limitedKey);
    limitedState = limitedRes.state;
    limitedHeader = limitedRes.header;
    sodium.memzero(limitedKey);
    limitedKey = null;
  };

  const startLimitedEncryption = (targetFile: File) => {
    if (encryptionMethod === "secretKey") {
      const SIGNATURE = new Uint8Array(
        encoder.encode(SIGNATURES["v2_symmetric"])
      );

      setIsEncrypting(true);
      // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
      limitedEncFileBuff = []; //clear array
      limitedEncFileBuff.push(SIGNATURE);
      if (limitedSalt) limitedEncFileBuff.push(limitedSalt);
      if (limitedHeader) limitedEncFileBuff.push(limitedHeader);

      targetFile
        .slice(0, CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          limitedIndex = CHUNK_SIZE;
          const limitedLast = limitedIndex >= targetFile.size;
          return limitedChunkEncryption(limitedLast, chunk, targetFile);
        }).catch(handleOperationError);
    }

    if (encryptionMethod === "publicKey") {
      const SIGNATURE = new Uint8Array(
        encoder.encode(SIGNATURES["v2_asymmetric"])
      );

      setIsEncrypting(true);
      // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
      limitedEncFileBuff = []; //clear array
      limitedEncFileBuff.push(SIGNATURE);
      if (limitedHeader) limitedEncFileBuff.push(limitedHeader);

      targetFile
        .slice(0, CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          limitedIndex = CHUNK_SIZE;
          const limitedLast = limitedIndex >= targetFile.size;
          return limitedChunkEncryption(limitedLast, chunk, targetFile);
        }).catch(handleOperationError);
    }
  };

  const limitedChunkEncryption = async (limitedLast: boolean, chunk: ArrayBuffer, targetFile: File) => {
    await _sodium.ready;
    const sodium = _sodium;

    if (!limitedState || !limitedEncFileBuff) {
      throw new Error("Invalid encryption state");
    }

    const limitedTag = limitedLast
      ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
      : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;

    const limitedEncryptedChunk =
      sodium.crypto_secretstream_xchacha20poly1305_push(
        limitedState,
        new Uint8Array(chunk),
        null,
        limitedTag
      );

    limitedEncFileBuff.push(new Uint8Array(limitedEncryptedChunk));

    if (limitedLast) {
      handleFinishedEncryption();
    }

    if (!limitedLast) {
      continueLimitedEncryption(targetFile);
    }
  };

  const continueLimitedEncryption = (targetFile: File) => {
    const startOffset = limitedIndex ?? 0;
    targetFile
      .slice(startOffset, startOffset + CHUNK_SIZE)
      .arrayBuffer()
      .then((chunk) => {
        limitedIndex = startOffset + CHUNK_SIZE;
        const limitedLast = limitedIndex >= targetFile.size;

        return limitedChunkEncryption(limitedLast, chunk, targetFile);
      }).catch(handleOperationError);
  };

  const handleFinishedEncryption = () => {
    setIsEncrypting(false);
    handleNext();
  };

  const handleEncryptedFileDownload = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }
    if (!File || !limitedEncFileBuff) {
      return;
    }
    const fileName = File.name + ".enc";
    const blob = new Blob(limitedEncFileBuff as BlobPart[]);
    downloadBlob(blob, fileName);
  };

  const createShareableLink = async () => {
    const pk = await computePublicKey(PrivateKey ?? "");
    const link = window.location.origin + "/?tab=decryption&publicKey=" + encodeURIComponent(pk);
    setShareableLink(link);
  };

  useEffect(() => {
    const queryPublicKey = Array.isArray(query.publicKey) ? query.publicKey[0] : query.publicKey;
    if (query.tab === "encryption" && queryPublicKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Apply public-key invitations from the router after hydration, preserving editable credential state.
      setPublicKey(queryPublicKey);
      setPkAlert(true);
      setEncryptionMethod("publicKey");
    }
  }, [query.publicKey, query.tab]);

  return <FileWorkflow
    direction="encrypt" active={active} step={activeStep} done={activeStep === 3} buffered
    files={File ? [File] : []} onFiles={selected => handleLimitedFileInput(selected[0])} onRemove={() => setFile(undefined)} onFileContinue={handleNext}
    method={encryptionMethod} password={Password} onPassword={handlePasswordInput}
    publicKey={PublicKey} privateKey={PrivateKey} onPublicKey={handlePublicKeyInput} onPrivateKey={handlePrivateKeyInput}
    publicKeyError={wrongPublicKey} privateKeyError={wrongPrivateKey} keysError={keysError ? keysErrorMessage : null}
    passwordError={shortPasswordError} fileError={largeFile ? t("choose_file_1gb") : null} operationError={operationError}
    checking={false} testing={false} processing={isEncrypting}
    onCredentialContinue={handleMethodStep} onBack={handleBack} onReset={handleReset}
    rootProps={getRootProps()} isDragActive={isDragActive} publicKeyNotice={pkAlert}
    onMethod={handleRadioChange} onGenerate={generatedPassword} shareableLink={shareableLink} onCreateLink={createShareableLink}
    onExecute={handleEncryptionRequest} onDownload={handleEncryptedFileDownload}
  />;
};

export default LimitedEncryptionPanel;
