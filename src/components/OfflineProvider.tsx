import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { registerAppWorker } from "../utils/appWorker";
import { getTranslations as t } from "../../locales";

type OfflineStatus = "preparing" | "ready" | "unavailable";
type HomeScreenMode = "browser" | "app" | null;
const OfflineContext = createContext({ online: true });
export const useOnlineStatus = () => useContext(OfflineContext).online;

function getHomeScreenMode(): HomeScreenMode {
  if (window.top !== window) return null;
  const device = navigator as Navigator & { standalone?: boolean };
  // iPadOS can identify itself as a Mac when requesting desktop websites.
  const appleMobile = /iPhone|iPad|iPod/i.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1);
  if (!appleMobile) return null;
  return device.standalone || window.matchMedia("(display-mode: standalone)").matches ? "app" : "browser";
}

export default function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState<OfflineStatus>("preparing");
  const [homeScreenMode, setHomeScreenMode] = useState<HomeScreenMode>(null);
  // Read browser-only capabilities after hydration; keep the static render deterministic.
  useEffect(() => {
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let stopCheck: (() => void) | undefined;
    const workers = new Set<ServiceWorker>();
    const updateOnline = () => setOnline(navigator.onLine);
    const check = (worker: ServiceWorker) => {
      const channel = new MessageChannel();
      stopCheck = () => {
        clearTimeout(timer);
        channel.port1.onmessage = null;
        channel.port1.close();
        channel.port2.close();
        stopCheck = undefined;
      };
      const finish = (ready: boolean) => {
        stopCheck?.();
        setStatus(ready ? "ready" : "unavailable");
      };
      let timer = setTimeout(() => finish(false), 3000);
      channel.port1.onmessage = event => {
        if (event.data?.repairing === true) {
          setStatus("preparing");
          clearTimeout(timer);
          timer = setTimeout(() => finish(false), 60000);
        } else {
          finish(event.data?.ready === true);
        }
      };
      try {
        worker.postMessage({ cmd: "getOfflineStatus", repair: navigator.onLine }, [channel.port2]);
      } catch {
        finish(false);
      }
    };
    const updateRegistrationStatus = () => {
      if (disposed || !registration) return;
      // A worker can report redundancy before the registration clears its slot.
      const [installing, waiting, active] = [registration.installing, registration.waiting, registration.active]
        .map(worker => worker?.state === "redundant" ? null : worker);
      const controlled = Boolean(navigator.serviceWorker.controller);
      const currentWorkers = controlled ? [] : [installing, waiting, active];
      for (const worker of workers) {
        if (currentWorkers.includes(worker)) continue;
        worker.removeEventListener("statechange", updateRegistrationStatus);
        workers.delete(worker);
      }
      for (const worker of currentWorkers) {
        if (!worker || workers.has(worker)) continue;
        worker.addEventListener("statechange", updateRegistrationStatus);
        workers.add(worker);
      }
      if (controlled) return;
      // A forced reload can bypass an activated worker even when an update is pending.
      const preparing = active ? active.state !== "activated" : Boolean(installing || waiting);
      setStatus(preparing ? "preparing" : "unavailable");
    };
    const controllerChanged = () => {
      if (disposed) return;
      stopCheck?.();
      updateRegistrationStatus();
      const controller = navigator.serviceWorker.controller;
      if (controller) check(controller);
    };
    updateOnline();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Safari exposes the launch mode on the client.
    setHomeScreenMode(getHomeScreenMode());
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    registerAppWorker().then(result => {
      if (disposed) return;
      registration = result;
      if (!result) { setStatus("unavailable"); return; }
      navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
      result.addEventListener("updatefound", updateRegistrationStatus);
      controllerChanged();
    });
    return () => {
      disposed = true;
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged);
      registration?.removeEventListener("updatefound", updateRegistrationStatus);
      workers.forEach(worker => worker.removeEventListener("statechange", updateRegistrationStatus));
      stopCheck?.();
    };
  }, []);
  return <OfflineContext.Provider value={{ online }}>
    <Box sx={{ px: 2, py: 0.5, textAlign: "center", bgcolor: "background.default" }}>
      <Typography component="p" variant="caption" color="text.secondary" role="status" data-testid="offline-status" data-state={status}>
        {t(status === "ready" ? "pwa_ready" : status === "preparing" ? "pwa_preparing" : "pwa_unavailable")}
      </Typography>
      {homeScreenMode === "browser" && (
        <Typography component="p" variant="caption" color="text.secondary">{t("pwa_home_screen_setup")}</Typography>
      )}
      {homeScreenMode === "app" && status === "preparing" && (
        <Typography component="p" variant="caption" color="text.secondary">{t("pwa_home_screen_preparing")}</Typography>
      )}
    </Box>
    {children}
  </OfflineContext.Provider>;
}
