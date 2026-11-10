"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Search,
  ShoppingBag,
  Phone,
  MapPin,
  ShieldCheck,
  Sparkles,
  Plus,
  Minus,
  X,
  MessageCircle,
  Truck,
  Store,
  Clock,
  ArrowRight,
  LoaderCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { normalizePhoneForWhatsApp } from "@/lib/phone";

interface Service {
  id: string;
  name: string;
  price: number;
  pricingType: "PER_ITEM" | "PER_KG";
  category: string | null;
  isQuickItem: boolean;
  sortOrder: number;
}

interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  waveNumber: string | null;
  omNumber: string | null;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
}

interface CartItem {
  serviceId: string;
  name: string;
  price: number;
  pricingType: "PER_ITEM" | "PER_KG";
  quantity: number; // for PER_ITEM
  weight: number; // for PER_KG (e.g. 3.5 kg)
  total: number;
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

const BAG_PRESETS = [
  { label: "🎒 Petit sac", weight: 3, desc: "~5 hauts + 2 pantalons" },
  { label: "🧺 Sac moyen", weight: 6, desc: "Linge d'une semaine" },
  { label: "👨‍👩‍👧 Grand sac", weight: 10, desc: "Linge familial + draps" },
];

export default function TenantPublicCatalogPage() {
  const { tenantId } = useParams<{ tenantId: string }>();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Cart
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Order Form
  const [serviceMode, setServiceMode] = useState<"DELIVERY" | "DROP_OFF">("DELIVERY");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [preferredSlot, setPreferredSlot] = useState("Dès que possible");
  const [carePreference, setCarePreference] = useState("Sur cintre");
  const [specialNotes, setSpecialNotes] = useState("");
  const [formError, setFormError] = useState("");

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/pressing/${tenantId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Impossible de charger la vitrine du pressing.");
      }
      setTenant(data?.tenant || data?.data?.tenant);
      setServices(data?.services || data?.data?.services || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.category && s.category.trim()) {
        set.add(s.category.trim());
      }
    });
    return Array.from(set);
  }, [services]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesCategory = (s.category || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCategory) return false;
      }

      if (selectedCategory === "ALL") return true;
      if (selectedCategory === "POPULAR") return s.isQuickItem;
      if (selectedCategory === "PER_KG") return s.pricingType === "PER_KG";
      return s.category === selectedCategory;
    });
  }, [services, searchQuery, selectedCategory]);

  // Cart operations
  const setItemQuantity = (service: Service, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => {
        const next = { ...prev };
        delete next[service.id];
        return next;
      });
      return;
    }

    setCart((prev) => ({
      ...prev,
      [service.id]: {
        serviceId: service.id,
        name: service.name,
        price: service.price,
        pricingType: "PER_ITEM",
        quantity,
        weight: 0,
        total: quantity * service.price,
      },
    }));
  };

  const setKiloWeight = (service: Service, weight: number) => {
    if (weight <= 0) {
      setCart((prev) => {
        const next = { ...prev };
        delete next[service.id];
        return next;
      });
      return;
    }

    const cleanWeight = Math.round(weight * 10) / 10;
    setCart((prev) => ({
      ...prev,
      [service.id]: {
        serviceId: service.id,
        name: service.name,
        price: service.price,
        pricingType: "PER_KG",
        quantity: 1,
        weight: cleanWeight,
        total: Math.round(cleanWeight * service.price),
      },
    }));
  };

  const clearCart = () => {
    setCart({});
  };

  // Cart Totals
  const { totalAmount, totalCount, totalWeight } = useMemo(() => {
    let amount = 0;
    let count = 0;
    let weight = 0;

    Object.values(cart).forEach((item) => {
      amount += item.total;
      if (item.pricingType === "PER_ITEM") {
        count += item.quantity;
      } else {
        weight += item.weight;
      }
    });

    return {
      totalAmount: amount,
      totalCount: count,
      totalWeight: Math.round(weight * 10) / 10,
    };
  }, [cart]);

  const hasItemsInCart = totalCount > 0 || totalWeight > 0;

  // Handle WhatsApp submission
  const handleSubmitOrderToWhatsApp = () => {
    if (!tenant) return;
    setFormError("");

    if (!customerName.trim()) {
      setFormError("Veuillez renseigner votre nom complet.");
      return;
    }

    if (!customerPhone.trim() || customerPhone.replace(/[^0-9]/g, "").length < 7) {
      setFormError("Veuillez renseigner un numéro de téléphone valide.");
      return;
    }

    if (serviceMode === "DELIVERY" && !customerAddress.trim()) {
      setFormError("Veuillez renseigner votre quartier ou adresse pour la livraison.");
      return;
    }

    const itemsSummary = Object.values(cart)
      .map((item) => {
        if (item.pricingType === "PER_KG") {
          return `• ${item.weight} kg ${item.name} : ${formatFCFA(item.total)}`;
        }
        return `• ${item.quantity}x ${item.name} : ${formatFCFA(item.total)}`;
      })
      .join("\n");

    const messageLines = [
      `🧺 *DEMANDE DE COMMANDE — ${tenant.name.toUpperCase()}*`,
      `──────────────────────`,
      `👤 *Client :* ${customerName.trim()}`,
      `📞 *Téléphone :* ${customerPhone.trim()}`,
      `📍 *Mode :* ${serviceMode === "DELIVERY" ? "🛵 Collecte & Livraison à domicile" : "🏪 Dépôt au pressing"}`,
      ...(serviceMode === "DELIVERY" ? [`🏠 *Adresse :* ${customerAddress.trim()}`] : []),
      `⏰ *Créneau :* ${preferredSlot}`,
      ``,
      `📦 *LINGE ESTIMÉ :*`,
      itemsSummary,
      `──────────────────────`,
      `💰 *TOTAL ESTIMÉ :* ${formatFCFA(totalAmount)}`,
      ``,
      `✨ *Finition souhaitée :* ${carePreference}`,
      ...(specialNotes.trim() ? [`📝 *Instructions :* ${specialNotes.trim()}`] : []),
      `──────────────────────`,
      `_Envoyé depuis la vitrine PressiPro_`,
    ];

    const rawTarget = tenant.phone || tenant.waveNumber || "";
    const normalized = normalizePhoneForWhatsApp(rawTarget) || rawTarget.replace(/[^0-9]/g, "");
    const fullText = messageLines.join("\n");

    const whatsappUrl = normalized
      ? `https://wa.me/${normalized}?text=${encodeURIComponent(fullText)}`
      : `https://wa.me/?text=${encodeURIComponent(fullText)}`;

    window.open(whatsappUrl, "_blank");
    setIsOrderModalOpen(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-3 py-6 sm:py-10 flex items-start justify-center pb-32">
      <div className="w-full max-w-lg space-y-4">
        {/* PRESSING HEADER CARD */}
        {tenant && (
          <header className="rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-teal-500/20 shrink-0">
                  {tenant.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-black text-white truncate tracking-tight">
                    {tenant.name}
                  </h1>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>Tarifs &amp; Devis officiel en direct</span>
                  </p>
                </div>
              </div>

              {tenant.phone && (
                <a
                  href={`tel:${tenant.phone.replace(/[^0-9+]/g, "")}`}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-teal-400 transition-colors shrink-0"
                  title="Appeler le pressing"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>

            {tenant.address && (
              <div className="pt-2.5 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="truncate">{tenant.address}</span>
              </div>
            )}
          </header>
        )}

        {/* LOADING & ERROR STATES */}
        {loading && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 flex flex-col items-center justify-center gap-3 text-slate-300 text-sm">
            <LoaderCircle className="h-7 w-7 animate-spin text-teal-400" />
            <span>Chargement des tarifs en direct...</span>
          </div>
        )}

        {!!error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-950/60 p-5 text-red-200 space-y-1">
            <p className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Oups !
            </p>
            <p className="text-xs text-red-300/90">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* SEARCH & FILTERS */}
            <section className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher (chemise, boubou, couette, kilo...)"
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-teal-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* CATEGORY PILLS */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === "ALL"
                      ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5"
                  }`}
                >
                  Tous les articles
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory("POPULAR")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer ${
                    selectedCategory === "POPULAR"
                      ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5"
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                  Populaires
                </button>

                {services.some((s) => s.pricingType === "PER_KG") && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("PER_KG")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === "PER_KG"
                        ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20"
                        : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5"
                    }`}
                  >
                    ⚖️ Au Kilo
                  </button>
                )}

                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20"
                        : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            {/* SERVICES LIST */}
            <section className="space-y-3">
              {filteredServices.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center text-slate-400 text-xs space-y-2">
                  <p>Aucun article ne correspond à votre recherche.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("ALL");
                    }}
                    className="text-teal-400 font-semibold underline"
                  >
                    Afficher tous les articles
                  </button>
                </div>
              ) : (
                filteredServices.map((service) => {
                  const cartEntry = cart[service.id];
                  const isKilo = service.pricingType === "PER_KG";
                  const quantity = cartEntry?.quantity || 0;
                  const currentWeight = cartEntry?.weight || 0;

                  return (
                    <article
                      key={service.id}
                      className={`rounded-3xl border p-4 transition-all ${
                        cartEntry
                          ? "bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border-teal-500/50 shadow-lg shadow-teal-950/20"
                          : "bg-slate-900/80 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="text-sm font-bold text-white truncate">{service.name}</h2>
                            {service.isQuickItem && (
                              <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md border border-amber-500/30">
                                Populaire
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="font-mono font-black text-teal-300">
                              {formatFCFA(service.price)}
                              <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                                {isKilo ? "/ kg" : "/ pièce"}
                              </span>
                            </span>
                            {service.category && (
                              <span className="text-[11px] text-slate-400 truncate">
                                • {service.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* COUNTERS */}
                        {!isKilo ? (
                          <div className="shrink-0 flex items-center gap-1.5">
                            {quantity === 0 ? (
                              <button
                                type="button"
                                onClick={() => setItemQuantity(service, 1)}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Ajouter</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-teal-500/40">
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(service, quantity - 1)}
                                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-mono font-black text-xs text-white min-w-[20px] text-center">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(service, quantity + 1)}
                                  className="w-7 h-7 rounded-lg bg-teal-500 hover:bg-teal-400 flex items-center justify-center text-slate-950 font-bold cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* SPECIAL HELPER FOR PER_KG SERVICES */}
                      {isKilo && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
                          <p className="text-[11px] text-slate-400">
                            Pas de balance ? Estimez facilement par taille de sac :
                          </p>

                          <div className="grid grid-cols-3 gap-1.5">
                            {BAG_PRESETS.map((preset) => (
                              <button
                                key={preset.weight}
                                type="button"
                                onClick={() => setKiloWeight(service, preset.weight)}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                  currentWeight === preset.weight
                                    ? "bg-teal-500/20 border-teal-500 text-white"
                                    : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                                }`}
                              >
                                <span className="text-[11px] font-bold block">{preset.label}</span>
                                <span className="text-[9px] text-slate-400 block truncate">{preset.desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* DIRECT WEIGHT STEPPER */}
                          <div className="flex items-center justify-between gap-2 bg-slate-800/80 p-2 rounded-2xl border border-white/5">
                            <span className="text-xs text-slate-300 font-medium">Poids exact :</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setKiloWeight(service, Math.max(0, currentWeight - 0.5))}
                                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-mono font-black text-xs text-teal-300 min-w-[50px] text-center">
                                {currentWeight > 0 ? `${currentWeight} kg` : "0 kg"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setKiloWeight(service, currentWeight + 0.5)}
                                className="w-7 h-7 rounded-lg bg-teal-500 hover:bg-teal-400 flex items-center justify-center text-slate-950 font-bold cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>

      {/* STICKY BOTTOM ESTIMATE & ORDER BAR */}
      {hasItemsInCart && (
        <aside
          aria-label="Barre d'estimation du panier"
          className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 z-40 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent backdrop-blur-md animate-fade-in"
        >
          <div className="max-w-lg mx-auto rounded-3xl bg-slate-900 border-2 border-teal-500/60 p-4 shadow-2xl shadow-teal-950/50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Estimation totale
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black font-mono text-white tracking-tight">
                  {formatFCFA(totalAmount)}
                </span>
                <span className="text-[11px] text-teal-300 truncate">
                  ({totalCount > 0 ? `${totalCount} pièce${totalCount > 1 ? "s" : ""}` : ""}
                  {totalCount > 0 && totalWeight > 0 ? " + " : ""}
                  {totalWeight > 0 ? `${totalWeight} kg` : ""})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOrderModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 px-4 py-3 text-xs font-black text-slate-950 shadow-lg shadow-teal-500/25 transition-all active:scale-[0.98] cursor-pointer shrink-0"
            >
              <span>Commander</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </aside>
      )}

      {/* MODAL COMMANDE & COLLECTE WHATSAPP */}
      {isOrderModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
        >
          <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 border border-white/10 text-slate-100">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b pb-3 border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="order-modal-title" className="font-bold text-sm text-white">
                    Finaliser votre demande
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Transmise directement sur le WhatsApp officiel du pressing
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setIsOrderModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CART SUMMARY RECAP */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-300 border-b border-white/5 pb-2">
                <span>Panier de linge</span>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-normal text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" /> Vider
                </button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1.5 text-xs pr-1">
                {Object.values(cart).map((item) => (
                  <div key={item.serviceId} className="flex justify-between text-slate-300 text-xs">
                    <span className="truncate">
                      {item.pricingType === "PER_KG"
                        ? `${item.weight} kg ${item.name}`
                        : `${item.quantity}x ${item.name}`}
                    </span>
                    <span className="font-mono font-bold text-white shrink-0 ml-2">
                      {formatFCFA(item.total)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-sm font-black text-teal-300">
                <span>Total estimé :</span>
                <span className="font-mono">{formatFCFA(totalAmount)}</span>
              </div>
            </div>

            {/* ERROR MESSAGE */}
            {formError && (
              <div className="rounded-xl bg-red-950/80 border border-red-500/30 p-2.5 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* MODE SELECTION */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Mode de traitement :
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setServiceMode("DELIVERY")}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    serviceMode === "DELIVERY"
                      ? "bg-teal-500/20 border-teal-500 text-white"
                      : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold">Collecte à domicile</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Un livreur passe chez vous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setServiceMode("DROP_OFF")}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    serviceMode === "DROP_OFF"
                      ? "bg-teal-500/20 border-teal-500 text-white"
                      : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold">Dépôt au pressing</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Je dépose au comptoir</span>
                </button>
              </div>
            </div>

            {/* FORM INPUTS */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Votre nom complet <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex : Aminata Ndiaye"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Votre numéro de téléphone (WhatsApp) <span className="text-teal-400">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ex : 77 123 45 67"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              {serviceMode === "DELIVERY" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Quartier &amp; Adresse de collecte <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Ex : Almadies, près de la pharmacie..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-hidden focus:border-teal-500"
                  />
                </div>
              )}

              {/* SLOT & PREFERENCES */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Créneau souhaité
                  </label>
                  <select
                    value={preferredSlot}
                    onChange={(e) => setPreferredSlot(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-hidden focus:border-teal-500 text-xs"
                  >
                    <option value="Dès que possible">Dès que possible</option>
                    <option value="Aujourd'hui après-midi (14h-18h)">Aujourd&apos;hui (14h-18h)</option>
                    <option value="Demain matin (9h-12h)">Demain matin (9h-12h)</option>
                    <option value="Demain après-midi (14h-18h)">Demain après-midi (14h-18h)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Finition souhaitée
                  </label>
                  <select
                    value={carePreference}
                    onChange={(e) => setCarePreference(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-hidden focus:border-teal-500 text-xs"
                  >
                    <option value="Sur cintre">Sur cintre</option>
                    <option value="Plié">Plié</option>
                    <option value="Amidon léger">Amidon léger</option>
                    <option value="Amidon fort">Amidon fort</option>
                    <option value="Sans amidon">Sans amidon</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Note ou consigne particulière (optionnel)
                </label>
                <input
                  type="text"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Ex : Tache sur le pantalon noir, Bazin délicat..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>

            {/* SEND BUTTON */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitOrderToWhatsApp}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-4 text-xs shadow-xl shadow-emerald-600/25 transition-all active:scale-[0.98] cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Envoyer ma demande sur WhatsApp</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-2">
                Un message structuré sera pré-rempli sur votre WhatsApp vers le pressing.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

