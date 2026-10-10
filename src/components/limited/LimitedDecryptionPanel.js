import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useDropzone } from "react-dropzone";
import FileWorkflow from "../FileWorkflow";
import { getTranslations as t } from "../../../locales";
import { downloadBlob } from "../../utils/downloadBlob";
const _sodium = require("libsodium-wrappers-sumo");
import { decryptFile } from "../../utils/decryptFile";
import { formatName } from "../../helpers/formatName";
import { MAX_FILE_SIZE, SIGNATURES, CHUNK_SIZE, decoder } from "../../config/Constants";

let file,
  limitedDecIndex,
  limitedTestDecFileBuff,
  limitedDecFileBuff,
  decRx,
  decTx;

const LimitedDecryptionPanel = ({ active = true }) => {
  useEffect(() => () => { limitedDecFileBuff = null; limitedTestDecFileBuff = null; file = null; decRx = null; decTx = null; }, []);
  const [operationError, setOperationError] = useState(false);
  const handleOperationError = () => {
    limitedDecFileBuff = null;
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

  const [File, setFile] = useState();

  const [largeFile, setLargeFile] = useState(false);

  const [Password, setPassword] = useState();

  const [decryptionMethod, setDecryptionMethod] = useState("secretKey");

  const [PublicKey, setPublicKey] = useState();

  const [PrivateKey, setPrivateKey] = useState();

  const [wrongPublicKey, setWrongPublicKey] = useState(false);

  const [wrongPrivateKey, setWrongPrivateKey] = useState(false);

  const [keysError, setKeysError] = useState(false);

  const [keysErrorMessage, setKeysErrorMessage] = useState();

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
    setFile();
    setPassword();
    setWrongPassword(false);
    setbadFile(false);
    setOldVersion(false);
    setPublicKey();
    setPrivateKey();
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setPkAlert(false);
    file = null;
    limitedDecIndex = null;
    (decRx = null), (decTx = null);
    router.replace(router.pathname);
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

    setbadFile(false);
    setOldVersion(false);
  };

  const removeFile = () => {
    setFile();
    setbadFile(false);
    setOldVersion(false);
  }

  const checkFile = () => {
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

  const handlePasswordInput = (selectedPassword) => {
    setPassword(selectedPassword);
    setWrongPassword(false);
  };

  const handlePublicKeyInput = (selectedKey) => {
    setPublicKey(selectedKey);
    setWrongPublicKey(false);
  };

  const handlePrivateKeyInput = (selectedKey) => {
    setPrivateKey(selectedKey);
    setWrongPrivateKey(false);
  };

  const requestDecKeyPair = async (ssk, cpk, header, decFileBuff) => {
    await _sodium.ready;
    const sodium = _sodium;

    try {
      let keyFromkeypair = sodium.crypto_kx_server_session_keys(
        sodium.crypto_scalarmult_base(sodium.from_base64(ssk)),
        sodium.from_base64(ssk),
        sodium.from_base64(cpk)
      );

      if (keyFromkeypair) {
        [decRx, decTx] = [keyFromkeypair.sharedRx, keyFromkeypair.sharedTx];
        if (decRx && decTx) {
          let limitedDecState =
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
    } catch (error) {
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
      setIsTestingPassword(true);

      file = File;
      let limitedTestPassword = Password;

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

        let decLimitedTestsalt = new Uint8Array(limitedTestSalt);
        let decLimitedTestheader = new Uint8Array(limitedTestHeader);

        let decLimitedTestKey = sodium.crypto_pwhash(
          sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
          limitedTestPassword,
          decLimitedTestsalt,
          sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
          sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
          sodium.crypto_pwhash_ALG_ARGON2ID13
        );

        let limitedTestState =
          sodium.crypto_secretstream_xchacha20poly1305_init_pull(
            decLimitedTestheader,
            decLimitedTestKey
          );

        if (limitedTestState) {
          let decLimitedTestresults =
            sodium.crypto_secretstream_xchacha20poly1305_pull(
              limitedTestState,
              new Uint8Array(limitedTestDecFileBuff)
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
      // requestDecKeyPair()
      setKeysError(false);
      setWrongPrivateKey(false);
      setWrongPublicKey(false);
      setIsTestingKeys(true);

      file = File;
      let ssk = PrivateKey;
      let cpk = PublicKey;

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

        let decLimitedTestheader = new Uint8Array(limitedTestHeader);

        try {
          let computed = sodium.crypto_scalarmult_base(sodium.from_base64(ssk));
          computed = sodium.to_base64(computed);
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

          let limitedDecKey = sodium.crypto_kx_server_session_keys(
            sodium.crypto_scalarmult_base(sodium.from_base64(ssk)),
            sodium.from_base64(ssk),
            sodium.from_base64(cpk)
          );

          if (limitedDecKey) {
            [decRx, decTx] = [limitedDecKey.sharedRx, limitedDecKey.sharedTx];

            if (decRx && decTx) {
              let limitedDecState =
                sodium.crypto_secretstream_xchacha20poly1305_init_pull(
                  new Uint8Array(decLimitedTestheader),
                  decRx
                );

              if (limitedDecState) {
                let decTestresults =
                  sodium.crypto_secretstream_xchacha20poly1305_pull(
                    limitedDecState,
                    new Uint8Array(limitedTestDecFileBuff)
                  );

                if (decTestresults) {
                  setIsTestingKeys(false);
                  setIsTestingPassword(false);
                  requestDecKeyPair(
                    ssk,
                    cpk,
                    decLimitedTestheader,
                    limitedTestDecFileBuff
                  );
                } else {
                  setWrongPublicKey(true);
                  setWrongPrivateKey(true);
                  setIsTestingKeys(false);
                }
              }
            }
          }
        } catch (error) {
          setKeysError(true);
          setKeysErrorMessage(t("invalid_keys_input"));
          setIsTestingKeys(false);
        }
      }).catch(handleOperationError);
    }
  };

  const limitedDecKeyGenerator = async (password, salt, header) => {
    await _sodium.ready;
    const sodium = _sodium;

    file = File;

    let limitedDecSalt = new Uint8Array(salt);
    let limitedDecHeader = new Uint8Array(header);

    let limitedDecKey = sodium.crypto_pwhash(
      sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
      password,
      limitedDecSalt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    let limitedDecState =
      sodium.crypto_secretstream_xchacha20poly1305_init_pull(
        limitedDecHeader,
        limitedDecKey
      );
    sodium.memzero(limitedDecKey);

    if (limitedDecState) {
      return startLimitedDecryption("secretKey", limitedDecState);
    }
  };

  const startLimitedDecryption = async (method, decState) => {
    setIsDecrypting(true);
    setOperationError(false);
    limitedDecFileBuff = null;
    try {
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
    let fileName = formatName(File.name);

    let blob = new Blob(limitedDecFileBuff);

    downloadBlob(blob, fileName);
  };

  useEffect(() => {
    if (query.tab === "decryption" && query.publicKey) {
      setPublicKey(query.publicKey);
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
}

export default LimitedDecryptionPanel;
