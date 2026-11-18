export interface ServiceWorkerControllerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

export interface ServiceWorkerContainerLike {
  controller?: ServiceWorkerControllerLike | null;
  register?(scriptURL: string): Promise<unknown>;
  addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}

export interface WorkerNavigatorLike {
  serviceWorker: ServiceWorkerContainerLike;
}

export async function registerWorker(
  navigator: WorkerNavigatorLike,
  timeoutMs = 5000,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onChange: (() => void) | undefined;
  let finished = false;
  try {
    return await Promise.race([
      (async () => {
        await navigator.serviceWorker.register!("/service-worker.js");
        if (finished) return false;
        if (navigator.serviceWorker.controller) return true;
        return new Promise<boolean>(resolve => {
          onChange = () => {
            if (navigator.serviceWorker.controller) resolve(true);
          };
          navigator.serviceWorker.addEventListener?.("controllerchange", onChange);
          onChange();
        });
      })(),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } catch { return false; }
  finally {
    finished = true;
    clearTimeout(timer);
    if (onChange) navigator.serviceWorker.removeEventListener?.("controllerchange", onChange);
  }
}

export function hasWorkerProtocol(
  navigator: WorkerNavigatorLike,
  timeoutMs = 2000,
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const channel = new MessageChannel();
    const finish = (value: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<{ version?: number }>) =>
      finish(event.data?.version === 1);
    try {
      navigator.serviceWorker.controller!.postMessage(
        { cmd: "getProtocolVersion" },
        [channel.port2],
      );
    } catch { finish(false); }
  });
}
