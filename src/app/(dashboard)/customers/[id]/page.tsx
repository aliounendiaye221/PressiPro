"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageCircle,
  Copy,
  Check,
  TrendingUp,
  AlertTriangle,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Inbox,
  Banknote,
  Search,
  ExternalLink,
  PlusCircle,
  FileText,
  ShoppingBag,
} from "lucide-react";
import { normalizePhoneForWhatsApp } from "@/lib/phone";
import { useAuth } from "@/components/auth-provider";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  pricingType: string;
  weight?: number | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: "CASH" | "WAVE" | "OM" | "OTHER";
  note: string | null;
  createdAt: string;
  agentName: string;
  orderId: string;
  orderCode: string;
}

interface CustomerOrder {
  id: string;
  code: string;
  status: "RECU" | "TRAITEMENT" | "PRET" | "LIVRE";
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  discountReason: string | null;
  notes: string | null;
  promisedAt: string | null;
  createdAt: string;
  items: OrderItem[];
  payments: {
    id: string;
    amount: number;
    method: "CASH" | "WAVE" | "OM" | "OTHER";
    note: string | null;
    createdAt: string;
  }[];
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalOrders: number;
    totalSpent: number;
    totalPaid: number;
    totalDebt: number;
    activeOrdersCount: number;
  };
  orders: CustomerOrder[];
  allPayments: PaymentRecord[];
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; glowClass: string }> = {
  RECU: { label: "Reçu", icon: Inbox, glowClass: "badge-glow-blue" },
  TRAITEMENT: { label: "En traitement", icon: Clock, glowClass: "badge-glow-amber" },
  PRET: { label: "Prêt", icon: CheckCircle2, glowClass: "badge-glow-emerald" },
  LIVRE: { label: "Livré", icon: Truck, glowClass: "badge-glow-gray" },
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  WAVE: "Wave",
  OM: "Orange Money",
  OTHER: "Autre",
};

