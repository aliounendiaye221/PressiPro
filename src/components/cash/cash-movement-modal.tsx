"use client";

import { useState } from "react";
import { X, ArrowDownRight, ArrowUpRight, AlertCircle, Check } from "lucide-react";
import { CASH_CATEGORIES, formatFCFA } from "@/lib/cash";

interface CashMovementModalProps {
  sessionId?: string;
  initialType?: "CASH_IN" | "CASH_OUT";
  onClose: () => void;
  onSuccess: (movement: any) => void;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 3000, 5000, 10000, 20000];

export function CashMovementModal({
  sessionId,
  initialType = "CASH_OUT",
  onClose,
  onSuccess,
}: CashMovementModalProps) {
  const [type, setType] = useState<"CASH_IN" | "CASH_OUT">(initialType);
  const [category, setCategory] = useState<string>(
    initialType === "CASH_OUT" ? "LESSIVE" : "APPORT"
  );
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = CASH_CATEGORIES.filter((c) => c.type === type);

  const handleTypeChange = (newType: "CASH_IN" | "CASH_OUT") => {
    setType(newType);
    const firstCat = CASH_CATEGORIES.find((c) => c.type === newType);
    if (firstCat) setCategory(firstCat.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError("Le montant doit être supérieur à 0 FCFA.");
      return;
    }
    if (!reason.trim()) {
      setError("Le motif de l'opération est obligatoire.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          type,
          amount: Number(amount),
          category,
          reason: reason.trim(),
          beneficiary: beneficiary.trim() || undefined,
          receiptRef: receiptRef.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement du mouvement");
      }

      onSuccess(data.data);
    } catch (err: any) {
      setError(err.message || "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  };

  const isExpense = type === "CASH_OUT";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div
          className={`px-4 sm:px-6 py-4 sm:py-5 text-white flex items-center justify-between transition-colors ${
            isExpense
              ? "bg-gradient-to-r from-rose-600 to-rose-700"
              : "bg-gradient-to-r from-emerald-600 to-emerald-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md shrink-0">
              {isExpense ? (
                <ArrowDownRight className="w-5 h-5 text-rose-100" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-emerald-100" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">
                {isExpense ? "Sortie de Caisse / Dépense" : "Entrée de Caisse / Apport"}
              </h2>
              <p className="text-xs opacity-85 truncate">
                {isExpense
                  ? "Achat consommable, course, avance, etc."
                  : "Réapprovisionnement, apport de monnaie"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => handleTypeChange("CASH_OUT")}
              className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                type === "CASH_OUT"
                  ? "bg-white text-rose-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Dépense (Sortie)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("CASH_IN")}
              className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                type === "CASH_IN"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Apport (Entrée)</span>
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Montant (FCFA)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="50"
                value={amount || ""}
                onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xl font-black text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                placeholder="0"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm text-gray-400">
                FCFA
              </span>
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`text-xs px-2 py-1 rounded-xl font-medium transition ${
                    amount === amt
                      ? isExpense
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {formatFCFA(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Catégorie de Mouvement
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
            >
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label} — {cat.description}
                </option>
              ))}
            </select>
          </div>

          {/* Reason / Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Motif Détaillé <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : Achat 2 bidons de lessive liquide Ariel + adoucissant"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
              required
            />
          </div>

          {/* Beneficiary & Receipt Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                Bénéficiaire
              </label>
              <input
                type="text"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="Ex : Boutique Diallo"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                N° Justificatif / Reçu
              </label>
              <input
                type="text"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
                placeholder="Ex : FAC-0045"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none transition"
              />
            </div>
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
              disabled={loading || amount <= 0 || !reason.trim()}
              className={`flex-1 px-4 py-2.5 text-white rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50 ${
                isExpense
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Enregistrer {formatFCFA(amount)}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
