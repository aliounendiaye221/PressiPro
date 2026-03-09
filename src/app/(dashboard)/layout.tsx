"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/orders", label: "Commandes", icon: ClipboardList },
  { href: "/orders/new", label: "Nouveau dépôt", icon: PlusCircle },
  { href: "/customers", label: "Clients", icon: Users },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const SUPER_ADMIN_NAV = [
  { href: "/admin", label: "Admin SaaS", icon: Shield },
];

function Sidebar() {
  const pathname = usePathname();
  const { user, tenant, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const navItems = isSuperAdmin
    ? [...SUPER_ADMIN_NAV, ...NAV_ITEMS]
    : NAV_ITEMS;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white/90 backdrop-blur-lg rounded-xl shadow-lg border border-gray-200/50 hover:bg-white transition-all duration-200"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        {mobileOpen ? (
          <X className="w-5 h-5 text-gray-700" />
        ) : (
          <Menu className="w-5 h-5 text-gray-700" />
        )}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-[280px] bg-white/80 backdrop-blur-xl border-r border-gray-200/60 flex flex-col transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Header */}
        <div className="p-6 pb-4">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-2xl outline-none transition-opacity duration-200 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Retourner à la page d'accueil PressiPro"
          >
            {tenant?.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="w-10 h-10 rounded-xl object-cover shadow-lg ring-1 ring-gray-200/80"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                <span className="text-white font-bold text-lg">P</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent">
                PressiPro
              </h1>
              {tenant && (
                <p className="text-xs text-gray-500 truncate max-w-[160px]">
                  {tenant.name}
                </p>
              )}
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {isSuperAdmin && (
            <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Plateforme
            </p>
          )}

          {navItems.map((item, idx) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/orders/new" &&
                pathname.startsWith(item.href));
            const Icon = item.icon;

            // Section separator for tenant nav when super admin
            const showSeparator = isSuperAdmin && idx === SUPER_ADMIN_NAV.length;

            return (
              <div key={item.href}>
                {showSeparator && (
                  <>
                    <div className="my-3 border-t border-gray-100" />
                    <p className="px-4 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Pressing
                    </p>
                  </>
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    isActive ? "sidebar-link-active" : "sidebar-link"
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-primary-400" />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-gray-100/80">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-gray-50/80">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.name}
              </p>
              <p className="text-[11px] text-gray-500">
                {user?.role === "SUPER_ADMIN"
                  ? "Super Admin"
                  : user?.role === "ADMIN"
                  ? "Administrateur"
                  : "Agent"}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
          <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50/50 overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 min-h-screen">
        <div className="pt-16 lg:pt-8 px-4 pb-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
