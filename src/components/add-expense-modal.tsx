"use client";

import { useState } from "react";
import { X, Plus, AlertTriangle, Save, Loader2, DollarSign } from "lucide-react";

interface AddExpenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
}

const CATEGORIES = [
  { id: "PRODUITS", label: "Produits & Lessive", desc: "Lessive, assouplissant, cintres, plastique, javel" },
  { id: "LIVRAISON", label: "Livraison & Transport", desc: "Carburant, coursier tiak-tiak, transport" },
  { id: "MATERIEL", label: "Matériel & Entretien", desc: "Fers, chaudières, machines, pièces de rechange" },
  { id: "CHARGES_FIXES", label: "Charges Fixes", desc: "Facture Senelec, Sde/Eau, Loyer, Internet" },
  { id: "SALAIRES", label: "Salaires & Personnel", desc: "Salaires, acomptes, journaliers, extras" },
  { id: "AUTRE", label: "Autres dépenses", desc: "Dépenses diverses et imprévus" },
];

const PAYMENT_METHODS = [
  { id: "CASH", label: "Espèces (Caisse)" },
  { id: "WAVE", label: "Wave" },
  { id: "OM", label: "Orange Money" },
  { id: "OTHER", label: "Autre moyen" },
];

export function AddExpenseModal({ onClose, onSuccess, defaultDate }: AddExpenseModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [category, setCategory] = useState("PRODUITS");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!description.trim()) {
      setError("Veuillez saisir une description de la dépense.");
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Veuillez saisir un montant valide (au moins 1 FCFA).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: numAmount,
          category,
          paymentMethod,
          supplier: supplier.trim() || undefined,
          date: new Date(date).toISOString(),
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erreur lors de l'enregistrement de la dépense.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative my-8 animate-in fade-in zoom-in duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-sm font-bold">
                💸
              </span>
              <span>Enregistrer une dépense</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ajoutez un achat en produits, matériel, livraison ou charge
            </p>
          </div>
          <button
            type="button"
            title="Fermer"
            onClick={onClose}
            disabled={saving}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Motif / Description de l&apos;achat <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Achat 3 bidons lessive OMO 5L, Carburant moto..."
                className="input-field text-sm"
              />
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Montant (FCFA) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="Ex: 15000"
                    className="input-field text-sm pr-12 font-semibold text-gray-900"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    FCFA
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Date de la dépense <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Catégorie de dépense
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field text-sm cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} ({cat.desc})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mode de règlement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field text-sm cursor-pointer"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Fournisseur / Magasin
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex: Auchan, Station Total, Quincaillerie..."
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Observations / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Facture N° 124, payé par caissier Moussa..."
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-secondary text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-2 bg-red-600 hover:bg-red-700 border-red-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Enregistrer la dépense</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
