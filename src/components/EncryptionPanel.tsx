import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useDropzone } from "react-dropzone";
import FileWorkflow, { type EncryptionMethod, type PasswordGenerationKind } from "./FileWorkflow";
import { getTranslations as t } from "../../locales";
import { generatePassword, generatePassPhrase } from "../utils/generatePassword";
import { computePublicKey } from "../utils/computePublicKey";
import { CHUNK_SIZE } from "../config/Constants";
import { downloadStream } from "../utils/downloadStream";

let file: File | null = null,
  files: File[] = [],
  password: string | null | undefined,
  index: number | null = null,
  currFile = 0,
  numberOfFiles = 0,
  encryptionMethodState: EncryptionMethod = "secretKey",
  privateKey: string | null | undefined,
  publicKey: string | null | undefined;

let operationId: string | null = null,
  downloadUrl: string | null = null,
  nextFileTimer: ReturnType<typeof setTimeout> | undefined,
  pendingRequestId: string | null = null,
  releaseDownload: (() => void) | null = null;

const postToWorker = (
  worker: ServiceWorker | MessagePort | MessageEventSource | null,
  data: Record<string, unknown>,
  transfer: Transferable[] = [],
) => {
  if (!worker || !("postMessage" in worker)) {
    throw new Error("Service worker unavailable");
  }
  (worker as ServiceWorker).postMessage({ ...data, operationId }, transfer);
};

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

export interface EncryptionPanelProps {
  active?: boolean;
}

