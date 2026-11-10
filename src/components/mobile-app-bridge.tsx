"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function resolveDeepLinkPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "http:" || url.protocol === "https:") {
      const path = `${url.pathname || "/"}${url.search || ""}`;
      return path.startsWith("/") ? path : `/${path}`;
    }

    // Schéma personnalisé ex: pressipro://orders/123 -> hostname="orders", pathname="/123"
    const hostSegment = url.hostname ? `/${url.hostname}` : "";
    const pathSegment = url.pathname && url.pathname !== "/" ? url.pathname : "";
    const combined = `${hostSegment}${pathSegment}${url.search || ""}`;
    if (!combined) return "/dashboard";
    return combined.startsWith("/") ? combined : `/${combined}`;
  } catch {
    return null;
  }
}

export function MobileAppBridge() {
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let disposed = false;
    const removers: Array<() => void> = [];

    async function initCapacitor() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (disposed || !Capacitor.isNativePlatform()) return;

        // 1. Masquer le SplashScreen dès que l'interface React est prête
        try {
          const { SplashScreen } = await import("@capacitor/splash-screen");
          if (!disposed) {
            await SplashScreen.hide();
          }
        } catch (e) {
          console.warn("[MobileBridge] SplashScreen hide failed:", e);
        }

        // 2. Configurer la barre de statut native
        try {
          const { StatusBar, Style } = await import("@capacitor/status-bar");
          if (!disposed) {
            const isDark = document.documentElement.classList.contains("dark");
            await StatusBar.setStyle({
              style: isDark ? Style.Dark : Style.Light,
            });
            if (Capacitor.getPlatform() === "android") {
              await StatusBar.setBackgroundColor({ color: "#2563eb" });
            }
          }
        } catch (e) {
          console.warn("[MobileBridge] StatusBar setup failed:", e);
        }

        // 3. Gérer le bouton Retour matériel Android et les Deep Links une seule fois au montage
        try {
          const { App } = await import("@capacitor/app");

          const backHandler = await App.addListener("backButton", ({ canGoBack }) => {
            const current = window.location.pathname;
            const rootPages = ["/", "/dashboard", "/login", "/register", "/offline"];

            if (rootPages.includes(current)) {
              App.exitApp();
            } else if (canGoBack || window.history.length > 1) {
              window.history.back();
            } else {
              routerRef.current.push("/dashboard");
            }
          });

          if (disposed) {
            await backHandler.remove();
            return;
          }
          removers.push(() => {
            void backHandler.remove();
          });

          const urlHandler = await App.addListener("appUrlOpen", (data) => {
            const path = resolveDeepLinkPath(data.url);
            if (path) {
              routerRef.current.push(path);
            }
          });

          if (disposed) {
            await urlHandler.remove();
            return;
          }
          removers.push(() => {
            void urlHandler.remove();
          });
        } catch (e) {
          console.warn("[MobileBridge] App plugin setup failed:", e);
        }
      } catch {
        // Exécution dans un navigateur web standard hors conteneur Capacitor
      }
    }

    void initCapacitor();

    return () => {
      disposed = true;
      while (removers.length > 0) {
        const remove = removers.pop();
        try {
          remove?.();
        } catch {
          // Ignore listener removal errors
        }
      }
    };
  }, []);

  return null;
}
