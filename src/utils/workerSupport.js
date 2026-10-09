async function registerWorker(navigator, timeoutMs = 5000) {
  let timer, onChange, finished = false;
  try {
    return await Promise.race([
      (async () => {
        await navigator.serviceWorker.register("/service-worker.js");
        if (finished) return false;
        if (navigator.serviceWorker.controller) return true;
        return new Promise(resolve => {
          onChange = () => {
            if (navigator.serviceWorker.controller) resolve(true);
          };
          navigator.serviceWorker.addEventListener("controllerchange", onChange);
          onChange();
        });
      })(),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } catch { return false; }
  finally {
    finished = true;
    clearTimeout(timer);
    if (onChange) navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }
}

function hasWorkerProtocol(navigator, timeoutMs = 2000) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = value => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.port1.onmessage = event => finish(event.data?.version === 1);
    try {
      navigator.serviceWorker.controller.postMessage({ cmd: "getProtocolVersion" }, [channel.port2]);
    } catch { finish(false); }
  });
}

module.exports = { registerWorker, hasWorkerProtocol };
