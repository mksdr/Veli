import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { registerAppWorker } from "../utils/appWorker";
import { getTranslations as t } from "../../locales";

type OfflineStatus = "preparing" | "ready" | "unavailable";
const OfflineContext = createContext({ online: true });
export const useOnlineStatus = () => useContext(OfflineContext).online;

export default function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState<OfflineStatus>("preparing");
  // Read browser-only capabilities after hydration; keep the static render deterministic.
  useEffect(() => {
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    const workers = new Set<ServiceWorker>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const channels = new Set<MessageChannel>();
    const updateOnline = () => setOnline(navigator.onLine);
    const check = () => {
      if (disposed) return;
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      channels.add(channel);
      const finish = (ready: boolean) => {
        if (!disposed) setStatus(ready ? "ready" : "unavailable");
        channel.port1.close(); channel.port2.close(); channels.delete(channel);
        clearTimeout(timer); timers.delete(timer);
      };
      const timer = setTimeout(() => finish(false), 3000);
      timers.add(timer);
      channel.port1.onmessage = event => finish(event.data?.ready === true);
      worker.postMessage({ cmd: "getOfflineStatus" }, [channel.port2]);
    };
    const changed = () => {
      if (disposed || !registration) return;
      if (registration.active && navigator.serviceWorker.controller) check();
      else if (!registration.installing && !registration.waiting) setStatus("unavailable");
    };
    const watch = () => {
      const worker = registration?.installing;
      if (worker && !workers.has(worker)) {
        workers.add(worker);
        worker.addEventListener("statechange", changed);
      }
    };
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener("controllerchange", check);
      registerAppWorker().then(result => {
        if (disposed) return;
        registration = result;
        if (!result) { setStatus("unavailable"); return; }
        result.addEventListener("updatefound", watch);
        watch(); changed();
      });
    // Unsupported browsers still render the same initial HTML before hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    } else setStatus("unavailable");
    return () => {
      disposed = true;
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      navigator.serviceWorker?.removeEventListener("controllerchange", check);
      registration?.removeEventListener("updatefound", watch);
      workers.forEach(worker => worker.removeEventListener("statechange", changed));
      timers.forEach(clearTimeout);
      channels.forEach(channel => { channel.port1.close(); channel.port2.close(); });
    };
  }, []);
  return <OfflineContext.Provider value={{ online }}>
    <Box sx={{ px: 2, py: 0.5, textAlign: "center", bgcolor: "background.default" }}>
      <Typography component="p" variant="caption" color="text.secondary" role="status" data-testid="offline-status" data-state={status}>
        {t(status === "ready" ? "pwa_ready" : status === "preparing" ? "pwa_preparing" : "pwa_unavailable")}
      </Typography>
    </Box>
    {children}
  </OfflineContext.Provider>;
}
