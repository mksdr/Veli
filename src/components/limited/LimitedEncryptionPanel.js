import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useDropzone } from "react-dropzone";
import FileWorkflow from "../FileWorkflow";
import { getTranslations as t } from "../../../locales";
import { generatePassword, generatePassPhrase } from "../../utils/generatePassword";
import { computePublicKey } from "../../utils/computePublicKey";
import { downloadBlob } from "../../utils/downloadBlob";
const _sodium = require("libsodium-wrappers");
import { MAX_FILE_SIZE, SIGNATURES, CHUNK_SIZE, encoder } from "../../config/Constants";

let file,
  limitedIndex,
  limitedSalt,
  limitedKey,
  limitedState,
  limitedHeader,
  limitedEncFileBuff,
  encRx,
  encTx;

const LimitedEncryptionPanel = ({ active = true }) => {
  useEffect(() => () => { limitedEncFileBuff = null; limitedState = null; file = null; encRx = null; encTx = null; }, []);
  const [operationError, setOperationError] = useState(false);
  const handleOperationError = () => {
    limitedEncFileBuff = null;
    limitedState = null;
    setIsEncrypting(false);
    setOperationError(true);
  };

  const router = useRouter();

  const query = router.query;

  const [activeStep, setActiveStep] = useState(0);

  const [File, setFile] = useState();

  const [largeFile, setLargeFile] = useState(false);

  const [Password, setPassword] = useState();

  const [PublicKey, setPublicKey] = useState();

  const [PrivateKey, setPrivateKey] = useState();

  const [wrongPublicKey, setWrongPublicKey] = useState(false);

  const [wrongPrivateKey, setWrongPrivateKey] = useState(false);

  const [keysError, setKeysError] = useState(false);

  const [keysErrorMessage, setKeysErrorMessage] = useState();

  const [shortPasswordError, setShortPasswordError] = useState(false);

  const [encryptionMethod, setEncryptionMethod] = useState("secretKey");

  const [isEncrypting, setIsEncrypting] = useState(false);

  const [shareableLink, setShareableLink] = useState();

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

  const handleRadioChange = (method) => {
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
    setFile();
    setPassword();
    setIsEncrypting(false);
    setPublicKey();
    setPrivateKey();
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setShortPasswordError(false);
    setShareableLink();
    setPkAlert(false);
    file = null;
    limitedEncFileBuff = null;
    limitedIndex = null;
    (encRx = null), (encTx = null);
    router.replace(router.pathname);
  };

  const handleMethodStep = () => {
    if (encryptionMethod === "secretKey") {
      if (Password?.length >= 12) {
        setActiveStep(2);
      } else {
        setShortPasswordError(true);
      }
    }

    if (encryptionMethod === "publicKey") {
      let mode = "test";
      let privateKey = PrivateKey;
      let publicKey = PublicKey;
      encKeyPair(privateKey, publicKey, mode);
    }
  };

  const generatedPassword = async (kind) => {
    const generated = await (kind === "words" ? generatePassPhrase() : generatePassword());
    setPassword(generated);
    setShortPasswordError(false);
  };

  const handleLimitedFileInput = (selectedFile) => {
    if (!selectedFile) return;
    setOperationError(false);
    file = selectedFile;

    if (file.size > MAX_FILE_SIZE) {
      setLargeFile(true);
      setFile();
    } else {
      setFile(selectedFile);
      setLargeFile(false);
    }
  };

  const handlePasswordInput = (selectedPassword) => {
    setShortPasswordError(false);
    setPassword(selectedPassword);
  };

  const handlePublicKeyInput = (selectedKey) => {
    setPublicKey(selectedKey);
    setWrongPublicKey(false);
  };

  const handlePrivateKeyInput = (selectedKey) => {
    setPrivateKey(selectedKey);
    setWrongPrivateKey(false);
  };

  const encKeyPair = async (csk, spk, mode) => {
    await _sodium.ready;
    const sodium = _sodium;

    try {
      let computed = sodium.crypto_scalarmult_base(sodium.from_base64(csk));
      computed = sodium.to_base64(computed);
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

      let key = sodium.crypto_kx_client_session_keys(
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
          let limitedRes =
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
    } catch (error) {
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
      limitedState = null;
      if (encryptionMethod === "secretKey") {
        await limitedEncKeyGenerator(Password);
      } else {
        await encKeyPair(PrivateKey, PublicKey, "derive");
      }
      if (!limitedState) throw new Error("Invalid keys");
      startLimitedEncryption(File);
    } catch {
      handleOperationError();
    }
  };

  const limitedEncKeyGenerator = async (password) => {
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

    let limitedRes =
      sodium.crypto_secretstream_xchacha20poly1305_init_push(limitedKey);
    limitedState = limitedRes.state;
    limitedHeader = limitedRes.header;
    sodium.memzero(limitedKey);
    limitedKey = null;
  };

  const startLimitedEncryption = (file) => {
    if (encryptionMethod === "secretKey") {
      const SIGNATURE = new Uint8Array(
        encoder.encode(SIGNATURES["v2_symmetric"])
      );

      setIsEncrypting(true);
      limitedEncFileBuff = []; //clear array
      limitedEncFileBuff.push(SIGNATURE);
      limitedEncFileBuff.push(limitedSalt);
      limitedEncFileBuff.push(limitedHeader);

      file
        .slice(0, CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          limitedIndex = CHUNK_SIZE;
          let limitedLast = limitedIndex >= file.size;
          return limitedChunkEncryption(limitedLast, chunk, file);
        }).catch(handleOperationError);
    }

    if (encryptionMethod === "publicKey") {
      const SIGNATURE = new Uint8Array(
        encoder.encode(SIGNATURES["v2_asymmetric"])
      );

      setIsEncrypting(true);
      limitedEncFileBuff = []; //clear array
      limitedEncFileBuff.push(SIGNATURE);
      limitedEncFileBuff.push(limitedHeader);

      file
        .slice(0, CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          limitedIndex = CHUNK_SIZE;
          let limitedLast = limitedIndex >= file.size;
          return limitedChunkEncryption(limitedLast, chunk, file);
        }).catch(handleOperationError);
    }
  };

  const limitedChunkEncryption = async (limitedLast, chunk, file) => {
    await _sodium.ready;
    const sodium = _sodium;

    let limitedTag = limitedLast
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
      continueLimitedEncryption(file);
    }
  };

  const continueLimitedEncryption = (file) => {
    file
      .slice(limitedIndex, limitedIndex + CHUNK_SIZE)
      .arrayBuffer()
      .then((chunk) => {
        limitedIndex += CHUNK_SIZE;
        let limitedLast = limitedIndex >= file.size;

        return limitedChunkEncryption(limitedLast, chunk, file);
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
    let fileName = File.name + ".enc";
    let blob = new Blob(limitedEncFileBuff);
    downloadBlob(blob, fileName);
  };

  const createShareableLink = async () => {
    let pk = await computePublicKey(PrivateKey);
    let link = window.location.origin + "/?tab=decryption&publicKey=" + encodeURIComponent(pk);
    setShareableLink(link);
  };

  useEffect(() => {
    if (query.tab === "encryption" && query.publicKey) {
      setPublicKey(query.publicKey);
      setPkAlert(true);
      setEncryptionMethod("publicKey");
    }
  }, [query.publicKey, query.tab]);

  return <FileWorkflow
    direction="encrypt" active={active} step={activeStep} done={activeStep === 3} buffered
    files={File ? [File] : []} onFiles={selected => handleLimitedFileInput(selected[0])} onRemove={() => setFile()} onFileContinue={handleNext}
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
}

export default LimitedEncryptionPanel;
