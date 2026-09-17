"use client";

import { useState } from "react";
import { X, WalletCards, AlertCircle, ArrowRight } from "lucide-react";
import { formatFCFA } from "@/lib/cash";

interface CashRegister {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  activeSession: any;
}

interface OpenSessionModalProps {
  registers: CashRegister[];
  onClose: () => void;
  onSuccess: (session: any) => void;
}

const QUICK_AMOUNTS = [0, 10000, 20000, 25000, 50000];

export function OpenSessionModal({ registers, onClose, onSuccess }: OpenSessionModalProps) {
  const availableRegisters = registers.filter((r) => !r.activeSession);
  const defaultReg = availableRegisters.find((r) => r.isDefault) || availableRegisters[0];

  const [registerId, setRegisterId] = useState(defaultReg?.id || "");
  const [openingAmount, setOpeningAmount] = useState<number>(20000);
  const [openingNote, setOpeningNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerId) {
      setError("Veuillez sélectionner une caisse.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/cash-sessions/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId,
          openingAmount: Number(openingAmount) || 0,
          openingNote: openingNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'ouverture de la session");
      }

      onSuccess(data.data);
    } catch (err: any) {
      setError(err.message || "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-4 sm:px-6 py-4 sm:py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md">
              <WalletCards className="w-5 h-5 text-teal-100" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Ouvrir la Caisse</h2>
              <p className="text-xs text-teal-100">Démarrer une nouvelle vacation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Register Select */}
          {availableRegisters.length > 1 ? (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                Sélectionner la Caisse
              </label>
              <select
                value={registerId}
                onChange={(e) => setRegisterId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
              >
                {availableRegisters.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name} ({reg.code}) {reg.isDefault ? "— Par défaut" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 block font-medium">Caisse assignée</span>
                <span className="text-sm font-bold text-gray-800">
                  {defaultReg ? `${defaultReg.name} (${defaultReg.code})` : "Caisse Principale"}
                </span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                Prête
              </span>
            </div>
          )}

          {/* Opening float amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Fond de Caisse Initial (FCFA)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="500"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xl font-black text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                placeholder="0"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm text-gray-400">
                FCFA
              </span>
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap gap-2 mt-2.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOpeningAmount(amt)}
                  className={`text-xs px-2.5 py-1.5 rounded-xl font-medium transition ${
                    openingAmount === amt
                      ? "bg-teal-600 text-white shadow-sm shadow-teal-600/30"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {formatFCFA(amt)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Monnaie présente physiquement dans le tiroir au début du service.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Observation / Note (facultatif)
            </label>
            <textarea
              rows={2}
              value={openingNote}
              onChange={(e) => setOpeningNote(e.target.value)}
              placeholder="Ex : Remise de 20 000 F en coupures de 2 000 et 1 000 F..."
              className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !registerId}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-2xl font-bold text-sm hover:from-teal-700 hover:to-teal-800 shadow-md shadow-teal-700/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Ouvrir la caisse</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
