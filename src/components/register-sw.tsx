"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [pendingActions, setPendingActions] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [queueError, setQueueError] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsOffline(!navigator.onLine);
    setPendingActions(getOfflineQueueCount());

    // Detect Windows OS
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const navPlatform =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
        : undefined;
    const isWin =
      /windows|win32|win64/i.test(ua) || (navPlatform ? /windows/i.test(navPlatform) : false);
    setIsWindows(isWin);

    // Check if dismissed before
    try {
      if (typeof window !== "undefined" && localStorage.getItem("pressipro_hide_pwa_install") === "1") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore localStorage restrictions
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone =
      "standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(standalone || iosStandalone);
  }, []);

  useEffect(() => {
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
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const syncTimer = window.setTimeout(() => {
      void syncQueue();
    }, 0);

    const unsubscribeQueue = subscribeOfflineQueue(handleQueueUpdate);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", updateConnectionStatus);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.clearTimeout(syncTimer);
      unsubscribeQueue();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", updateConnectionStatus);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  // Suppressed completely on Windows desktop as requested by user
  const canInstall = Boolean(installPrompt) && !isInstalled && !isWindows && !isDismissed;

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

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    try {
      localStorage.setItem("pressipro_hide_pwa_install", "1");
    } catch {
      // Ignore
    }
  };

  if (!mounted) {
    return null;
  }

  if (!canInstall && !isOffline && pendingActions === 0 && !isSyncingQueue && !queueError) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-3 z-[70] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {(pendingActions > 0 || isSyncingQueue || queueError) && (
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 shadow-lg">
          <RefreshCw className={`h-4 w-4 ${isSyncingQueue ? "animate-spin" : ""}`} />
          <span>
            {isSyncingQueue
              ? "Synchronisation des actions..."
              : pendingActions > 0
              ? `${pendingActions} action${pendingActions > 1 ? "s" : ""} en attente`
              : queueError
              ? "Certaines actions n'ont pas encore été rejouées"
              : "Synchronisation terminée"}
          </span>
        </div>
      )}

      {isOffline && (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 shadow-lg">
          <WifiOff className="h-4 w-4" />
          <span>Mode hors connexion</span>
        </div>
      )}

      {canInstall && (
        <div className="relative group">
          <button
            type="button"
            onClick={handleInstall}
            disabled={isInstalling}
            className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 pr-9 pl-4 py-3 text-sm font-semibold text-white shadow-xl shadow-primary-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-primary-500/40 disabled:cursor-wait disabled:opacity-80"
            aria-label="Télécharger l'application PressiPro"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/16 ring-1 ring-white/20">
              <Download className="h-4 w-4" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span>{isInstalling ? "Installation..." : "Télécharger l'app"}</span>
              <span className="text-[11px] font-medium text-primary-100">
                Installation rapide sur mobile
              </span>
            </span>
            <Wifi className="hidden h-4 w-4 text-primary-100 sm:block" />
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            title="Ne plus afficher"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
