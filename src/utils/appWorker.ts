let registration: Promise<ServiceWorkerRegistration | null> | undefined;

// All pages share one registration, independent of streaming support.
export function registerAppWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return Promise.resolve(null);
  return registration ??= navigator.serviceWorker.register("/service-worker.js")
    .catch(() => { registration = undefined; return null; });
}
