import { useEffect, useState } from "react";
import { registerWorker, hasWorkerProtocol } from "./workerSupport";

export default function useFileProcessingSupport() {
  const [support, setSupport] = useState({ loading: true, streaming: false });
  useEffect(() => {
    let mounted = true;
    const safari = /Safari/.test(navigator.userAgent) && /Apple/.test(navigator.vendor);
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const canStream = !safari && !mobile && window.isSecureContext &&
      "serviceWorker" in navigator && typeof ReadableStream !== "undefined";
    (async () => {
      const streaming = canStream && await registerWorker(navigator) &&
        await hasWorkerProtocol(navigator);
      if (mounted) setSupport({ loading: false, streaming });
    })();
    return () => { mounted = false; };
  }, []);
  return support;
}