const METHOD_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  CASH: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  WAVE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  OM: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  OTHER: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tenant } = useAuth();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<"orders" | "payments" | "habits">("orders");
  const [orderFilter, setOrderFilter] = useState<"all" | "active" | "unpaid" | "done">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (res.ok) {
        const data = (await res.json()) as CustomerDetail;
        setCustomer(data);
        setForm({
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          notes: data.notes || "",
        });
      }
    } catch (e) {
      console.error("Error fetching customer:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const saveEdit = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur de mise à jour");
        return;
      }
      setEditing(false);
      await fetchCustomer();
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setSaving(false);
    }
  };

  const copyPhoneNumber = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const openWhatsApp = (phone: string, customerName: string, debt?: number) => {
    const pressingName = tenant?.name || "PressiPro";
    let message = "";
    if (debt && debt > 0) {
      message = `🧺 *${pressingName}*\nBonjour *${customerName || "cher client"}*,\n\nNous vous informons qu'un solde restant de *${formatFCFA(debt)}* est en attente sur vos commandes en cours.\n\nMerci de votre confiance et restons à votre entière disposition ! 🙏`;
    } else {
      message = `🧺 *${pressingName}*\nBonjour *${customerName || "cher client"}*,\n\nToute l'équipe de *${pressingName}* reste à votre disposition pour le soin et le pressing de vos linges. ✨`;
    }
    const cleanPhone = normalizePhoneForWhatsApp(phone) || phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!customer?.orders) return [];
    return customer.orders.filter((order) => {
      // Status filter
      if (orderFilter === "active" && order.status === "LIVRE") return false;
      if (orderFilter === "unpaid" && order.paidAmount >= order.totalAmount) return false;
      if (orderFilter === "done" && order.status !== "LIVRE") return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = order.code.toLowerCase().includes(q);
        const matchItems = order.items.some((i) => i.name.toLowerCase().includes(q));
        const matchNotes = (order.notes || "").toLowerCase().includes(q);
        if (!matchCode && !matchItems && !matchNotes) return false;
      }

      return true;
    });
  }, [customer?.orders, orderFilter, searchQuery]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    if (!customer?.allPayments) return [];
    if (!searchQuery.trim()) return customer.allPayments;
    const q = searchQuery.toLowerCase().trim();
    return customer.allPayments.filter(
      (p) =>
        p.orderCode.toLowerCase().includes(q) ||
        p.agentName.toLowerCase().includes(q) ||
        (p.note || "").toLowerCase().includes(q) ||
        (METHOD_LABELS[p.method] || "").toLowerCase().includes(q)
    );
  }, [customer?.allPayments, searchQuery]);

  // Frequently deposited garments calculation
  const garmentHabits = useMemo(() => {
    if (!customer?.orders) return [];
    const countMap = new Map<string, { name: string; count: number; totalSpent: number }>();

    customer.orders.forEach((o) => {
      o.items.forEach((item) => {
        const existing = countMap.get(item.name) || { name: item.name, count: 0, totalSpent: 0 };
        existing.count += item.quantity;
        existing.totalSpent += item.total;
        countMap.set(item.name, existing);
      });
    });

    return Array.from(countMap.values()).sort((a, b) => b.count - a.count);
  }, [customer?.orders]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
          <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="card text-center py-16 max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Client introuvable</h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Ce contact n&apos;existe pas ou a été supprimé de ce pressing.
        </p>
        <Link href="/customers" className="btn-primary inline-flex items-center gap-2 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour à la liste des clients</span>
        </Link>
      </div>
    );
  }

  const { stats } = customer;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/customers")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-all shadow-2xs shrink-0 cursor-pointer"
            title="Retour aux clients"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">{customer.name}</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                Fiche & Traçabilité Client
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Client depuis le {new Date(customer.createdAt).toLocaleDateString("fr-SN")}</span>
              <span>·</span>
              <span className="font-mono">{customer.phone}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Quick WhatsApp */}
          <button
            type="button"
            onClick={() => openWhatsApp(customer.phone, customer.name, stats.totalDebt)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
            title="Discuter directement sur WhatsApp"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          {/* Quick Call */}
          <a
            href={`tel:${customer.phone}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold transition shadow-2xs active:scale-95"
            title="Appeler ce client"
          >
            <Phone className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">Appeler</span>
          </a>

          {/* New Order */}
          <Link
            href="/orders/new"
            className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 shadow-sm shadow-primary-600/20 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouveau Dépôt</span>
          </Link>

          {/* Edit Profile */}
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-gray-500" />
            <span>{editing ? "Fermer" : "Modifier"}</span>
          </button>
        </div>
      </div>

      {/* Inline Edit Form */}
      {editing && (
        <div className="card space-y-4 bg-gradient-to-br from-primary-50/40 via-white to-white border-primary-200/80 p-5 rounded-2xl animate-fade-in shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary-600" />
              <span>Modifier les informations du client</span>
            </h2>
            <button
              onClick={() => setEditing(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Nom complet *</label>
              <input
                className="input-field w-full text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Amadou Diallo"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Numéro de téléphone *</label>
              <input
                className="input-field w-full text-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="ex: +221 77 123 45 67"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Adresse email (facultatif)</label>
              <input
                type="email"
                className="input-field w-full text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ex: client@gmail.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Adresse de résidence / Livraison</label>
              <input
                className="input-field w-full text-sm"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="ex: Mermoz Rue 3, Dakar"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes & Préférences spécifiques</label>
              <textarea
                className="input-field w-full text-sm"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ex: Amidon léger, plier les chemises, client VIP..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={saveEdit}
              className="btn-primary text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Enregistrement..." : "Sauvegarder les modifications"}</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary text-xs cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* 4 Financial & Traçabilité KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Dépensé (CA) */}
        <div className="card-levitate bg-gradient-to-br from-blue-50/50 via-white to-white p-4 rounded-2xl border border-blue-100 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-800">
              Cumul Commandé
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono">
            {formatFCFA(stats.totalSpent)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Total des factures générées
          </p>
        </div>

        {/* Total Payé */}
        <div className="card-levitate bg-gradient-to-br from-emerald-50/50 via-white to-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">
              Total Encaissé
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            {formatFCFA(stats.totalPaid)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {customer.allPayments.length} règlement{customer.allPayments.length > 1 ? "s" : ""} reçu{customer.allPayments.length > 1 ? "s" : ""}
          </p>
        </div>

        {/* Solde Dû / Impayé */}
        <div
          className={`card-levitate p-4 rounded-2xl border shadow-2xs ${
            stats.totalDebt > 0
              ? "bg-gradient-to-br from-red-50/60 via-white to-white border-red-200"
              : "bg-gradient-to-br from-emerald-50/30 via-white to-white border-emerald-100"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                stats.totalDebt > 0 ? "text-red-700" : "text-emerald-700"
              }`}
            >
              Solde Dû (Impayé)
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                stats.totalDebt > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {stats.totalDebt > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>
          <p
            className={`text-xl sm:text-2xl font-black font-mono ${
              stats.totalDebt > 0 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {formatFCFA(stats.totalDebt)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {stats.totalDebt > 0 ? "Reste à recouvrer auprès du client" : "Compte entièrement soldé 🟢"}
          </p>
        </div>

        {/* Activité & Dépôts */}
        <div className="card-levitate bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
              Total Commandes
            </span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono">
            {stats.totalOrders}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {stats.activeOrdersCount > 0 ? (
              <span className="text-amber-600 font-bold">{stats.activeOrdersCount} en cours au pressing</span>
            ) : (
              <span>Toutes commandes livrées</span>
            )}
          </p>
        </div>
      </div>

      {/* Customer Info Card & Preferences */}
      <div className="card p-4 sm:p-5 bg-white border border-gray-200/80 rounded-2xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary-500" />
              <span>Téléphone</span>
            </span>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-900 font-mono">{customer.phone}</p>
              <button
                type="button"
                onClick={() => copyPhoneNumber(customer.phone)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition cursor-pointer"
                title="Copier le numéro"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-primary-500" />
              <span>Email</span>
            </span>
            <p className="text-sm text-gray-800 font-medium truncate">
              {customer.email || <span className="text-gray-400 font-normal italic">Non renseigné</span>}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary-500" />
              <span>Adresse</span>
            </span>
            <p className="text-sm text-gray-800 font-medium truncate">
              {customer.address || <span className="text-gray-400 font-normal italic">Non renseignée</span>}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary-500" />
              <span>Notes & Préférences</span>
            </span>
            <p className="text-xs text-gray-700 font-medium line-clamp-2">
              {customer.notes || <span className="text-gray-400 font-normal italic">Aucune note</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation: Commandes, Règlements, Habitudes */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("orders")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "orders"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Historique des Commandes ({customer.orders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "payments"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Journal des Règlements ({customer.allPayments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("habits")}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "habits"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Articles & Habitudes ({garmentHabits.length})</span>
            </button>
          </div>

          {/* Search bar inside customer history */}
          <div className="relative mb-2 sm:mb-0 w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer l'historique..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* TAB 1: Historique des Commandes */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {/* Filter pills for orders */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {[
                { id: "all", label: "Toutes les commandes" },
                { id: "active", label: `En cours (${stats.activeOrdersCount})` },
                { id: "unpaid", label: "Impayées / Soldes dus" },
                { id: "done", label: "Livrées" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setOrderFilter(pill.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    orderFilter === pill.id
                      ? "bg-gray-900 text-white shadow-2xs"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="card text-center py-14 bg-white border border-gray-200/80 rounded-2xl">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-700 font-bold text-sm">Aucune commande trouvée</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Aucun dépôt ne correspond aux filtres actuels pour ce client.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.RECU;
                  const StatusIcon = statusConf.icon;
                  const isUnpaid = order.paidAmount < order.totalAmount;
                  const remaining = order.totalAmount - order.paidAmount;

                  return (
                    <div
                      key={order.id}
                      className="card p-4 sm:p-5 bg-white hover:border-primary-200 hover:shadow-sm transition-all duration-200 rounded-2xl border border-gray-200/80 space-y-3"
                    >
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                            <StatusIcon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/orders/${order.id}`}
                                className="font-mono font-bold text-base text-primary-700 hover:underline flex items-center gap-1"
                              >
                                <span>{order.code}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                              </Link>
                              <span className={`badge ${statusConf.glowClass}`}>
                                {statusConf.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Déposé le {new Date(order.createdAt).toLocaleString("fr-SN", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Financial badges */}
                        <div className="flex items-center gap-3 self-end sm:self-auto text-right">
                          <div>
                            <p className="text-base sm:text-lg font-black text-gray-900 font-mono">
                              {formatFCFA(order.totalAmount)}
                            </p>
                            {isUnpaid ? (
                              <p className="text-xs font-bold text-red-600">
                                Reste : {formatFCFA(remaining)}
                              </p>
                            ) : (
                              <p className="text-xs font-bold text-emerald-600">
                                Entièrement Payé
                              </p>
                            )}
                          </div>

                          <Link
                            href={`/orders/${order.id}`}
                            className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                          >
                            <span>Détail</span>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </Link>
                        </div>
                      </div>

                      {/* Items deposited */}
                      <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100/80">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                          Articles déposés ({order.items.reduce((s, i) => s + i.quantity, 0)} pièces)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {order.items.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-800"
                            >
                              <span>{item.name}</span>
                              <strong className="text-primary-700">×{item.quantity}</strong>
                              <span className="text-gray-400 text-[10px]">({formatFCFA(item.total)})</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Footer: Promised date & payments summary */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-1">
                        <div>
                          {order.promisedAt && (
                            <span className="inline-flex items-center gap-1 text-gray-600">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>Promise pour le {new Date(order.promisedAt).toLocaleDateString("fr-SN")}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span>{order.payments.length} versement{order.payments.length > 1 ? "s" : ""}</span>
                          <span>·</span>
                          <span className="font-semibold text-gray-700">
                            Payé {formatFCFA(order.paidAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Journal des Règlements & Encaissements */}
        {activeTab === "payments" && (
          <div className="card p-0 bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-xs">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-14 p-4">
                <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-700 font-bold text-sm">Aucun règlement enregistré</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Aucun paiement n&apos;a encore été validé pour ce client.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile list */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {filteredPayments.map((p) => {
                    const badge = METHOD_BADGES[p.method] || METHOD_BADGES.OTHER;
                    return (
                      <div key={p.id} className="p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/orders/${p.orderId}`}
                            className="font-mono font-bold text-xs text-primary-700 hover:underline flex items-center gap-1"
                          >
                            <span>{p.orderCode}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </Link>
                          <span className="font-mono font-black text-emerald-600 text-sm">
                            +{formatFCFA(p.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {METHOD_LABELS[p.method] || p.method}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Agent : <strong className="text-gray-700">{p.agentName}</strong>
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 pt-0.5">
                          {new Date(p.createdAt).toLocaleString("fr-SN")}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/90 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date & Heure</th>
                        <th className="py-3 px-4">N° Commande</th>
                        <th className="py-3 px-4">Mode de Règlement</th>
                        <th className="py-3 px-4">Agent Encaisseur</th>
                        <th className="py-3 px-4 text-right">Montant Encaissé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPayments.map((p) => {
                        const badge = METHOD_BADGES[p.method] || METHOD_BADGES.OTHER;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                              {new Date(p.createdAt).toLocaleString("fr-SN", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>

                            <td className="py-3 px-4 font-mono font-bold">
                              <Link
                                href={`/orders/${p.orderId}`}
                                className="text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center gap-1"
                              >
                                <span>{p.orderCode}</span>
                                <ExternalLink className="w-3 h-3 text-gray-300" />
                              </Link>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {METHOD_LABELS[p.method] || p.method}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-xs text-gray-600 font-medium whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[11px]">
                                {p.agentName}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right font-black text-emerald-600 font-mono whitespace-nowrap">
                              +{formatFCFA(p.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: Habitudes & Articles Déposés */}
        {activeTab === "habits" && (
          <div className="card p-5 bg-white border border-gray-200/80 rounded-2xl shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Articles les plus fréquemment confiés</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Vue d&apos;ensemble des vêtements et linges déposés par ce client pour anticiper ses besoins.
              </p>
            </div>

            {garmentHabits.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Aucun article enregistré pour le moment.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {garmentHabits.map((h, i) => (
                  <div
                    key={h.name}
                    className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary-50 text-primary-700 font-black text-xs flex items-center justify-center">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{h.name}</p>
                        <p className="text-[11px] text-gray-500 font-mono">{formatFCFA(h.totalSpent)} cumulés</p>
                      </div>
                    </div>
                    <span className="font-mono font-black text-sm bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-primary-700">
                      ×{h.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
