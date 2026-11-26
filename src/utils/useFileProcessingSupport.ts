import { useEffect, useState } from "react";
import { useWorkflow } from "../components/WorkflowContext";
import { registerAppWorker } from "./appWorker";
import { waitForWorkerControl, watchWorkerProtocol } from "./workerSupport";

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
    let stopProtocolCheck: (() => void) | undefined;
    const checkController = () => {
      stopProtocolCheck?.();
      stopProtocolCheck = undefined;
      activatingWorker?.removeEventListener("statechange", checkController);
      activatingWorker = null;
      const controller = workers.controller;
      if (controller?.state !== "activated") {
        setStreaming(current => current ?? false);
        if (controller && controller.state !== "redundant") {
          // The control event can arrive before the client sees the latest worker state.
          activatingWorker = controller;
          controller.addEventListener("statechange", checkController);
        }
        return;
      }
      stopProtocolCheck = watchWorkerProtocol(controller, supported => {
        if (workers.controller !== controller) return;
        if (supported) setVerifiedWorker(controller);
        // On a controlled navigation, select the mode before mounting the file inputs.
        setStreaming(current => current ?? supported);
      });
    };
    const watchController = () => {
      if (disposed) return;
      // A first install can finish after the initial wait for control ends.
      workers.addEventListener("controllerchange", checkController);
      checkController();
    };
    if (workers.controller) {
      watchController();
    } else {
      // A first visit can accept files while the worker installs in the background.
      setStreaming(false);
      void waitForWorkerControl(navigator, 5000, registerAppWorker).then(watchController);
    }
    return () => {
      disposed = true;
      workers.removeEventListener("controllerchange", checkController);
      activatingWorker?.removeEventListener("statechange", checkController);
      stopProtocolCheck?.();
    };
  }, [streamingEnabled]);

  useEffect(() => {
    if (streaming !== false || busy || dirty || !verifiedWorker || navigator.serviceWorker.controller !== verifiedWorker) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Latch the verified mode before a new file workflow begins.
    setStreaming(true);
  }, [streaming, busy, dirty, verifiedWorker]);

  return streaming;
}
