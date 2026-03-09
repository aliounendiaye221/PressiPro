"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import {
  flushOfflineQueue,
  getOfflineQueueCount,
  subscribeOfflineQueue,
} from "@/lib/offline-queue";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function RegisterSW() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [pendingActions, setPendingActions] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [queueError, setQueueError] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    setPendingActions(getOfflineQueueCount());

    const updateConnectionStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    const updateInstallState = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone =
        "standalone" in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsInstalled(standalone || iosStandalone);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      updateInstallState();
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setIsInstalling(false);
    };

    const syncQueue = async () => {
      const count = getOfflineQueueCount();
      setPendingActions(count);

      if (!navigator.onLine || count === 0) {
        setIsSyncingQueue(false);
        return;
      }

      setIsSyncingQueue(true);
      const result = await flushOfflineQueue();
      setPendingActions(result.remaining);
      setQueueError(result.failed > 0);
      setIsSyncingQueue(false);
    };

    const handleQueueUpdate = () => {
      setPendingActions(getOfflineQueueCount());
    };

    const handleOnline = () => {
      updateConnectionStatus();
      void syncQueue();
    };

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
      });
    }

    updateInstallState();
    void syncQueue();
    const unsubscribeQueue = subscribeOfflineQueue(handleQueueUpdate);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", updateConnectionStatus);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      unsubscribeQueue();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", updateConnectionStatus);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const canInstall = Boolean(installPrompt) && !isInstalled;

  const handleInstall = async () => {
    if (!installPrompt || isInstalling) {
      return;
    }

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome !== "accepted") {
        setIsInstalling(false);
      }
    } catch {
      setIsInstalling(false);
    }
  };

  if (!canInstall && !isOffline && pendingActions === 0 && !isSyncingQueue && !queueError) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {(pendingActions > 0 || isSyncingQueue || queueError) && (
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-3 py-2 text-xs font-semibold text-sky-700 shadow-lg backdrop-blur">
          <RefreshCw className={`h-4 w-4 ${isSyncingQueue ? "animate-spin" : ""}`} />
          <span>
            {isSyncingQueue
              ? "Synchronisation des actions..."
              : pendingActions > 0
              ? `${pendingActions} action${pendingActions > 1 ? "s" : ""} en attente`
              : queueError
              ? "Certaines actions n'ont pas encore ete rejouees"
              : "Synchronisation terminee"}
          </span>
        </div>
      )}

      {isOffline && (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/95 px-3 py-2 text-xs font-semibold text-amber-700 shadow-lg backdrop-blur">
          <WifiOff className="h-4 w-4" />
          <span>Mode hors connexion</span>
        </div>
      )}

      {canInstall && (
        <button
          type="button"
          onClick={handleInstall}
          disabled={isInstalling}
          className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-primary-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-primary-500/40 disabled:cursor-wait disabled:opacity-80"
          aria-label="Télécharger l'application PressiPro"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/16 ring-1 ring-white/20">
            <Download className="h-5 w-5" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span>{isInstalling ? "Installation..." : "Télécharger l'app"}</span>
            <span className="text-[11px] font-medium text-primary-100">
              Installation rapide sur mobile ou PC
            </span>
          </span>
          <Wifi className="hidden h-4 w-4 text-primary-100 sm:block" />
        </button>
      )}
    </div>
  );
}
