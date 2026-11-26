import { useEffect, useState } from "react";
import { useWorkflow } from "../components/WorkflowContext";
import { registerAppWorker } from "./appWorker";
import { waitForWorkerControl, hasWorkerProtocol } from "./workerSupport";

export default function useFileProcessingSupport(): boolean | null {
  const [streaming, setStreaming] = useState<boolean | null>(null);
  const streamingEnabled = streaming === true;
  const [verifiedWorker, setVerifiedWorker] = useState<ServiceWorker | null>(null);
  const { busy, dirty } = useWorkflow();
  useEffect(() => {
    if (streamingEnabled) return;
    const safari = /Safari/.test(navigator.userAgent) && /Apple/.test(navigator.vendor);
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (safari || mobile || !window.isSecureContext || !("serviceWorker" in navigator) ||
        typeof ReadableStream === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The browser capabilities are available after hydration.
      setStreaming(false);
      return;
    }

    const workers = navigator.serviceWorker;
    let disposed = false;
    let activatingWorker: ServiceWorker | null = null;
    const checkController = async () => {
      const controller = workers.controller;
      activatingWorker?.removeEventListener("statechange", checkController);
      activatingWorker = null;
      if (!controller || controller.state === "redundant") return;
      if (controller.state === "activating") {
        // The worker can claim the page before its activation work finishes.
        activatingWorker = controller;
        controller.addEventListener("statechange", checkController);
        return;
      }
      if (await hasWorkerProtocol(navigator) && !disposed && workers.controller === controller) {
        setVerifiedWorker(controller);
      }
    };
    const watchController = () => {
      if (disposed) return;
      // A first install can finish after the initial wait for control ends.
      workers.addEventListener("controllerchange", checkController);
      void checkController();
    };
    const initialize = async () => {
      const controller = workers.controller;
      if (controller?.state === "activated") {
        // On a controlled navigation, select the mode before mounting the file inputs.
        const supported = await hasWorkerProtocol(navigator);
        if (disposed) return;
        if (workers.controller === controller) {
          if (!supported) workers.addEventListener("controllerchange", checkController);
          setStreaming(supported);
          return;
        }
      }
      // A first visit can accept files while the worker installs in the background.
      setStreaming(false);
      if (workers.controller) watchController();
      else void waitForWorkerControl(navigator, 5000, registerAppWorker).then(watchController);
    };
    void initialize();
    return () => {
      disposed = true;
      workers.removeEventListener("controllerchange", checkController);
      activatingWorker?.removeEventListener("statechange", checkController);
    };
  }, [streamingEnabled]);

  useEffect(() => {
    if (streaming !== false || busy || dirty || !verifiedWorker || navigator.serviceWorker.controller !== verifiedWorker) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Latch the verified mode before a new file workflow begins.
    setStreaming(true);
  }, [streaming, busy, dirty, verifiedWorker]);

  return streaming;
}
