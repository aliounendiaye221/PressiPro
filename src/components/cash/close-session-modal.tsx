"use client";

import { useState } from "react";
import { X, Lock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import { formatFCFA } from "@/lib/cash";

interface CloseSessionModalProps {
  sessionId: string;
  sessionNumber: number;
  registerName: string;
  expectedCash: number;
  totalWaveSales: number;
  totalOmSales: number;
  onClose: () => void;
  onSuccess: (closedData: any) => void;
}

const BILL_VALUES = [10000, 5000, 2000, 1000, 500, 200, 100, 50];

export function CloseSessionModal({
  sessionId,
  sessionNumber,
  registerName,
  expectedCash,
  totalWaveSales,
  totalOmSales,
  onClose,
  onSuccess,
}: CloseSessionModalProps) {
  const [actualCash, setActualCash] = useState<number>(expectedCash);
  const [closingNote, setClosingNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counter assistant state
  const [showCounter, setShowCounter] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});

  const handleBillCountChange = (value: number, countStr: string) => {
    const count = Math.max(0, parseInt(countStr) || 0);
    const updated = { ...counts, [value]: count };
    setCounts(updated);

    const totalFromCounter = BILL_VALUES.reduce((sum, val) => {
      return sum + (updated[val] || 0) * val;
    }, 0);

    setActualCash(totalFromCounter);
  };

  const difference = actualCash - expectedCash;
  const isBalanced = difference === 0;
  const isShortage = difference < 0;
  const isSurplus = difference > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced && !closingNote.trim()) {
      setError("Un écart a été constaté. Une note d'explication ou justification est requise pour clôturer.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/cash-sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualCash: Number(actualCash) || 0,
          closingNote: closingNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la clôture");
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
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Clôture de Caisse (Ticket Z)</h2>
              <p className="text-xs text-gray-400">
                {registerName} • Vacation #{sessionNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Theoretical Summary Box */}
          <div className="grid grid-cols-3 gap-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Espèces Théoriques</span>
              <span className="text-sm font-black text-gray-800">{formatFCFA(expectedCash)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Wave (Mobile)</span>
              <span className="text-sm font-black text-sky-600">{formatFCFA(totalWaveSales)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Orange Money</span>
              <span className="text-sm font-black text-amber-600">{formatFCFA(totalOmSales)}</span>
            </div>
          </div>

          {/* Physical Cash Count */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Montant Physique Compté (Espèces)
              </label>
              <button
                type="button"
                onClick={() => setShowCounter(!showCounter)}
                className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{showCounter ? "Masquer le décompteur" : "Aide au comptage (billets)"}</span>
                {showCounter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="25"
                value={actualCash}
                onChange={(e) => setActualCash(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 text-2xl font-black text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm text-gray-400">
                FCFA
              </span>
            </div>

            {/* Billets / Monnaie Counter */}
            {showCounter && (
              <div className="mt-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2 animate-fade-in">
                <span className="text-xs font-bold text-gray-700 block mb-2">
                  Dénombrement des coupures :
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BILL_VALUES.map((val) => (
                    <div key={val} className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-gray-100">
                      <span className="text-[11px] font-bold text-gray-500 w-14 shrink-0">
                        {val >= 1000 ? `${val / 1000}k F` : `${val} F`}
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={counts[val] || ""}
                        onChange={(e) => handleBillCountChange(val, e.target.value)}
                        className="w-full text-center px-1 py-1 rounded-lg border border-gray-200 text-xs font-bold focus:border-teal-500 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Discrepancy Indicator Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isBalanced
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : isShortage
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-3">
              {isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-current" />
              )}
              <div>
                <span className="text-xs font-bold block">
                  {isBalanced
                    ? "Caisse parfaitement équilibrée"
                    : isShortage
                    ? "Manquant de caisse constaté (Déficit)"
                    : "Excédent de caisse constaté (Surplus)"}
                </span>
                <span className="text-[11px] opacity-85 block">
                  {isBalanced
                    ? "Le montant physique concorde exactement avec le solde théorique."
                    : isShortage
                    ? "Le tiroir contient moins que le solde attendu."
                    : "Le tiroir contient plus que le solde attendu."}
                </span>
              </div>
            </div>

            <div className="text-right self-end sm:self-auto shrink-0">
              <span className="text-sm font-black block">
                {difference > 0 ? `+${formatFCFA(difference)}` : formatFCFA(difference)}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider">Écart</span>
            </div>
          </div>

          {/* Closing Notes (Mandatory if discrepancy) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Observation de Clôture {isBalanced ? "(Facultatif)" : "(Obligatoire en cas d'écart)"}
            </label>
            <textarea
              rows={2}
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              placeholder={
                isBalanced
                  ? "Remarques éventuelles sur la vacation..."
                  : "Expliquez la cause du manquant ou du surplus constaté..."
              }
              className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition ${
                !isBalanced && !closingNote.trim()
                  ? "border-rose-300 focus:ring-2 focus:ring-rose-500"
                  : "border-gray-200 focus:ring-2 focus:ring-teal-500"
              }`}
              required={!isBalanced}
            />
          </div>

          {/* Warning */}
          <p className="text-[11px] text-gray-400 italic">
            Attention : la clôture est définitive. La session sera verrouillée et le Ticket Z sera émis pour la comptabilité.
          </p>

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
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Confirmer la Clôture Z</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
