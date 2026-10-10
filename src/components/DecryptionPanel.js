import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useDropzone } from "react-dropzone";
import FileWorkflow from "./FileWorkflow";
import { getTranslations as t } from "../../locales";
import { formatName } from "../helpers/formatName";
import { CHUNK_SIZE, crypto_secretstream_xchacha20poly1305_ABYTES } from "../config/Constants";
import { downloadStream } from "../utils/downloadStream";

let file,
  index,
  decFileBuff,
  files = [],
  password,
  currFile = 0,
  numberOfFiles,
  decryptionMethodState,
  privateKey,
  publicKey;

let operationId, downloadUrl, nextFileTimer, pendingRequestId, releaseDownload;
const postToWorker = (worker, data, transfer = []) =>
  worker.postMessage({ ...data, operationId }, transfer);
const cancelOperation = () => {
  releaseDownload?.();
  releaseDownload = null;
  pendingRequestId = null;
  clearTimeout(nextFileTimer);
  if (operationId && navigator.serviceWorker.controller) {
    postToWorker(navigator.serviceWorker.controller, { cmd: "cancelOperation" });
  }
  operationId = null;
  downloadUrl = null;
};

export default function DecryptionPanel({ active = true }) {

  const [operationError, setOperationError] = useState(false);
  const [errorFile, setErrorFile] = useState(null);
  const handleOperationError = () => {
    setErrorFile(files[currFile]?.name);
    cancelOperation();
    setOperationError(true);
    resetCurrFile();
    setIsDownloading(false);
    setIsTestingPassword(false);
    setIsTestingKeys(false);
    setIsCheckingFile(false);
  };

  const router = useRouter();

  const query = router.query;

  const [activeStep, setActiveStep] = useState(0);

  const [Files, setFiles] = useState([]);

  const [currFileState, setCurrFileState] = useState(0);

  const [Password, setPassword] = useState();

  const [decryptionMethod, setDecryptionMethod] = useState("secretKey");

  const [PublicKey, setPublicKey] = useState();

  const [PrivateKey, setPrivateKey] = useState();

  const [wrongPublicKey, setWrongPublicKey] = useState(false);

  const [wrongPrivateKey, setWrongPrivateKey] = useState(false);

  const [keysError, setKeysError] = useState(false);

  const [keysErrorMessage, setKeysErrorMessage] = useState();

  const [badFile, setbadFile] = useState();

  const [oldVersion, setOldVersion] = useState();

  const [fileMixUp, setFileMixUp] = useState(false);

  const [wrongPassword, setWrongPassword] = useState(false);

  const [isCheckingFile, setIsCheckingFile] = useState(false);

  const [isTestingPassword, setIsTestingPassword] = useState(false);

  const [isTestingKeys, setIsTestingKeys] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);

  const [pkAlert, setPkAlert] = useState(false);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      handleFilesInput(acceptedFiles);
    },
    noClick: true,
    noKeyboard: true,
    disabled: activeStep !== 0 || isCheckingFile || isTestingKeys || isTestingPassword || isDownloading,
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
  };

  const handleReset = () => {
    setErrorFile(null);
    cancelOperation();
    setOperationError(false);
    setIsDownloading(false);
    setIsTestingPassword(false);
    setIsTestingKeys(false);
    setIsCheckingFile(false);
    password = null;
    setActiveStep(0);
    setFiles([]);
    setPassword();
    setWrongPassword(false);
    setbadFile(false);
    setOldVersion(false);
    setFileMixUp(false);
    setPublicKey();
    setPrivateKey();
    privateKey = null;
    publicKey = null;
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setPkAlert(false);
    file = null;
    index = null;
    files = [];
    numberOfFiles = 0;
    resetCurrFile();
    router.replace(router.pathname);
  };

  const resetCurrFile = () => {
    currFile = 0;
    setCurrFileState(currFile);
  };

  const updateCurrFile = () => {
    currFile += 1;
    setCurrFileState(currFile);
  };

  const resetFileErrors = () => {
    setbadFile(false);
    setOldVersion(false);
    setFileMixUp(false);
    resetCurrFile();
    decryptionMethodState = null;
  };

  const handleFilesInput = (selectedFiles) => {
    selectedFiles = Array.from(selectedFiles);
    if (files.length > 0) {
      files = files.concat(selectedFiles);
      files = files.filter(
        (thing, index, self) =>
          index ===
          self.findIndex((t) => t.name === thing.name && t.size === thing.size)
      );
    } else {
      files = selectedFiles;
    }
    setFiles(files);
    resetFileErrors();
  };

  const updateFilesInput = (index) => {
    files = [...files.slice(0, index), ...files.slice(index + 1)];
    setFiles(files);
    resetFileErrors();
  };

  const handlePasswordInput = (selectedPassword) => {
    setPassword(selectedPassword);
    password = selectedPassword;
    setWrongPassword(false);
  };

  const checkFile = (file) => {
    navigator.serviceWorker.ready.then((reg) => {
      setIsCheckingFile(true);
      setbadFile(false);
      setOldVersion(false);
      setFileMixUp(false);

      Promise.all([
        file.slice(0, 11).arrayBuffer(), //signatures
        file.slice(0, 22).arrayBuffer(), //v1 signature
      ]).then(([signature, legacy]) => {
        postToWorker(reg.active, {
          cmd: "checkFile",
          signature,
          legacy,
        });
      }).catch(handleOperationError);
    });
  };

  const checkFiles = () => {
    setOperationError(false);
    numberOfFiles = files.length;
    if (currFile <= numberOfFiles - 1) {
      checkFile(files[currFile]);
    }
  };

  const checkFilesQueue = () => {
    if (numberOfFiles > 1) {
      updateCurrFile();

      if (currFile <= numberOfFiles - 1) {
        checkFiles();
      } else {
        setActiveStep(1);
        setIsCheckingFile(false);
        resetCurrFile();
      }
    }
  };

  const checkFileMixUp = () => {
    setFileMixUp(true);
    setIsCheckingFile(false);
  };

  const checkFilesTestQueue = () => {
    if (numberOfFiles > 1) {
      updateCurrFile();

      if (currFile <= numberOfFiles - 1) {
        testFilesDecryption();
      } else {
        setIsTestingKeys(false);
        setIsTestingPassword(false);
        handleNext();
        resetCurrFile();
      }
    }
  };

  const testFilesDecryption = () => {
    setErrorFile(null);
    setOperationError(false);
    numberOfFiles = files.length;
    if (currFile <= numberOfFiles - 1) {
      testDecryption(files[currFile]);
    }
  };

  const testDecryption = (file) => {
    if (decryptionMethodState === "secretKey") {
      navigator.serviceWorker.ready.then((reg) => {
        setIsTestingPassword(true);
        setWrongPassword(false);

        Promise.all([
          file.slice(0, 11).arrayBuffer(), //signature
          file.slice(11, 27).arrayBuffer(), //salt
          file.slice(27, 51).arrayBuffer(), //header
          file
            .slice(
              51,
              51 + CHUNK_SIZE + crypto_secretstream_xchacha20poly1305_ABYTES
            )
            .arrayBuffer(), //17
        ]).then(([signature, salt, header, chunk]) => {
          decFileBuff = chunk; //for testing the dec password
          postToWorker(reg.active, {
            cmd: "requestTestDecryption",
            password,
            signature,
            salt,
            header,
            decFileBuff,
          });
        }).catch(handleOperationError);
      });
    }

    if (decryptionMethodState === "publicKey") {
      navigator.serviceWorker.ready.then((reg) => {
        setIsTestingKeys(true);
        setKeysError(false);
        setWrongPrivateKey(false);
        setWrongPublicKey(false);

        let mode = "test";

        Promise.all([
          file.slice(11, 35).arrayBuffer(), //header
          file
            .slice(
              35,
              35 + CHUNK_SIZE + crypto_secretstream_xchacha20poly1305_ABYTES
            )
            .arrayBuffer(), //17
        ]).then(([header, chunk]) => {
          decFileBuff = chunk;
          postToWorker(reg.active, {
            cmd: "requestDecKeyPair",
            privateKey,
            publicKey,
            header,
            decFileBuff,
            mode,
          });
        }).catch(handleOperationError);
      });
    }
  };

  const handlePublicKeyInput = (selectedKey) => {
    setPublicKey(selectedKey);
    publicKey = selectedKey;
    setWrongPublicKey(false);
  };

  const handlePrivateKeyInput = (selectedKey) => {
    setPrivateKey(selectedKey);
    privateKey = selectedKey;
    setWrongPrivateKey(false);
  };

  const handleEncryptedFilesDownload = async (e) => {
    setIsDownloading(true);
    resetCurrFile();
    numberOfFiles = Files.length;
    prepareFile();
  };

  const prepareFile = () => {
    const requestId = crypto.randomUUID();
    pendingRequestId = requestId;
    setOperationError(false);
    // send file name to sw
    let fileName = formatName(files[currFile].name);
    navigator.serviceWorker.ready.then((reg) => {
      if (pendingRequestId !== requestId) return;
      postToWorker(reg.active, { cmd: "prepareFileNameDec", fileName, requestId });
    }).catch(handleOperationError);
  };

  const kickOffDecryption = async (e) => {
    const currentOperation = operationId;
    if (currFile <= numberOfFiles - 1) {
      file = files[currFile];
      releaseDownload?.();
      releaseDownload = downloadStream(downloadUrl);
      setIsDownloading(true);

      if (decryptionMethodState === "secretKey") {
        navigator.serviceWorker.ready.then((reg) => {
          if (currentOperation !== operationId) return;
          Promise.all([
            file.slice(0, 11).arrayBuffer(), //signature
            file.slice(11, 27).arrayBuffer(), //salt
            file.slice(27, 51).arrayBuffer(), //header
            file
              .slice(
                51,
                51 + CHUNK_SIZE + crypto_secretstream_xchacha20poly1305_ABYTES
              )
              .arrayBuffer(), //17
          ]).then(([signature, salt, header, chunk]) => {
            if (currentOperation !== operationId) return;
            postToWorker(reg.active, {
              cmd: "requestDecryption",
              password,
              signature,
              salt,
              header,
            });
          }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
      }

      if (decryptionMethodState === "publicKey") {
        navigator.serviceWorker.ready.then((reg) => {
          if (currentOperation !== operationId) return;
          let mode = "derive";

          Promise.all([
            file.slice(11, 35).arrayBuffer(), //header
            file
              .slice(
                35,
                35 + CHUNK_SIZE + crypto_secretstream_xchacha20poly1305_ABYTES
              )
              .arrayBuffer(), //17
          ]).then(([header, chunk]) => {
            if (currentOperation !== operationId) return;
            decFileBuff = chunk;
            postToWorker(reg.active, {
              cmd: "requestDecKeyPair",
              privateKey,
              publicKey,
              header,
              decFileBuff,
              mode,
            });
          }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
      }
    } else {
      // console.log("out of files")
    }
  };

  const startDecryption = (method) => {
    const currentOperation = operationId;
    let startIndex;
    if (method === "secretKey") startIndex = 51;
    if (method === "publicKey") startIndex = 35;

    file = files[currFile];

    navigator.serviceWorker.ready.then((reg) => {
      if (currentOperation !== operationId) return;
      file
        .slice(
          startIndex,
          startIndex + CHUNK_SIZE + crypto_secretstream_xchacha20poly1305_ABYTES
        )
        .arrayBuffer()
        .then((chunk) => {
          if (currentOperation !== operationId) return;
          index =
            startIndex +
            CHUNK_SIZE +
            crypto_secretstream_xchacha20poly1305_ABYTES;
          postToWorker(reg.active,
            { cmd: "decryptFirstChunk", chunk, last: index >= file.size },
            [chunk]
          ); // transfer chunk ArrayBuffer to service worker
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
    });
  };

  const continueDecryption = (e) => {
    const currentOperation = operationId;
    file = files[currFile];

    navigator.serviceWorker.ready.then((reg) => {
      if (currentOperation !== operationId) return;
      file
        .slice(
          index,
          index + CHUNK_SIZE + crypto_secretstream_xchacha20poly1305_ABYTES
        )
        .arrayBuffer()
        .then((chunk) => {
          if (currentOperation !== operationId) return;
          index += CHUNK_SIZE + crypto_secretstream_xchacha20poly1305_ABYTES;
          postToWorker(e.source,
            { cmd: "decryptRestOfChunks", chunk, last: index >= file.size },
            [chunk]
          );
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
    });
  };

  useEffect(() => {
    if (query.tab === "decryption" && query.publicKey) {
      setPublicKey(query.publicKey);
      publicKey = query.publicKey;
      setPkAlert(true);
      setDecryptionMethod("publicKey");
      decryptionMethodState = "publicKey";
    }
  }, [query.publicKey, query.tab]);

  useEffect(() => {
    const onMessage = (e) => {
      if (!e.data || (e.data.kind && e.data.kind !== "decryption")) return;
      if (e.data.operationId && e.data.operationId !== operationId &&
          e.data.reply !== "filePreparedDec") return;
      switch (e.data.reply) {
        case "operationError":
          handleOperationError();
          break;
        case "badFile":
          setErrorFile(files[currFile]?.name);
          if (numberOfFiles > 1) {
            setbadFile(files[currFile].name);
            setIsCheckingFile(false);
          } else {
            setbadFile(true);
            setIsCheckingFile(false);
          }
          break;

        case "oldVersion":
          setErrorFile(files[currFile]?.name);
          if (numberOfFiles > 1) {
            setOldVersion(files[currFile].name);
            setIsCheckingFile(false);
          } else {
            setOldVersion(true);
            setIsCheckingFile(false);
          }
          break;

        case "secretKeyEncryption":
          if (numberOfFiles > 1) {
            if (
              decryptionMethodState &&
              decryptionMethodState !== "secretKey"
            ) {
              checkFileMixUp();
              return;
            } else {
              decryptionMethodState = "secretKey";
              setDecryptionMethod("secretKey");
              checkFilesQueue();
            }
          } else {
            setDecryptionMethod("secretKey");
            decryptionMethodState = "secretKey";
            setActiveStep(1);
            setIsCheckingFile(false);
            resetCurrFile();
          }
          break;

        case "publicKeyEncryption":
          if (numberOfFiles > 1) {
            if (
              decryptionMethodState &&
              decryptionMethodState !== "publicKey"
            ) {
              checkFileMixUp();
              return;
            } else {
              decryptionMethodState = "publicKey";
              setDecryptionMethod("publicKey");
              checkFilesQueue();
            }
          } else {
            setDecryptionMethod("publicKey");
            decryptionMethodState = "publicKey";
            setActiveStep(1);
            setIsCheckingFile(false);
            resetCurrFile();
          }
          break;

        case "wrongDecPrivateKey":
          setErrorFile(files[currFile]?.name);
          resetCurrFile();
          setWrongPrivateKey(true);
          setIsTestingKeys(false);
          break;

        case "wrongDecPublicKey":
          setErrorFile(files[currFile]?.name);
          resetCurrFile();
          setWrongPublicKey(true);
          setIsTestingKeys(false);
          break;

        case "wrongDecKeys":
          setErrorFile(files[currFile]?.name);
          resetCurrFile();
          setWrongPublicKey(true);
          setWrongPrivateKey(true);
          setIsTestingKeys(false);
          break;

        case "wrongDecKeyPair":
          setErrorFile(files[currFile]?.name);
          resetCurrFile();
          setKeysError(true);
          setKeysErrorMessage(t("invalid_key_pair"));
          setIsTestingKeys(false);
          break;

        case "wrongDecKeyInput":
          setErrorFile(files[currFile]?.name);
          resetCurrFile();
          setKeysError(true);
          setKeysErrorMessage(t("invalid_keys_input"));
          setIsTestingKeys(false);
          break;

        case "wrongPassword":
          setErrorFile(files[currFile]?.name);
          resetCurrFile();
          setWrongPassword(true);
          setIsTestingPassword(false);
          break;

        case "filePreparedDec":
          if (!pendingRequestId || (e.data.requestId && e.data.requestId !== pendingRequestId)) {
            e.source.postMessage({ cmd: "cancelOperation", operationId: e.data.operationId });
            break;
          }
          pendingRequestId = null;
          operationId = e.data.operationId;
          downloadUrl = e.data.downloadUrl;
          kickOffDecryption();
          break;

        case "readyToDecrypt":
          if (numberOfFiles > 1) {
            checkFilesTestQueue();
          } else {
            setIsTestingKeys(false);
            setIsTestingPassword(false);
            handleNext();
            resetCurrFile();
          }
          break;

        case "decKeyPairGenerated":
          startDecryption("publicKey");
          break;

        case "decKeysGenerated":
          startDecryption("secretKey");
          break;

        case "continueDecryption":
          continueDecryption(e);
          break;

        case "decryptionFinished":
          if (numberOfFiles > 1) {
            updateCurrFile();
            file = null;
            index = null;
            if (currFile <= numberOfFiles - 1) {
              nextFileTimer = setTimeout(function () {
                prepareFile();
              }, 1000);
            } else {
              setIsDownloading(false);
              handleNext();
            }
          } else {
            setIsDownloading(false);
            handleNext();
          }
          break;
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      cancelOperation();
      file = null; files = []; password = null; privateKey = null; publicKey = null;
      currFile = 0; index = null;
      decryptionMethodState = null; decFileBuff = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <FileWorkflow
    direction="decrypt" active={active} step={activeStep} done={activeStep === 3}
    files={Files} onFiles={handleFilesInput} onRemove={updateFilesInput} onFileContinue={checkFiles}
    method={decryptionMethod} password={Password} onPassword={handlePasswordInput}
    publicKey={PublicKey} privateKey={PrivateKey} onPublicKey={handlePublicKeyInput} onPrivateKey={handlePrivateKeyInput}
    publicKeyError={wrongPublicKey} privateKeyError={wrongPrivateKey} keysError={keysError ? keysErrorMessage : null}
    passwordError={wrongPassword} fileError={badFile ? t("file_not_encrypted_corrupted") : oldVersion ? t("old_version") : fileMixUp ? t("file_mixup") : null} operationError={operationError} errorFile={errorFile}
    checking={isCheckingFile} testing={isTestingPassword || isTestingKeys} processing={isDownloading} currentFile={currFileState}
    onCredentialContinue={testFilesDecryption} onBack={handleBack} onReset={handleReset}
    rootProps={getRootProps()} isDragActive={isDragActive} publicKeyNotice={pkAlert}
    onExecute={handleEncryptedFilesDownload} onCancel={handleReset}
  />;
}
