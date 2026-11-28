export interface ServiceWorkerControllerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

type WorkerStateSource = Pick<ServiceWorker, "state" | "addEventListener" | "removeEventListener">;

interface WorkerRegistrationLike {
  installing: WorkerStateSource | null;
  waiting: WorkerStateSource | null;
  active: WorkerStateSource | null;
}

export interface ServiceWorkerContainerLike {
  controller?: ServiceWorkerControllerLike | null;
  register?(scriptURL: string): Promise<WorkerRegistrationLike | null | void>;
  addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}

export interface WorkerNavigatorLike {
  serviceWorker: ServiceWorkerContainerLike;
}

export async function registerWorker(navigator: WorkerNavigatorLike, timeoutMs = 5000): Promise<boolean> {
  return waitForWorkerControl(navigator, timeoutMs, async () => {
    if (!navigator.serviceWorker.register) throw new Error("Service workers unavailable");
    return navigator.serviceWorker.register("/service-worker.js");
  });
}

export async function waitForWorkerControl(
  navigator: WorkerNavigatorLike,
  timeoutMs = 5000,
  register: () => Promise<WorkerRegistrationLike | null | void> = async () => {},
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onChange: (() => void) | undefined;
  let worker: WorkerStateSource | null | undefined;
  let finished = false;
  try {
    return await Promise.race([
      (async () => {
        // registerAppWorker fulfills with null when registration is unavailable.
        // Do not wait for a controller that cannot arrive in this case.
        const registration = await register();
        if (registration === null || finished) return false;
        if (navigator.serviceWorker.controller) return true;
        worker = registration?.installing ?? registration?.waiting ?? registration?.active;
        if (registration?.installing === null && registration.waiting === null && registration.active === null) return false;
        const addEventListener = navigator.serviceWorker.addEventListener;
        if (!addEventListener) return false;
        return new Promise<boolean>(resolve => {
          onChange = () => {
            if (navigator.serviceWorker.controller) resolve(true);
            else if (worker?.state === "redundant") resolve(false);
          };
          addEventListener.call(navigator.serviceWorker, "controllerchange", onChange);
          worker?.addEventListener("statechange", onChange);
          onChange();
        });
      })(),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } catch { return false; }
  finally {
    finished = true;
    clearTimeout(timer);
    if (onChange) {
      navigator.serviceWorker.removeEventListener?.("controllerchange", onChange);
      worker?.removeEventListener("statechange", onChange);
    }
  }
}

export function watchWorkerProtocol(
  controller: ServiceWorkerControllerLike,
  onResult: (supported: boolean) => void,
  timeoutMs = 2000,
): () => void {
  const channel = new MessageChannel();
  // Let the UI fall back while keeping the channel open for slow worker initialization.
  const timer = setTimeout(() => onResult(false), timeoutMs);
  const stop = () => {
    clearTimeout(timer);
    channel.port1.onmessage = null;
    channel.port1.close();
    channel.port2.close();
  };
  channel.port1.onmessage = (event: MessageEvent<{ version?: number }>) => {
    stop();
    onResult(event.data?.version === 1);
  };
  try {
    controller.postMessage({ cmd: "getProtocolVersion" }, [channel.port2]);
  } catch {
    stop();
    onResult(false);
  }
  return stop;
}
