"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import {
  Building2, Users, ShoppingCart, TrendingUp, TrendingDown,
  CreditCard, Banknote, Smartphone, Wallet, UserCheck,
  ArrowUpRight, CalendarDays
} from "lucide-react";

interface KPI {
  totalTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  totalCustomers: number;
  mrr: number;
  mrrGrowth: number;
}

interface TenantStat {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  users: number;
  orders: number;
  customers: number;
  revenue: number;
}

interface RecentPayment {
  id: string;
  amount: number;
  method: string;
  orderCode: string;
  customerName: string;
  tenantName: string;
  createdAt: string;
}

function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-SN", { day: "2-digit", month: "short", year: "numeric" });
}

const METHOD_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote className="w-4 h-4" />,
  OM: <Smartphone className="w-4 h-4 text-orange-500" />,
  WAVE: <CreditCard className="w-4 h-4 text-blue-500" />,
  OTHER: <Wallet className="w-4 h-4" />,
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  OM: "Orange Money",
  WAVE: "Wave",
  OTHER: "Autre",
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<{ kpi: KPI; tenants: TenantStat[]; recentPayments: RecentPayment[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!data) return <p className="text-center py-10 text-gray-500">Erreur de chargement</p>;

  const { kpi, tenants, recentPayments } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration SaaS</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d&apos;ensemble de la plateforme</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl rotate-12 opacity-20" />
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Building2 className="w-4 h-4" /> Pressings
          </div>
          <p className="text-2xl font-bold">{kpi.totalTenants}</p>
        </div>

        <div className="stat-card relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-violet-400 to-violet-600 rounded-xl rotate-12 opacity-20" />
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Users className="w-4 h-4" /> Utilisateurs
          </div>
          <p className="text-2xl font-bold">{kpi.totalUsers}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1"><UserCheck className="w-3 h-3" /> {kpi.activeUsers} actifs</p>
        </div>

        <div className="stat-card relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl rotate-12 opacity-20" />
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <ShoppingCart className="w-4 h-4" /> Commandes
          </div>
          <p className="text-2xl font-bold">{kpi.totalOrders}</p>
          <p className="text-xs text-gray-500">{kpi.totalCustomers} clients</p>
        </div>

        <div className="stat-card relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl rotate-12 opacity-20" />
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4" /> Revenu du mois
          </div>
          <p className="text-2xl font-bold">{formatFCFA(kpi.mrr)}</p>
          <p className={`text-xs flex items-center gap-1 ${kpi.mrrGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
            {kpi.mrrGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {kpi.mrrGrowth > 0 ? "+" : ""}{kpi.mrrGrowth}% vs mois dernier
          </p>
        </div>
      </div>

      {/* Tenants table */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" /> Pressings inscrits
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Pressing</th>
                <th className="pb-2 font-medium text-center">Users</th>
                <th className="pb-2 font-medium text-center">Commandes</th>
                <th className="pb-2 font-medium text-center">Clients</th>
                <th className="pb-2 font-medium text-right">Revenu mois</th>
                <th className="pb-2 font-medium text-right">Inscription</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-center">{t.users}</td>
                  <td className="py-2.5 text-center">{t.orders}</td>
                  <td className="py-2.5 text-center">{t.customers}</td>
                  <td className="py-2.5 text-right font-medium">{formatFCFA(t.revenue)}</td>
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    <span className="flex items-center justify-end gap-1"><CalendarDays className="w-3 h-3" /> {formatDate(t.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent payments across all tenants */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-green-600" /> Derniers paiements (toute la plateforme)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Pressing</th>
                <th className="pb-2 font-medium">Commande</th>
                <th className="pb-2 font-medium">Client</th>
                <th className="pb-2 font-medium">Méthode</th>
                <th className="pb-2 font-medium text-right">Montant</th>
                <th className="pb-2 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2">{p.tenantName}</td>
                  <td className="py-2 font-mono text-xs">{p.orderCode}</td>
                  <td className="py-2">{p.customerName}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-1.5">
                      {METHOD_ICONS[p.method]} {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">{formatFCFA(p.amount)}</td>
                  <td className="py-2 text-right text-gray-500 text-xs">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