export default function EncryptionPanel({ active = true }: EncryptionPanelProps) {

  const [operationError, setOperationError] = useState(false);
  const [errorFile, setErrorFile] = useState<string | null>(null);
  const handleOperationError = () => {
    setErrorFile(files[currFile]?.name ?? null);
    cancelOperation();
    setOperationError(true);
    setIsTestingKeys(false);
    resetCurrFile();
    setIsDownloading(false);
  };

  const router = useRouter();

  const query = router.query;

  const [activeStep, setActiveStep] = useState(0);

  const [Files, setFiles] = useState<File[]>([]);

  const [currFileState, setCurrFileState] = useState(0);


  const [Password, setPassword] = useState<string | undefined>();

  const [PublicKey, setPublicKey] = useState<string | undefined>();

  const [PrivateKey, setPrivateKey] = useState<string | undefined>();

  const [wrongPublicKey, setWrongPublicKey] = useState(false);

  const [wrongPrivateKey, setWrongPrivateKey] = useState(false);

  const [keysError, setKeysError] = useState(false);

  const [keysErrorMessage, setKeysErrorMessage] = useState<string | undefined>();

  const [shortPasswordError, setShortPasswordError] = useState(false);

  const [encryptionMethod, setEncryptionMethod] = useState<EncryptionMethod>("secretKey");

  const [isTestingKeys, setIsTestingKeys] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);

  const [shareableLink, setShareableLink] = useState<string | undefined>();

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

  const handleRadioChange = (method: EncryptionMethod) => {
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
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    password = null;
    setActiveStep(0);
    setFiles([]);
    setPassword(undefined);
    setPublicKey(undefined);
    setPrivateKey(undefined);
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    privateKey = null;
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    publicKey = null;
    setWrongPublicKey(false);
    setWrongPrivateKey(false);
    setKeysError(false);
    setShortPasswordError(false);
    setIsDownloading(false);
    setShareableLink(undefined);
    setPkAlert(false);
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    file = null;
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    files = [];
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    numberOfFiles = 0;
    resetCurrFile();
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
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
      if (Password && Password.length >= 12) {
        setActiveStep(2);
      } else {
        setShortPasswordError(true);
      }
    }

    if (encryptionMethodState === "publicKey") {
      setIsTestingKeys(true);
      navigator.serviceWorker.ready.then((reg) => {
        const mode = "test";

        postToWorker(reg.active, {
          cmd: "requestEncKeyPair",
          privateKey,
          publicKey,
          mode,
        });
      }).catch(handleOperationError);
    }
  };

  const generatedPassword = async (kind: PasswordGenerationKind) => {
    const generated = await (kind === "words" ? generatePassPhrase() : generatePassword());
    password = generated;
    setPassword(generated);
    setShortPasswordError(false);
  };

  const handleFilesInput = (selectedFiles: File[]) => {
    selectedFiles = Array.from(selectedFiles);
    if (files.length > 0) {
      files = files.concat(selectedFiles);
      files = files.filter(
        (thing, idx, self) =>
          idx ===
          self.findIndex((t) => t.name === thing.name && t.size === thing.size)
      );
    } else {
      files = selectedFiles;
    }
    setFiles(files);
  };

  const updateFilesInput = (fileIndex: number) => {
    files = [...files.slice(0, fileIndex), ...files.slice(fileIndex + 1)];
    setFiles(files);
  };


  const handlePasswordInput = (selectedPassword: string) => {
    setShortPasswordError(false);
    password = selectedPassword;
    setPassword(selectedPassword);
  };

  const handlePublicKeyInput = (selectedKey: string) => {
    setPublicKey(selectedKey);
    publicKey = selectedKey;
    setWrongPublicKey(false);
  };

  const handlePrivateKeyInput = (selectedKey: string) => {
    setPrivateKey(selectedKey);
    privateKey = selectedKey;
    setWrongPrivateKey(false);
  };

  const handleEncryptedFilesDownload = async () => {
    setIsDownloading(true);
    resetCurrFile();
    // eslint-disable-next-line react-hooks/globals -- This callback updates legacy processing state on user/worker events, never during render.
    numberOfFiles = Files.length;
    prepareFile();
  };

  const prepareFile = () => {
    const requestId = crypto.randomUUID();
    pendingRequestId = requestId;
    setOperationError(false);
    // send file name to sw
    const fileName = files[currFile].name + ".enc";
    navigator.serviceWorker.ready.then((reg) => {
      if (pendingRequestId !== requestId) return;
      postToWorker(reg.active, { cmd: "prepareFileNameEnc", fileName, requestId });
    }).catch(handleOperationError);
  };

  const kickOffEncryption = async () => {
    const currentOperation = operationId;
    if (currFile <= numberOfFiles - 1) {
      file = files[currFile];
      if (!file || !downloadUrl) {
        handleOperationError();
        return;
      }
      releaseDownload?.();
      releaseDownload = downloadStream(downloadUrl);
      setIsDownloading(true);

      if (encryptionMethodState === "publicKey") {
        navigator.serviceWorker.ready.then((reg) => {
          if (currentOperation !== operationId) return;
          const mode = "derive";

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

  const startEncryption = (method: EncryptionMethod) => {
    const currentOperation = operationId;
    navigator.serviceWorker.ready.then((reg) => {
      if (currentOperation !== operationId) return;
      if (!file) {
        handleOperationError();
        return;
      }
      const currentFile = file;
      currentFile
        .slice(0, CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          if (currentOperation !== operationId) return;
          index = CHUNK_SIZE;

          if (method === "secretKey") {
            postToWorker(reg.active,
              { cmd: "encryptFirstChunk", chunk, last: index >= currentFile.size },
              [chunk]
            );
          }
          if (method === "publicKey") {
            postToWorker(reg.active,
              {
                cmd: "asymmetricEncryptFirstChunk",
                chunk,
                last: index >= currentFile.size,
              },
              [chunk]
            );
          }
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
    }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
  };

  const continueEncryption = (e: MessageEvent) => {
    const currentOperation = operationId;
    navigator.serviceWorker.ready.then(() => {
      if (currentOperation !== operationId) return;
      if (!file || index === null) {
        handleOperationError();
        return;
      }
      const currentFile = file;
      currentFile
        .slice(index, index + CHUNK_SIZE)
        .arrayBuffer()
        .then((chunk) => {
          if (currentOperation !== operationId) return;
          if (index === null) {
            handleOperationError();
            return;
          }
          index += CHUNK_SIZE;
          postToWorker(e.source,
            { cmd: "encryptRestOfChunks", chunk, last: index >= currentFile.size },
            [chunk]
          );
        }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
    }).catch(() => { if (currentOperation === operationId) handleOperationError(); });
  };

  const createShareableLink = async () => {
    if (!PrivateKey) throw new Error("Missing private key");
    const pk = await computePublicKey(PrivateKey);
    const link = window.location.origin + "/?tab=decryption&publicKey=" + encodeURIComponent(pk);
    setShareableLink(link);
  };

  useEffect(() => {
    const pingSW = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => {
        if (!reg.active) return;
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
    const queryPublicKey = Array.isArray(query.publicKey) ? query.publicKey[0] : query.publicKey;
    if (query.tab === "encryption" && queryPublicKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Apply public-key invitations from the router after hydration, preserving editable credential state.
      setPublicKey(queryPublicKey);
      publicKey = queryPublicKey;
      setPkAlert(true);
      setEncryptionMethod("publicKey");
      encryptionMethodState = "publicKey";
    }
  }, [query.publicKey, query.tab]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
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
            (e.source as ServiceWorker | null)?.postMessage({ cmd: "cancelOperation", operationId: e.data.operationId });
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
