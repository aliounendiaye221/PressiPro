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

  const primaryColor = tenant?.brandPrimaryColor || "#0f766e";
  const accentColor = tenant?.brandAccentColor || "#f0fdfa";

  return (
    <main className="min-h-screen bg-slate-50/70 text-slate-900 px-3 py-6 sm:py-10 flex items-start justify-center pb-36 font-sans">
      <div className="w-full max-w-lg space-y-4">
        {/* PRESSING HEADER CARD */}
        {tenant && (
          <header className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3.5">
            <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: primaryColor }} />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {tenant.logoUrl ? (
                  <img
                    src={tenant.logoUrl}
                    alt={tenant.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm bg-white shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {tenant.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-lg font-black text-slate-900 truncate tracking-tight">
                    {tenant.name}
                  </h1>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Grille tarifaire officielle</span>
                  </p>
                </div>
              </div>

              {tenant.phone && (
                <a
                  href={`tel:${tenant.phone.replace(/[^0-9+]/g, "")}`}
                  className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors shrink-0"
                  title="Appeler le pressing"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>

            {tenant.address && (
              <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{tenant.address}</span>
              </div>
            )}
          </header>
        )}

        {/* LOADING & ERROR STATES */}
        {loading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 flex flex-col items-center justify-center gap-3 text-slate-600 text-sm shadow-xs">
            <LoaderCircle className="h-7 w-7 animate-spin text-teal-600" />
            <span>Chargement des tarifs en direct...</span>
          </div>
        )}

        {!!error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900 space-y-1 shadow-xs">
            <p className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600" /> Oups !
            </p>
            <p className="text-xs text-red-700">{error}</p>
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
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                  style={
                    selectedCategory === "ALL"
                      ? { backgroundColor: primaryColor, color: "#ffffff", borderColor: primaryColor }
                      : undefined
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                    selectedCategory === "ALL"
                      ? "shadow-sm font-bold"
                      : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  Tous les articles ({services.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory("POPULAR")}
                  style={
                    selectedCategory === "POPULAR"
                      ? { backgroundColor: primaryColor, color: "#ffffff", borderColor: primaryColor }
                      : undefined
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer border ${
                    selectedCategory === "POPULAR"
                      ? "shadow-sm font-bold"
                      : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                  Populaires
                </button>

                {services.some((s) => s.pricingType === "PER_KG") && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("PER_KG")}
                    style={
                      selectedCategory === "PER_KG"
                        ? { backgroundColor: primaryColor, color: "#ffffff", borderColor: primaryColor }
                        : undefined
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      selectedCategory === "PER_KG"
                        ? "shadow-sm font-bold"
                        : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
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
                    style={
                      selectedCategory === cat
                        ? { backgroundColor: primaryColor, color: "#ffffff", borderColor: primaryColor }
                        : undefined
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      selectedCategory === cat
                        ? "shadow-sm font-bold"
                        : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
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
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-xs space-y-2 shadow-xs">
                  <p>Aucun article ne correspond à votre recherche.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("ALL");
                    }}
                    style={{ color: primaryColor }}
                    className="font-bold underline cursor-pointer"
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
                      style={{
                        borderColor: cartEntry ? primaryColor : undefined,
                      }}
                      className={`rounded-2xl border p-4 transition-all bg-white ${
                        cartEntry
                          ? "border-2 shadow-md ring-2 ring-teal-500/10"
                          : "border-slate-200/90 shadow-xs hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="text-sm font-bold text-slate-900 truncate">{service.name}</h2>
                            {service.isQuickItem && (
                              <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md border border-amber-200">
                                Populaire
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span
                              className="font-mono font-black text-sm"
                              style={{ color: primaryColor }}
                            >
                              {formatFCFA(service.price)}
                              <span className="text-[11px] font-normal text-slate-500 ml-1">
                                {isKilo ? "/ kg" : "/ pièce"}
                              </span>
                            </span>
                            {service.category && (
                              <span className="text-[11px] text-slate-500 truncate">
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
                                style={{ backgroundColor: primaryColor }}
                                className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer hover:opacity-90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Ajouter</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(service, quantity - 1)}
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 shadow-xs cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-mono font-black text-xs text-slate-900 min-w-[20px] text-center">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(service, quantity + 1)}
                                  style={{ backgroundColor: primaryColor }}
                                  className="w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold shadow-xs cursor-pointer hover:opacity-90"
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
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                          <p className="text-[11px] text-slate-500 font-medium">
                            Pas de balance ? Estimez facilement par taille de sac :
                          </p>

                          <div className="grid grid-cols-3 gap-1.5">
                            {BAG_PRESETS.map((preset) => (
                              <button
                                key={preset.weight}
                                type="button"
                                onClick={() => setKiloWeight(service, preset.weight)}
                                style={
                                  currentWeight === preset.weight
                                    ? { borderColor: primaryColor, backgroundColor: accentColor }
                                    : undefined
                                }
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                  currentWeight === preset.weight
                                    ? "font-bold text-slate-900 shadow-xs"
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <span className="text-[11px] font-bold block">{preset.label}</span>
                                <span className="text-[9px] text-slate-500 block truncate">{preset.desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* DIRECT WEIGHT STEPPER */}
                          <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                            <span className="text-xs text-slate-600 font-medium">Poids exact :</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setKiloWeight(service, Math.max(0, currentWeight - 0.5))}
                                className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 shadow-xs cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                className="font-mono font-black text-xs min-w-[50px] text-center"
                                style={{ color: primaryColor }}
                              >
                                {currentWeight > 0 ? `${currentWeight} kg` : "0 kg"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setKiloWeight(service, currentWeight + 0.5)}
                                style={{ backgroundColor: primaryColor }}
                                className="w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold shadow-xs cursor-pointer hover:opacity-90"
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
          className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 z-40 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-md animate-fade-in border-t border-slate-200/50"
        >
          <div className="max-w-lg mx-auto rounded-3xl bg-slate-900 p-4 shadow-2xl flex items-center justify-between gap-3 text-white">
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
              className="flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] cursor-pointer shrink-0"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
        >
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 text-slate-900">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2 rounded-xl text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="order-modal-title" className="font-bold text-sm text-slate-900">
                    Finaliser votre demande
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Transmise directement sur le WhatsApp officiel du pressing
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setIsOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CART SUMMARY RECAP */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                <span>Panier de linge</span>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-normal text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" /> Vider
                </button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1.5 text-xs pr-1">
                {Object.values(cart).map((item) => (
                  <div key={item.serviceId} className="flex justify-between text-slate-700 text-xs">
                    <span className="truncate">
                      {item.pricingType === "PER_KG"
                        ? `${item.weight} kg ${item.name}`
                        : `${item.quantity}x ${item.name}`}
                    </span>
                    <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                      {formatFCFA(item.total)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black">
                <span className="text-slate-700">Total estimé :</span>
                <span className="font-mono text-base" style={{ color: primaryColor }}>
                  {formatFCFA(totalAmount)}
                </span>
              </div>
            </div>

            {/* ERROR MESSAGE */}
            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* MODE SELECTION */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Mode de traitement :
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setServiceMode("DELIVERY")}
                  style={
                    serviceMode === "DELIVERY"
                      ? { borderColor: primaryColor, backgroundColor: accentColor }
                      : undefined
                  }
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    serviceMode === "DELIVERY"
                      ? "border-2 text-slate-900 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold">Collecte &amp; Livraison</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Un livreur passe chez vous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setServiceMode("DROP_OFF")}
                  style={
                    serviceMode === "DROP_OFF"
                      ? { borderColor: primaryColor, backgroundColor: accentColor }
                      : undefined
                  }
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    serviceMode === "DROP_OFF"
                      ? "border-2 text-slate-900 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold">Dépôt au pressing</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Vous déposez vos habits</span>
                </button>
              </div>
            </div>

            {/* FORM INPUTS */}
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Votre nom complet <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex : Aminata Ndiaye"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Votre numéro WhatsApp / Téléphone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ex : 77 123 45 67"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              {serviceMode === "DELIVERY" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Quartier &amp; Adresse de collecte <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Ex : Almadies, en face de la pharmacie..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Créneau souhaité
                  </label>
                  <select
                    value={preferredSlot}
                    onChange={(e) => setPreferredSlot(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500 text-xs"
                  >
                    <option value="Dès que possible">Dès que possible</option>
                    <option value="Aujourd'hui après-midi (14h-18h)">Aujourd&apos;hui (14h-18h)</option>
                    <option value="Demain matin (9h-12h)">Demain matin (9h-12h)</option>
                    <option value="Demain après-midi (14h-18h)">Demain après-midi (14h-18h)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Finition souhaitée
                  </label>
                  <select
                    value={carePreference}
                    onChange={(e) => setCarePreference(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500 text-xs"
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
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Note ou consigne particulière (optionnel)
                </label>
                <input
                  type="text"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Ex : Tache sur le pantalon noir, Bazin délicat..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
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
              <p className="text-[10px] text-center text-slate-500 mt-2">
                Un message structuré sera pré-rempli sur votre WhatsApp vers le pressing.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

