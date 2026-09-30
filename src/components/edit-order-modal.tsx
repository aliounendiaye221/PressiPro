"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, AlertTriangle, Save, Loader2 } from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
  pricingType: "PER_ITEM" | "PER_KG";
  category?: string | null;
}

interface EditableItem {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  weight?: number | null;
  pricingType: "PER_ITEM" | "PER_KG";
}

interface OrderDetail {
  id: string;
  code: string;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  discountReason: string | null;
  notes: string | null;
  promisedAt: string | null;
  items: {
    id: string;
    serviceId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    weight?: number | null;
    pricingType?: string;
    total: number;
  }[];
}

interface EditOrderModalProps {
  order: OrderDetail;
  onClose: () => void;
  onSuccess: () => void;
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

export function EditOrderModal({ order, onClose, onSuccess }: EditOrderModalProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [items, setItems] = useState<EditableItem[]>(
    order.items.map((i) => ({
      serviceId: i.serviceId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      weight: i.weight || null,
      pricingType: (i.pricingType as "PER_ITEM" | "PER_KG") || "PER_ITEM",
    }))
  );
  const [discountAmount, setDiscountAmount] = useState<number>(order.discountAmount || 0);
  const [discountReason, setDiscountReason] = useState<string>(order.discountReason || "");
  const [notes, setNotes] = useState<string>(order.notes || "");
  const [promisedAt, setPromisedAt] = useState<string>(
    order.promisedAt ? new Date(order.promisedAt).toISOString().slice(0, 16) : ""
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load available services
  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch("/api/services");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setServices(data);
            if (data.length > 0) {
              setSelectedServiceId(data[0].id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load services", e);
      } finally {
        setLoadingServices(false);
      }
    }
    loadServices();
  }, []);

  // Compute live totals
  const subtotal = items.reduce((sum, item) => {
    if (item.pricingType === "PER_KG" && item.weight) {
      return sum + Math.round(item.unitPrice * item.weight);
    }
    return sum + item.unitPrice * item.quantity;
  }, 0);

  const effectiveDiscount = Math.min(discountAmount, subtotal);
  const newTotalAmount = Math.max(0, subtotal - effectiveDiscount);
  const newBalance = Math.max(0, newTotalAmount - order.paidAmount);
  const isTotalLowerThanPaid = newTotalAmount < order.paidAmount;

  const handleAddItem = () => {
    if (!selectedServiceId) return;
    const service = services.find((s) => s.id === selectedServiceId);
    if (!service) return;

    // Check if item already in list
    const existingIndex = items.findIndex((i) => i.serviceId === service.id);
    if (existingIndex >= 0 && service.pricingType !== "PER_KG") {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          serviceId: service.id,
          name: service.name,
          quantity: 1,
          unitPrice: service.price,
          weight: service.pricingType === "PER_KG" ? 1 : null,
          pricingType: service.pricingType,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const updated = [...items];
    updated[index].quantity = newQty;
    setItems(updated);
  };

  const handleUpdateWeight = (index: number, newWeight: number) => {
    if (newWeight <= 0) return;
    const updated = [...items];
    updated[index].weight = newWeight;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError("Une commande doit contenir au moins un article.");
      return;
    }
    setError("");
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const handleSave = async () => {
    setError("");
    if (items.length === 0) {
      setError("Veuillez inclure au moins un article.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        items: items.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
          weight: i.weight || undefined,
        })),
        discountAmount: effectiveDiscount,
        discountReason: discountReason.trim() || undefined,
        notes: notes.trim() || undefined,
        promisedAt: promisedAt ? new Date(promisedAt).toISOString() : null,
      };

      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erreur lors de la modification de la commande.");
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
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-8 animate-in fade-in zoom-in duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <span>Modifier la commande</span>
              <span className="font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg text-sm font-semibold">
                {order.code}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Corrigez les articles, la remise, la date promise ou les notes
            </p>
          </div>
          <button
            title="Fermer"
            onClick={onClose}
            disabled={saving}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Warning if total lower than paid */}
          {isTotalLowerThanPaid && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Attention : Réduction du montant total</p>
                <p className="mt-0.5">
                  Le nouveau montant ({formatFCFA(newTotalAmount)}) est inférieur aux paiements déjà enregistrés ({formatFCFA(order.paidAmount)}). Un remboursement au client pourra être nécessaire.
                </p>
              </div>
            </div>
          )}

          {/* Articles Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900">Articles de la commande</label>
              <span className="text-xs text-gray-500">{items.length} article{items.length > 1 ? "s" : ""}</span>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
              {items.map((item, idx) => {
                const itemTotal = item.pricingType === "PER_KG" && item.weight
                  ? Math.round(item.unitPrice * item.weight)
                  : item.unitPrice * item.quantity;

                return (
                  <div key={idx} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatFCFA(item.unitPrice)} {item.pricingType === "PER_KG" ? "/ kg" : "/ pièce"}
                      </p>
                    </div>

                    {/* Quantity or Weight editor */}
                    <div className="flex items-center gap-3 shrink-0">
                      {item.pricingType === "PER_KG" ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.weight || 1}
                            onChange={(e) => handleUpdateWeight(idx, parseFloat(e.target.value) || 1)}
                            className="input-field py-1 px-2 text-center w-20 text-xs font-semibold"
                          />
                          <span className="text-xs text-gray-500 font-medium">kg</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 flex items-center justify-center rounded bg-white text-gray-700 shadow-sm disabled:opacity-40 hover:bg-gray-50 font-bold text-sm"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center rounded bg-white text-gray-700 shadow-sm hover:bg-gray-50 font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      )}

                      <div className="w-24 text-right">
                        <p className="text-sm font-bold text-gray-900">{formatFCFA(itemTotal)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        title="Supprimer l'article"
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Item Row */}
            <div className="mt-3 flex items-center gap-2">
              <select
                className="input-field text-sm flex-1"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                disabled={loadingServices}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatFCFA(s.price)} {s.pricingType === "PER_KG" ? "/kg" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddItem}
                className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4 text-primary-600" />
                <span>Ajouter article</span>
              </button>
            </div>
          </div>

          {/* Discount Section */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Remise / Réduction
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Montant de la remise (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">Motif de la remise</label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Ex: Client fidèle, geste commercial..."
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>

          {/* Date & Notes Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date de promesse de retrait</label>
              <input
                type="datetime-local"
                value={promisedAt}
                onChange={(e) => setPromisedAt(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Instructions spéciales</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Tâche tenace col, repassage doux..."
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Financial Summary */}
          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Sous-total articles :</span>
              <span className="font-semibold">{formatFCFA(subtotal)}</span>
            </div>
            {effectiveDiscount > 0 && (
              <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                <span>Remise appliquée :</span>
                <span>- {formatFCFA(effectiveDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-primary-200/50">
              <span>Nouveau total commande :</span>
              <span className="text-primary-700 text-base">{formatFCFA(newTotalAmount)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Déjà encaissé :</span>
              <span>{formatFCFA(order.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-red-600 pt-1 border-t border-primary-200/50">
              <span>Nouveau solde restant dû :</span>
              <span>{formatFCFA(newBalance)}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary text-sm"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Enregistrer les modifications</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
