"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, ShoppingCart, Plus, Minus, Weight, Package, CalendarClock, StickyNote, Banknote, Sparkles, Trash2 } from "lucide-react";
import { createOfflineTempId, enqueueOfflineAction } from "@/lib/offline-queue";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";

interface Service {
  id: string;
  name: string;
  price: number;
  pricingType: string;
  category: string | null;
  isQuickItem: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface CartItem {
  serviceId: string;
  name: string;
  price: number;
  pricingType: string;
  quantity: number;
  weight: number;
}

const SERVICES_CACHE_KEY = "services:catalog";

function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
}

export default function NewOrderPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [promisedAt, setPromisedAt] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceMethod, setAdvanceMethod] = useState("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const syncNetworkState = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    fetch("/api/services")
      .then((r) => {
        if (!r.ok) throw new Error("services-fetch-failed");
        return r.json();
      })
      .then((data) => {
        setServices(data);
        writeOfflineCache(SERVICES_CACHE_KEY, data);
      })
      .catch(() => {
        const cached = readOfflineCache<Service[]>(SERVICES_CACHE_KEY);
        if (cached) {
          setServices(cached.data);
        }
      });

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 2) { setCustomers([]); return; }
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}&limit=5`);
      if (!res.ok) throw new Error("customer-search-failed");
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch {
      const cachedPages = [
        readOfflineCache<{ customers: Customer[] }>("customers:page=1"),
        readOfflineCache<{ customers: Customer[] }>("customers:q=&page=1"),
      ];
      const merged = cachedPages.flatMap((entry) => entry?.data.customers || []);
      const filtered = merged.filter(
        (customer, index, arr) =>
          arr.findIndex((item) => item.id === customer.id) === index &&
          (customer.name.toLowerCase().includes(q.toLowerCase()) || customer.phone.includes(q))
      );
      setCustomers(filtered.slice(0, 5));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 200);
    return () => clearTimeout(t);
  }, [customerSearch, searchCustomers]);

  const addToCart = (service: Service) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.serviceId === service.id);
      if (existing) {
        if (service.pricingType === "PER_KG") return prev; // already in cart, edit weight directly
        return prev.map((i) =>
          i.serviceId === service.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        serviceId: service.id,
        name: service.name,
        price: service.price,
        pricingType: service.pricingType,
        quantity: service.pricingType === "PER_KG" ? 1 : 1,
        weight: service.pricingType === "PER_KG" ? 1 : 0,
      }];
    });
  };

  const updateQty = (serviceId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.serviceId !== serviceId));
    } else {
      setCart((prev) => prev.map((i) => (i.serviceId === serviceId ? { ...i, quantity: qty } : i)));
    }
  };

  const updateWeight = (serviceId: string, weight: number) => {
    if (weight < 0) weight = 0;
    setCart((prev) => prev.map((i) => (i.serviceId === serviceId ? { ...i, weight } : i)));
  };

  const removeFromCart = (serviceId: string) => {
    setCart((prev) => prev.filter((i) => i.serviceId !== serviceId));
  };

  const getItemTotal = (item: CartItem) => {
    if (item.pricingType === "PER_KG") {
      return Math.round(item.price * item.weight);
    }
    return item.price * item.quantity;
  };

  const total = cart.reduce((s, i) => s + getItemTotal(i), 0);

  const createCustomer = async () => {
    if (!newCustomerName || !newCustomerPhone) return;
    setSyncMessage("");

    const payload = { name: newCustomerName, phone: newCustomerPhone };
    const queueCustomer = () => {
      const tempId = createOfflineTempId("customer");
      enqueueOfflineAction({
        type: "CREATE_CUSTOMER",
        request: {
          url: "/api/customers",
          method: "POST",
          body: payload,
        },
        meta: { tempCustomerId: tempId },
      });

      setSelectedCustomer({ id: tempId, name: newCustomerName, phone: newCustomerPhone });
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setSyncMessage("Client enregistre localement. Vous pouvez continuer la commande hors ligne.");
    };

    if (!navigator.onLine) {
      queueCustomer();
      return;
    }

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur"); return; }
      setSelectedCustomer(data);
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
    } catch {
      queueCustomer();
    }
  };

  const submit = async () => {
    if (!selectedCustomer) { setError("Sélectionnez un client"); return; }
    if (cart.length === 0) { setError("Ajoutez au moins un article"); return; }
    setError("");
    setSyncMessage("");
    setSubmitting(true);

    const payload = {
      customerId: selectedCustomer.id,
      items: cart.map((i) => ({
        serviceId: i.serviceId,
        ...(i.pricingType === "PER_KG"
          ? { weight: i.weight }
          : { quantity: i.quantity }),
      })),
      notes: notes || undefined,
      promisedAt: promisedAt || undefined,
      advanceAmount: advanceAmount > 0 ? advanceAmount : undefined,
      advanceMethod: advanceAmount > 0 ? advanceMethod : undefined,
    };

    const queueOrder = () => {
      enqueueOfflineAction({
        type: "CREATE_ORDER",
        request: {
          url: "/api/orders",
          method: "POST",
          body: payload,
        },
      });
      setSelectedCustomer(null);
      setCustomerSearch("");
      setCustomers([]);
      setCart([]);
      setNotes("");
      setPromisedAt("");
      setAdvanceAmount(0);
      setAdvanceMethod("CASH");
      setSyncMessage("Commande enregistree hors ligne. Elle sera creee automatiquement des que la connexion reviendra.");
    };

    if (!navigator.onLine) {
      queueOrder();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur");
        return;
      }
      router.push(`/orders/${data.id}`);
    } catch {
      queueOrder();
    } finally {
      setSubmitting(false);
    }
  };

  const quickItems = services.filter((s) => s.isQuickItem);
  const otherItems = services.filter((s) => !s.isQuickItem);

  return (
    <div className="space-y-4">
      {isOffline && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mode hors ligne actif. Les services sont lus depuis le cache et les nouvelles actions seront placees en file d'attente.
        </div>
      )}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouveau dépôt</h1>
        <p className="text-sm text-gray-500 mt-0.5">Créer une nouvelle commande</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">{error}</div>
      )}

      {syncMessage && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{syncMessage}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Left: Client + Services */}
        <div className="space-y-4">
          {/* Customer selection */}
          <div className="card">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-primary-600" /> Client</h2>
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-primary-100/50 p-3 rounded-xl">
                <div>
                  <p className="font-medium text-primary-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-primary-600">{selectedCustomer.phone}</p>
                </div>
                <button
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Rechercher par nom ou téléphone..."
                    className="input-field pl-10"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {customers.length > 0 && (
                  <div className="border rounded-xl divide-y max-h-40 overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-primary-50 text-sm transition-colors"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomers([]); }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-gray-500 ml-2">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  onClick={() => setShowNewCustomer(true)}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Nouveau client
                </button>
                {showNewCustomer && (
                  <div className="bg-gray-50 p-3 rounded-xl space-y-2">
                    <input
                      placeholder="Nom du client"
                      className="input-field"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                    <input
                      placeholder="+221 7X XXX XX XX"
                      className="input-field"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                    />
                    <button className="btn-primary text-xs" onClick={createCustomer}>
                      <UserPlus className="w-3.5 h-3.5" /> Créer le client
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick items - big buttons */}
          <div className="card">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Articles rapides</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {quickItems.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addToCart(s)}
                  className="flex flex-col items-center justify-center p-3 bg-gradient-to-br from-primary-50 to-primary-100/50 hover:from-primary-100 hover:to-primary-200/50 rounded-xl text-center transition-all min-h-[70px] group hover:shadow-sm"
                >
                  <span className="text-sm font-medium leading-tight group-hover:text-primary-700">{s.name}</span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {formatFCFA(s.price)}{s.pricingType === "PER_KG" ? "/kg" : ""}
                  </span>
                  {s.pricingType === "PER_KG" && <Weight className="w-3 h-3 text-amber-500 mt-0.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Other services */}
          {otherItems.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-gray-500" /> Autres services</h2>
              <div className="grid grid-cols-2 gap-2">
                {otherItems.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addToCart(s)}
                    className="text-left p-2.5 border rounded-xl hover:bg-gray-50 text-sm transition-all hover:shadow-sm group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium group-hover:text-primary-700">{s.name}</span>
                      {s.pricingType === "PER_KG" && <Weight className="w-3 h-3 text-amber-500" />}
                    </div>
                    <span className="text-gray-500">{formatFCFA(s.price)}{s.pricingType === "PER_KG" ? "/kg" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart + Total */}
        <div className="space-y-4">
          <div className="card lg:sticky lg:top-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-primary-600" /> Panier</h2>

            {cart.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Ajoutez des articles
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {cart.map((item) => (
                  <div
                    key={item.serviceId}
                    className="bg-gray-50 p-3 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <button
                        onClick={() => removeFromCart(item.serviceId)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {item.pricingType === "PER_KG" ? (
                      /* Per-kilo item */
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Weight className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs text-gray-500">{formatFCFA(item.price)}/kg</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={item.weight || ""}
                            onChange={(e) => updateWeight(item.serviceId, parseFloat(e.target.value) || 0)}
                            className="w-20 text-center input-field text-sm py-1 px-2"
                            placeholder="kg"
                          />
                          <span className="text-xs text-gray-500">kg</span>
                        </div>
                        <p className="w-20 text-right font-semibold text-sm">
                          {formatFCFA(getItemTotal(item))}
                        </p>
                      </div>
                    ) : (
                      /* Per-item */
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">{formatFCFA(item.price)} / pièce</p>
                        <div className="flex items-center gap-2">
                          <button
                            className="w-7 h-7 rounded-full bg-white border text-sm flex items-center justify-center hover:bg-gray-100 transition-colors"
                            onClick={() => updateQty(item.serviceId, item.quantity - 1)}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                          <button
                            className="w-7 h-7 rounded-full bg-white border text-sm flex items-center justify-center hover:bg-gray-100 transition-colors"
                            onClick={() => updateQty(item.serviceId, item.quantity + 1)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="w-20 text-right font-semibold text-sm">
                          {formatFCFA(getItemTotal(item))}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-lg sm:text-xl font-bold">
                <span>TOTAL</span>
                <span className="text-primary-700">{formatFCFA(total)}</span>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" /> Date promesse
                </label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={promisedAt}
                  onChange={(e) => setPromisedAt(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" /> Notes
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instructions spéciales..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5" /> Avance (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={total}
                    className="input-field"
                    value={advanceAmount || ""}
                    onChange={(e) => setAdvanceAmount(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Méthode
                  </label>
                  <select
                    className="input-field"
                    value={advanceMethod}
                    onChange={(e) => setAdvanceMethod(e.target.value)}
                  >
                    <option value="CASH">Espèces</option>
                    <option value="OM">Orange Money</option>
                    <option value="WAVE">Wave</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={submit}
              disabled={submitting || cart.length === 0 || !selectedCustomer}
              className="btn-success w-full btn-lg mt-4"
            >
              <Sparkles className="w-4 h-4" />
              {submitting ? "Enregistrement..." : `Valider le dépôt — ${formatFCFA(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
