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
  WalletCards,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/orders", label: "Commandes", icon: ClipboardList },
  { href: "/orders/new", label: "Nouveau dépôt", icon: PlusCircle },
  { href: "/caisse", label: "Caisse & Compta", icon: WalletCards },
  { href: "/customers", label: "Clients", icon: Users },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const SUPER_ADMIN_NAV = [
  { href: "/admin", label: "Admin SaaS", icon: Shield },
];

function Sidebar({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { user, tenant, logout } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const navItems = isSuperAdmin
    ? [...SUPER_ADMIN_NAV, ...NAV_ITEMS]
    : NAV_ITEMS;

  return (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-gray-200/70 flex flex-col transition-transform duration-300 ease-out shadow-2xl lg:shadow-none lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Header with Close on mobile */}
        <div className="p-5 pb-4 flex items-center justify-between border-b border-gray-100/80 lg:border-b-0">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-2xl outline-none transition-opacity duration-200 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Retourner à la page d'accueil PressiPro"
          >
            {tenant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="w-10 h-10 rounded-xl object-cover shadow-md ring-1 ring-gray-200/80"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/25">
                <span className="text-white font-bold text-lg">P</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent truncate">
                PressiPro
              </h1>
              {tenant && (
                <p className="text-xs text-gray-500 truncate max-w-[150px]">
                  {tenant.name}
                </p>
              )}
            </div>
          </Link>

          {/* Close button inside drawer on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
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
                    isActive ? "sidebar-link-active" : "sidebar-link",
                    "py-2.5 text-sm"
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-primary-400 shrink-0" />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-gray-100/80 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-sm shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.name}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
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
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}

function MobileHeader({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  const { user, tenant } = useAuth();

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md border-b border-gray-200/70 z-30 px-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onOpenMenu}
          className="p-2 text-gray-700 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors shrink-0"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-gray-200 shrink-0"
            />
          ) : (
            <div className="w-7 h-7 bg-primary-600 text-white rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
              P
            </div>
          )}
          <span className="font-bold text-sm text-gray-900 truncate">
            {tenant?.name || "PressiPro"}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/orders/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 text-white font-semibold text-xs shadow-sm hover:bg-primary-700 transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Dépôt</span>
        </Link>
        <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
    { href: "/orders", label: "Commandes", icon: ClipboardList },
    { href: "/orders/new", label: "Nouveau", icon: PlusCircle, isPrimary: true },
    { href: "/caisse", label: "Caisse", icon: WalletCards },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200/80 z-30 px-3 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        if (item.isPrimary) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center -mt-5"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-700 via-primary-600 to-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-600/35 active:scale-95 transition-transform">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-primary-700 mt-1">
                {item.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 min-w-[56px]",
              isActive
                ? "text-primary-700 font-bold"
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}

      {/* Menu / Plus button to open full sidebar */}
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-gray-400 hover:text-gray-600 transition-all duration-150 min-w-[56px]"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Plus</span>
      </button>
    </nav>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <div className="min-h-screen flex bg-gray-50 overflow-x-hidden">
      <MobileHeader onOpenMenu={() => setMobileOpen(true)} />
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main className="flex-1 min-w-0 min-h-screen">
        <div className="pt-16 pb-20 sm:pb-24 lg:pt-8 lg:pb-8 px-3.5 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <MobileBottomNav onOpenMenu={() => setMobileOpen(true)} />
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
