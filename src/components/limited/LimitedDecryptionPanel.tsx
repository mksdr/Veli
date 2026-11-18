import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useDropzone } from "react-dropzone";
import _sodium, { type StateAddress } from "libsodium-wrappers-sumo";
import FileWorkflow, { type EncryptionMethod } from "../FileWorkflow";
import { getTranslations as t } from "../../../locales";
import { downloadBlob } from "../../utils/downloadBlob";
import { decryptFile } from "../../utils/decryptFile";
import { formatName } from "../../helpers/formatName";
import { MAX_FILE_SIZE, SIGNATURES, CHUNK_SIZE, decoder } from "../../config/Constants";

let file: File | null | undefined = null,
  limitedTestDecFileBuff: ArrayBuffer | null = null,
  limitedDecFileBuff: Uint8Array[] | null = null,
  decRx: Uint8Array | null = null,
  decTx: Uint8Array | null = null;

export interface LimitedDecryptionPanelProps {
  active?: boolean;
}

const LimitedDecryptionPanel = ({ active = true }: LimitedDecryptionPanelProps) => {
  useEffect(() => () => { limitedDecFileBuff = null; limitedTestDecFileBuff = null; file = null; decRx = null; decTx = null; }, []);
  const [operationError, setOperationError] = useState(false);
  const handleOperationError = () => {
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    limitedDecFileBuff = null;
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    limitedTestDecFileBuff = null;
    setIsDecrypting(false);
    setIsTestingPassword(false);
    setIsTestingKeys(false);
    setIsCheckingFile(false);
    setOperationError(true);
    setActiveStep(1);
  };

  const [activeStep, setActiveStep] = useState(0);

  const router = useRouter();

  const query = router.query;

  const [File, setFile] = useState<File | undefined>();

  const [largeFile, setLargeFile] = useState(false);

  const [Password, setPassword] = useState<string | undefined>();

  const [decryptionMethod, setDecryptionMethod] = useState<EncryptionMethod>("secretKey");

  const [PublicKey, setPublicKey] = useState<string | undefined>();

  const [PrivateKey, setPrivateKey] = useState<string | undefined>();

  const [wrongPublicKey, setWrongPublicKey] = useState(false);

  const [wrongPrivateKey, setWrongPrivateKey] = useState(false);

  const [keysError, setKeysError] = useState(false);

  const [keysErrorMessage, setKeysErrorMessage] = useState<string | undefined>();

  const [isCheckingFile, setIsCheckingFile] = useState(false);

  const [badFile, setbadFile] = useState(false);

  const [oldVersion, setOldVersion] = useState(false);

  const [wrongPassword, setWrongPassword] = useState(false);

  const [isTestingPassword, setIsTestingPassword] = useState(false);

  const [isTestingKeys, setIsTestingKeys] = useState(false);

  const [isDecrypting, setIsDecrypting] = useState(false);

  const [pkAlert, setPkAlert] = useState(false);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (acceptedFile) => {
      handleLimitedFileInput(acceptedFile[0]);
    },
    noClick: true,
    noKeyboard: true,
    disabled: activeStep !== 0 || isCheckingFile || isTestingKeys || isTestingPassword || isDecrypting,
  });

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setWrongPassword(false);
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setIsTestingKeys(false);
    setIsTestingPassword(false);
    setIsDecrypting(false);
  };

  const handleReset = () => {
    setLargeFile(false);
    limitedDecFileBuff = null;
    limitedTestDecFileBuff = null;
    setOperationError(false);
    setIsDecrypting(false);
    setActiveStep(0);
    setFile(undefined);
    setPassword(undefined);
    setWrongPassword(false);
    setbadFile(false);
    setOldVersion(false);
    setPublicKey(undefined);
    setPrivateKey(undefined);
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setPkAlert(false);
    file = null;
    decRx = null;
    decTx = null;
    router.replace(router.pathname);
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

    setbadFile(false);
    setOldVersion(false);
  };

  const removeFile = () => {
    setFile(undefined);
    setbadFile(false);
    setOldVersion(false);
  };

  const checkFile = () => {
    if (!file) return;
    setIsCheckingFile(true);
    setbadFile(false);
    setOldVersion(false);

    Promise.all([
      file.slice(0, 11).arrayBuffer(), //signatures
      file.slice(0, 22).arrayBuffer(), //v1 signature
    ]).then(([signature, legacy]) => {
      if (decoder.decode(signature) === SIGNATURES["v2_symmetric"]) {
        setDecryptionMethod("secretKey");
        setActiveStep(1);
        setIsCheckingFile(false);
      } else if (decoder.decode(signature) === SIGNATURES["v2_asymmetric"]) {
        setDecryptionMethod("publicKey");
        setActiveStep(1);
        setIsCheckingFile(false);
      } else if (decoder.decode(legacy) === SIGNATURES["v1"]) {
        setOldVersion(true);
        setIsCheckingFile(false);
      } else {
        setbadFile(true);
        setIsCheckingFile(false);
      }
    }).catch(handleOperationError);
  };

  const handlePasswordInput = (selectedPassword: string) => {
    setPassword(selectedPassword);
    setWrongPassword(false);
  };

  const handlePublicKeyInput = (selectedKey: string) => {
    setPublicKey(selectedKey);
    setWrongPublicKey(false);
  };

  const handlePrivateKeyInput = (selectedKey: string) => {
    setPrivateKey(selectedKey);
    setWrongPrivateKey(false);
  };

  const requestDecKeyPair = async (ssk: string, cpk: string, header: ArrayBuffer | Uint8Array) => {
    await _sodium.ready;
    const sodium = _sodium;

    try {
      const keyFromkeypair = sodium.crypto_kx_server_session_keys(
        sodium.crypto_scalarmult_base(sodium.from_base64(ssk)),
        sodium.from_base64(ssk),
        sodium.from_base64(cpk)
      );

      if (keyFromkeypair) {
        // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
        [decRx, decTx] = [keyFromkeypair.sharedRx, keyFromkeypair.sharedTx];
        if (decRx && decTx) {
          const limitedDecState =
            sodium.crypto_secretstream_xchacha20poly1305_init_pull(
              new Uint8Array(header),
              decRx
            );

          if (limitedDecState) {
            setIsTestingKeys(false);
            setIsTestingPassword(false);
            startLimitedDecryption("publicKey", limitedDecState);
          }
        }
      }
    } catch {
      setKeysError(true);
      setKeysErrorMessage(t("invalid_keys_input"));
      setIsTestingKeys(false);
    }
  };

  const testLimitedDecryption = async () => {
    setOperationError(false);
    await _sodium.ready;
    const sodium = _sodium;

    if (decryptionMethod === "secretKey") {
      if (!File) return;
      setIsTestingPassword(true);

      // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
      file = File;
      const limitedTestPassword = Password ?? "";

      Promise.all([
        file.slice(11, 27).arrayBuffer(), //salt
        file.slice(27, 51).arrayBuffer(), //header
        file
          .slice(
            51,
            51 +
              CHUNK_SIZE +
              sodium.crypto_secretstream_xchacha20poly1305_ABYTES
          )
          .arrayBuffer(),
      ]).then(([limitedTestSalt, limitedTestHeader, limitedTestChunk]) => {
        limitedTestDecFileBuff = limitedTestChunk; //for testing the dec password

        const decLimitedTestsalt = new Uint8Array(limitedTestSalt);
        const decLimitedTestheader = new Uint8Array(limitedTestHeader);

        const decLimitedTestKey = sodium.crypto_pwhash(
          sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
          limitedTestPassword,
          decLimitedTestsalt,
          sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
          sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
          sodium.crypto_pwhash_ALG_ARGON2ID13
        );

        const limitedTestState =
          sodium.crypto_secretstream_xchacha20poly1305_init_pull(
            decLimitedTestheader,
            decLimitedTestKey
          );

        if (limitedTestState) {
          const decLimitedTestresults =
            sodium.crypto_secretstream_xchacha20poly1305_pull(
              limitedTestState,
              new Uint8Array(limitedTestDecFileBuff),
              null
            );
          if (decLimitedTestresults) {
            setIsTestingPassword(false);

            return limitedDecKeyGenerator(
              limitedTestPassword,
              limitedTestSalt,
              limitedTestHeader
            );
          } else {
            setIsTestingPassword(false);
            setWrongPassword(true);
          }
        }
      }).catch(handleOperationError);
    }

    if (decryptionMethod === "publicKey") {
      if (!File) return;
      // requestDecKeyPair()
      setKeysError(false);
      setWrongPrivateKey(false);
      setWrongPublicKey(false);
      setIsTestingKeys(true);

      // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
      file = File;
      const ssk = PrivateKey ?? "";
      const cpk = PublicKey ?? "";

      Promise.all([
        file.slice(11, 35).arrayBuffer(), //header
        file
          .slice(
            35,
            35 +
              CHUNK_SIZE +
              sodium.crypto_secretstream_xchacha20poly1305_ABYTES
          )
          .arrayBuffer(),
      ]).then(([limitedTestHeader, limitedTestChunk]) => {
        limitedTestDecFileBuff = limitedTestChunk; //for testing the dec password

        const decLimitedTestheader = new Uint8Array(limitedTestHeader);

        try {
          const computed = sodium.to_base64(
            sodium.crypto_scalarmult_base(sodium.from_base64(ssk)),
          );
          if (ssk === cpk || cpk === computed) {
            setKeysError(true);
            setKeysErrorMessage(t("invalid_key_pair"));
            setIsTestingKeys(false);
            return;
          }

          if (
            sodium.from_base64(ssk).length !== sodium.crypto_kx_SECRETKEYBYTES
          ) {
            setWrongPrivateKey(true);
            setIsTestingKeys(false);
            return;
          }

          if (
            sodium.from_base64(cpk).length !== sodium.crypto_kx_PUBLICKEYBYTES
          ) {
            setWrongPublicKey(true);
            setIsTestingKeys(false);
            return;
          }

          const limitedDecKey = sodium.crypto_kx_server_session_keys(
            sodium.crypto_scalarmult_base(sodium.from_base64(ssk)),
            sodium.from_base64(ssk),
            sodium.from_base64(cpk)
          );

          if (limitedDecKey) {
            [decRx, decTx] = [limitedDecKey.sharedRx, limitedDecKey.sharedTx];

            if (decRx && decTx) {
              const limitedDecState =
                sodium.crypto_secretstream_xchacha20poly1305_init_pull(
                  new Uint8Array(decLimitedTestheader),
                  decRx
                );

              if (limitedDecState) {
                const decTestresults =
                  sodium.crypto_secretstream_xchacha20poly1305_pull(
                    limitedDecState,
                    new Uint8Array(limitedTestDecFileBuff),
                    null
                  );

                if (decTestresults) {
                  setIsTestingKeys(false);
                  setIsTestingPassword(false);
                  requestDecKeyPair(
                    ssk,
                    cpk,
                    decLimitedTestheader
                  );
                } else {
                  setWrongPublicKey(true);
                  setWrongPrivateKey(true);
                  setIsTestingKeys(false);
                }
              }
            }
          }
        } catch {
          setKeysError(true);
          setKeysErrorMessage(t("invalid_keys_input"));
          setIsTestingKeys(false);
        }
      }).catch(handleOperationError);
    }
  };

  const limitedDecKeyGenerator = async (password: string, salt: ArrayBuffer, header: ArrayBuffer) => {
    await _sodium.ready;
    const sodium = _sodium;

    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    file = File;

    const limitedDecSalt = new Uint8Array(salt);
    const limitedDecHeader = new Uint8Array(header);

    const limitedDecKey = sodium.crypto_pwhash(
      sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
      password,
      limitedDecSalt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    const limitedDecState =
      sodium.crypto_secretstream_xchacha20poly1305_init_pull(
        limitedDecHeader,
        limitedDecKey
      );
    sodium.memzero(limitedDecKey);

    if (limitedDecState) {
      return startLimitedDecryption("secretKey", limitedDecState);
    }
  };

  const startLimitedDecryption = async (method: EncryptionMethod, decState: StateAddress) => {
    setIsDecrypting(true);
    setOperationError(false);
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    limitedDecFileBuff = null;
    try {
      if (!File) throw new Error("No file selected");
      // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
      limitedDecFileBuff = await decryptFile(
        _sodium, File, decState, method === "secretKey" ? 51 : 35, CHUNK_SIZE
      );
      handleFinishedDecryption();
    } catch {
      handleOperationError();
    }
  };

  const handleFinishedDecryption = () => {
    handleNext();
    setIsDecrypting(false);
  };

  const handleDecryptedFileDownload = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }
    if (!File || !limitedDecFileBuff) {
      return;
    }
    const fileName = formatName(File.name);

    const blob = new Blob(limitedDecFileBuff as BlobPart[]);

    downloadBlob(blob, fileName);
  };

  useEffect(() => {
    const queryPublicKey = Array.isArray(query.publicKey) ? query.publicKey[0] : query.publicKey;
    if (query.tab === "decryption" && queryPublicKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Apply public-key invitations from the router after hydration, preserving editable credential state.
      setPublicKey(queryPublicKey);
      setPkAlert(true);
      setDecryptionMethod("publicKey");
    }
  }, [query.publicKey, query.tab]);
  return <FileWorkflow
    direction="decrypt" active={active} step={activeStep} done={activeStep === 2} buffered
    files={File ? [File] : []} onFiles={selected => handleLimitedFileInput(selected[0])} onRemove={removeFile} onFileContinue={checkFile}
    method={decryptionMethod} password={Password} onPassword={handlePasswordInput}
    publicKey={PublicKey} privateKey={PrivateKey} onPublicKey={handlePublicKeyInput} onPrivateKey={handlePrivateKeyInput}
    publicKeyError={wrongPublicKey} privateKeyError={wrongPrivateKey} keysError={keysError ? keysErrorMessage : null}
    passwordError={wrongPassword} fileError={largeFile ? t("choose_file_1gb") : badFile ? t("file_not_encrypted_corrupted") : oldVersion ? t("old_version") : null} operationError={operationError}
    checking={isCheckingFile} testing={isTestingPassword || isTestingKeys} processing={isDecrypting}
    onCredentialContinue={testLimitedDecryption} onBack={handleBack} onReset={handleReset}
    rootProps={getRootProps()} isDragActive={isDragActive} publicKeyNotice={pkAlert}
    onDownload={handleDecryptedFileDownload}
  />;
};

export default LimitedDecryptionPanel;
