"use client";

import { useEffect, useState } from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { AlertTriangle, CameraOff, X } from "lucide-react";

interface QrScannerModalProps {
  onScan: (url: string) => void;
  onClose: () => void;
}

export function QrScannerModal({ onScan, onClose }: QrScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 relative animate-fade-in">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-slate-800">
          <h2 id="qr-scanner-title" className="font-bold text-gray-900 dark:text-white">
            Scanner un ticket
          </h2>
          <button
            type="button"
            aria-label="Fermer le scanner"
            onClick={onClose}
            className="p-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-square w-full bg-black overflow-hidden flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center text-white space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <CameraOff className="w-6 h-6" />
              </div>
              <p className="font-semibold text-sm">Accès à la caméra impossible</p>
              <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={() => setCameraError(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-colors"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <Scanner
              onScan={(result: IDetectedBarcode[]) => {
                if (result && result.length > 0 && result[0].rawValue) {
                  onScan(result[0].rawValue);
                }
              }}
              onError={(err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err || "");
                if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
                  setCameraError(
                    "Veuillez autoriser l'accès à l'appareil photo dans les paramètres de votre navigateur ou de votre téléphone."
                  );
                } else {
                  setCameraError(
                    "Aucune caméra détectée ou appareil photo déjà utilisé par une autre application."
                  );
                }
              }}
              components={{
                finder: true,
              }}
            />
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-slate-800/70 text-center text-xs sm:text-sm text-gray-500 dark:text-slate-400 leading-relaxed flex items-center justify-center gap-2">
          {cameraError ? (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Vous pouvez aussi saisir le code de commande dans la barre de recherche.</span>
            </>
          ) : (
            <span>Placez le QR Code du reçu au centre du cadre pour retrouver la commande instantanément.</span>
          )}
        </div>
      </div>
    </div>
  );
}
