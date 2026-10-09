import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useDropzone } from "react-dropzone";
import FileWorkflow from "./FileWorkflow";
import { getTranslations as t } from "../../locales";
import { generatePassword, generatePassPhrase } from "../utils/generatePassword";
import { computePublicKey } from "../utils/computePublicKey";
import { CHUNK_SIZE } from "../config/Constants";

let file,
  files = [],
  password,
  index,
  currFile = 0,
  numberOfFiles,
  encryptionMethodState = "secretKey",
  privateKey,
  publicKey;

let operationId, downloadUrl, nextFileTimer, pendingRequestId;
const postToWorker = (worker, data, transfer = []) =>
  worker.postMessage({ ...data, operationId }, transfer);
const cancelOperation = () => {
  pendingRequestId = null;
  clearTimeout(nextFileTimer);
  if (operationId && navigator.serviceWorker.controller) {
    postToWorker(navigator.serviceWorker.controller, { cmd: "cancelOperation" });
  }
  operationId = null;
  downloadUrl = null;
};

export default function EncryptionPanel({ active = true }) {

  const [operationError, setOperationError] = useState(false);
  const [errorFile, setErrorFile] = useState(null);
  const handleOperationError = () => {
    setErrorFile(files[currFile]?.name);
    cancelOperation();
    setOperationError(true);
    setIsTestingKeys(false);
    resetCurrFile();
    setIsDownloading(false);
  };

  const router = useRouter();

  const query = router.query;

  const [activeStep, setActiveStep] = useState(0);

  const [Files, setFiles] = useState([]);

  const [currFileState, setCurrFileState] = useState(0);


  const [Password, setPassword] = useState();

  const [PublicKey, setPublicKey] = useState();

  const [PrivateKey, setPrivateKey] = useState();

  const [wrongPublicKey, setWrongPublicKey] = useState(false);

  const [wrongPrivateKey, setWrongPrivateKey] = useState(false);

  const [keysError, setKeysError] = useState(false);

  const [keysErrorMessage, setKeysErrorMessage] = useState();

  const [shortPasswordError, setShortPasswordError] = useState(false);

  const [encryptionMethod, setEncryptionMethod] = useState("secretKey");

  const [isTestingKeys, setIsTestingKeys] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);

  const [shareableLink, setShareableLink] = useState();

  const [pkAlert, setPkAlert] = useState(false);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      handleFilesInput(acceptedFiles);
    },
    noClick: true,
    noKeyboard: true,
    disabled: activeStep !== 0 || isTestingKeys || isDownloading,
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
    encryptionMethodState = method;
  };

  const handleReset = () => {
    setErrorFile(null);
    cancelOperation();
    setOperationError(false);
    setIsTestingKeys(false);
    password = null;
    setActiveStep(0);
    setFiles([]);
    setPassword();
    setPublicKey();
    setPrivateKey();
    privateKey = null;
    publicKey = null;
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setShortPasswordError(false);
    setIsDownloading(false);
    setShareableLink();
    setPkAlert(false);
    file = null;
    files = [];
    numberOfFiles = 0;
    resetCurrFile();
    index = null;
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

  const handleMethodStep = () => {
    if (encryptionMethodState === "secretKey") {
      if (Password?.length >= 12) {
        setActiveStep(2);
      } else {
        setShortPasswordError(true);
      }
    }

    if (encryptionMethodState === "publicKey") {
      setIsTestingKeys(true);
      navigator.serviceWorker.ready.then((reg) => {
        let mode = "test";

        postToWorker(reg.active, {
          cmd: "requestEncKeyPair",
          privateKey,
          publicKey,
          mode,
        });
      }).catch(handleOperationError);
    }
  };

  const generatedPassword = async (kind) => {
    const generated = await (kind === "words" ? generatePassPhrase() : generatePassword());
    password = generated;
    setPassword(generated);
    setShortPasswordError(false);
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
  };

  const updateFilesInput = (index) => {
    files = [...files.slice(0, index), ...files.slice(index + 1)];
    setFiles(files);
  };


  const handlePasswordInput = (selectedPassword) => {
    setShortPasswordError(false);
    password = selectedPassword;
    setPassword(selectedPassword);
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
    let fileName = files[currFile].name + ".enc";
    navigator.serviceWorker.ready.then((reg) => {
      if (pendingRequestId !== requestId) return;
      postToWorker(reg.active, { cmd: "prepareFileNameEnc", fileName, requestId });
    }).catch(handleOperationError);
  };

  const kickOffEncryption = async () => {
    const currentOperation = operationId;
    if (currFile <= numberOfFiles - 1) {
      file = files[currFile];
      window.open(downloadUrl, "_self");
      setIsDownloading(true);

      if (encryptionMethodState === "publicKey") {
        navigator.serviceWorker.ready.then((reg) => {
          if (currentOperation !== operationId) return;
          let mode = "derive";

          postToWorker(reg.active, {
            cmd: "requestEncKeyPair",
            privateKey,
            publicKey,
            mode,
          });
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
      }

      if (encryptionMethodState === "secretKey") {
        navigator.serviceWorker.ready.then((reg) => {
          if (currentOperation !== operationId) return;
          postToWorker(reg.active, { cmd: "requestEncryption", password });
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
      }
    } else {
      // console.log("out of files")
    }
  };

  const startEncryption = (method) => {
    const currentOperation = operationId;
    navigator.serviceWorker.ready.then((reg) => {
      if (currentOperation !== operationId) return;
      file
        .slice(0, CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          if (currentOperation !== operationId) return;
          index = CHUNK_SIZE;

          if (method === "secretKey") {
            postToWorker(reg.active,
              { cmd: "encryptFirstChunk", chunk, last: index >= file.size },
              [chunk]
            );
          }
          if (method === "publicKey") {
            postToWorker(reg.active,
              {
                cmd: "asymmetricEncryptFirstChunk",
                chunk,
                last: index >= file.size,
              },
              [chunk]
            );
          }
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
    });
  };

  const continueEncryption = (e) => {
    const currentOperation = operationId;
    navigator.serviceWorker.ready.then((reg) => {
      if (currentOperation !== operationId) return;
      file
        .slice(index, index + CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          if (currentOperation !== operationId) return;
          index += CHUNK_SIZE;
          postToWorker(e.source,
            { cmd: "encryptRestOfChunks", chunk, last: index >= file.size },
            [chunk]
          );
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
    });
  };

  const createShareableLink = async () => {
    let pk = await computePublicKey(PrivateKey);
    let link = window.location.origin + "/?tab=decryption&publicKey=" + encodeURIComponent(pk);
    setShareableLink(link);
  };

  useEffect(() => {
    const pingSW = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => {
        postToWorker(reg.active, {
          cmd: "pingSW",
        });
      }).catch(handleOperationError);
    }, 15000);
    return () => clearInterval(pingSW);
    // The keepalive only depends on the lifetime of this processing adapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.tab === "encryption" && query.publicKey) {
      setPublicKey(query.publicKey);
      publicKey = query.publicKey;
      setPkAlert(true);
      setEncryptionMethod("publicKey");
      encryptionMethodState = "publicKey";
    }
  }, [query.publicKey, query.tab]);

  useEffect(() => {
    const onMessage = (e) => {
      if (!e.data || (e.data.kind && e.data.kind !== "encryption")) return;
      if (e.data.operationId && e.data.operationId !== operationId &&
          e.data.reply !== "filePreparedEnc") return;
      if (["goodKeyPair", "wrongPrivateKey", "wrongPublicKey", "wrongKeyPair", "wrongKeyInput"].includes(e.data.reply)) setIsTestingKeys(false);
      switch (e.data.reply) {
        case "operationError":
          handleOperationError();
          break;
        case "goodKeyPair":
          setActiveStep(2);
          break;

        case "wrongPrivateKey":
          setWrongPrivateKey(true);
          break;

        case "wrongPublicKey":
          setWrongPublicKey(true);
          break;

        case "wrongKeyPair":
          setKeysError(true);
          setKeysErrorMessage(t("invalid_key_pair"));
          break;

        case "wrongKeyInput":
          setKeysError(true);
          setKeysErrorMessage(t("invalid_keys_input"));
          break;

        case "keysGenerated":
          startEncryption("secretKey");
          break;

        case "keyPairReady":
          startEncryption("publicKey");
          break;

        case "filePreparedEnc":
          if (!pendingRequestId || (e.data.requestId && e.data.requestId !== pendingRequestId)) {
            e.source.postMessage({ cmd: "cancelOperation", operationId: e.data.operationId });
            break;
          }
          pendingRequestId = null;
          operationId = e.data.operationId;
          downloadUrl = e.data.downloadUrl;
          kickOffEncryption();
          break;

        case "continueEncryption":
          continueEncryption(e);
          break;

        case "encryptionFinished":
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
      encryptionMethodState = "secretKey";
    };
    // The handler reads the existing module-level queue; re-registering would cancel it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <FileWorkflow
    direction="encrypt" active={active} step={activeStep} done={activeStep === 3}
    files={Files} onFiles={handleFilesInput} onRemove={updateFilesInput} onFileContinue={handleNext}
    method={encryptionMethod} password={Password} onPassword={handlePasswordInput}
    publicKey={PublicKey} privateKey={PrivateKey} onPublicKey={handlePublicKeyInput} onPrivateKey={handlePrivateKeyInput}
    publicKeyError={wrongPublicKey} privateKeyError={wrongPrivateKey} keysError={keysError ? keysErrorMessage : null}
    passwordError={shortPasswordError} fileError={null} operationError={operationError} errorFile={errorFile}
    checking={false} testing={isTestingKeys} processing={isDownloading} currentFile={currFileState}
    onCredentialContinue={handleMethodStep} onBack={handleBack} onReset={handleReset}
    rootProps={getRootProps()} isDragActive={isDragActive} publicKeyNotice={pkAlert}
    onMethod={handleRadioChange} onGenerate={generatedPassword} shareableLink={shareableLink} onCreateLink={createShareableLink}
    onExecute={handleEncryptedFilesDownload} onCancel={handleReset}
  />;
}
