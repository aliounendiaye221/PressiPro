"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  Wallet,
  Banknote,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/orders", label: "Commandes", icon: ClipboardList },
  { href: "/orders/new", label: "Nouveau dépôt", icon: PlusCircle },
  { href: "/caisse", label: "Journal de Caisse", icon: Banknote },
  { href: "/expenses", label: "Dépenses & Bilan", icon: Wallet },
  { href: "/customers", label: "Clients", icon: Users },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const SUPER_ADMIN_NAV = [
  { href: "/admin", label: "Admin SaaS", icon: Shield },
];

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const { user, tenant, logout } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isAdmin = user?.role === "ADMIN" || isSuperAdmin;
  const filteredNav = isAdmin ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/expenses");
  const navItems = isSuperAdmin
    ? [...SUPER_ADMIN_NAV, ...filteredNav]
    : filteredNav;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-50 transition-opacity animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-[285px] bg-white dark:bg-slate-900 border-r border-gray-200/70 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Header with Close Button on Mobile */}
        <div className="p-5 pb-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
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
                className="w-10 h-10 rounded-xl object-cover shadow-md ring-1 ring-gray-200/80 dark:ring-slate-700"
              />
            ) : (
              <div
                style={{
                  backgroundColor: tenant?.brandPrimaryColor || undefined,
                }}
                className="w-10 h-10 bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25"
              >
                <span className="text-white font-black text-lg">
                  {tenant?.name?.charAt(0).toUpperCase() || "P"}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent truncate">
                {tenant?.name ? "PressiPro" : "PressiPro"}
              </h1>
              {tenant && (
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[150px] font-medium">
                  {tenant.name}
                </p>
              )}
            </div>
          </Link>

          {/* Close button on mobile drawer */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {isSuperAdmin && (
            <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Super Admin SaaS
            </p>
          )}

          {navItems.map((item, idx) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/orders/new" &&
                pathname.startsWith(item.href));
            const Icon = item.icon;

            const showSeparator = isSuperAdmin && idx === SUPER_ADMIN_NAV.length;

            return (
              <div key={item.href}>
                {showSeparator && (
                  <>
                    <div className="my-3 border-t border-gray-100 dark:border-slate-800" />
                    <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      Gestion du pressing
                    </p>
                  </>
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150",
                    isActive
                      ? "bg-primary-50 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 font-semibold shadow-xs"
                      : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/70 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-slate-500")} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-primary-400 shrink-0" />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-3.5 border-t border-gray-100/90 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/60">
          <ThemeToggle showLabel className="w-full justify-center mb-2.5" />

          <div className="flex items-center gap-3 mb-2.5 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/80 shadow-xs">
            <div
              style={{
                backgroundColor: tenant?.brandPrimaryColor || undefined,
              }}
              className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-xs shrink-0"
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">
                {user?.name}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate font-medium">
                {user?.role === "SUPER_ADMIN"
                  ? "Super Admin"
                  : user?.role === "ADMIN"
                  ? "Administrateur"
                  : "Agent"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}

function MobileTopBar({ setMobileOpen }: { setMobileOpen: (open: boolean) => void }) {
  const { tenant } = useAuth();

  return (
    <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-slate-800 px-3.5 flex items-center justify-between shadow-xs transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-1 text-gray-700 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
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
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-slate-700 shrink-0"
            />
          ) : (
            <div
              style={{
                backgroundColor: tenant?.brandPrimaryColor || undefined,
              }}
              className="w-7 h-7 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0"
            >
              {tenant?.name?.charAt(0).toUpperCase() || "P"}
            </div>
          )}
          <span className="font-extrabold text-sm text-gray-900 dark:text-slate-100 truncate">
            {tenant?.name || "PressiPro"}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 active:scale-95 rounded-xl shadow-xs transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Dépôt</span>
        </Link>
      </div>
    </header>
  );
}

function MobileBottomNav({ setMobileOpen }: { setMobileOpen: (open: boolean) => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const isTabActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/orders") return pathname === "/orders";
    if (href === "/orders/new") return pathname === "/orders/new";
    if (href === "/expenses") return pathname === "/expenses";
    if (href === "/customers") return pathname.startsWith("/customers");
    return pathname.startsWith(href);
  };

  return (
    <nav
      aria-label="Navigation mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around transition-colors"
    >
      {/* 1. Dashboard */}
      <Link
        href="/dashboard"
        className={cn(
          "flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors min-w-0",
          isTabActive("/dashboard") ? "text-primary-600 dark:text-primary-400 font-bold" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
        )}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5 shrink-0" />
        <span className="text-[10px] leading-tight truncate">Accueil</span>
      </Link>

      {/* 2. Commandes */}
      <Link
        href="/orders"
        className={cn(
          "flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors min-w-0",
          isTabActive("/orders") ? "text-primary-600 dark:text-primary-400 font-bold" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
        )}
      >
        <ClipboardList className="w-5 h-5 mb-0.5 shrink-0" />
        <span className="text-[10px] leading-tight truncate">Commandes</span>
      </Link>

      {/* 3. Nouveau Dépôt (Elevated Center Button) */}
      <div className="flex-1 flex justify-center -mt-5">
        <Link
          href="/orders/new"
          className="flex flex-col items-center group active:scale-95 transition-transform"
          aria-label="Créer un nouveau dépôt"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-700 via-primary-600 to-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/35 ring-4 ring-white dark:ring-slate-900">
            <PlusCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
          </div>
          <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400 mt-1">Dépôt</span>
        </Link>
      </div>

      {/* 4. Dépenses (Admin) ou Clients (Agent) */}
      {isAdmin ? (
        <Link
          href="/expenses"
          className={cn(
            "flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors min-w-0",
            isTabActive("/expenses") ? "text-primary-600 dark:text-primary-400 font-bold" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Wallet className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Dépenses</span>
        </Link>
      ) : (
        <Link
          href="/customers"
          className={cn(
            "flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors min-w-0",
            isTabActive("/customers") ? "text-primary-600 dark:text-primary-400 font-bold" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Users className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Clients</span>
        </Link>
      )}

      {/* 5. Plus (Opens Drawer Menu) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="flex flex-col items-center justify-center flex-1 py-1 text-center text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors min-w-0"
        aria-label="Plus d'options"
      >
        <Menu className="w-5 h-5 mb-0.5 shrink-0" />
        <span className="text-[10px] leading-tight truncate">Menu</span>
      </button>
    </nav>
  );
}

function ImpersonationBanner() {
  const { isImpersonated, tenant, exitImpersonation } = useAuth();
  const [exiting, setExiting] = useState(false);

  if (!isImpersonated) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white px-4 py-2 shadow-md flex flex-wrap items-center justify-between gap-2 sticky top-0 z-40 text-xs sm:text-sm">
      <div className="flex items-center gap-2 font-medium">
        <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 animate-pulse text-amber-100" />
        <span>
          Support Super Admin : pressing{" "}
          <strong className="underline underline-offset-2">{tenant?.name || "inconnu"}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={async () => {
          setExiting(true);
          await exitImpersonation();
        }}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {exiting ? "Retour..." : "Quitter"}
      </button>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-primary-100 dark:border-primary-950" />
          <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 overflow-x-hidden transition-colors duration-200">
      <ImpersonationBanner />
      <MobileTopBar setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <main className="flex-1 min-w-0 min-h-screen">
          <div className="pt-3 sm:pt-6 lg:pt-8 pb-28 lg:pb-8 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav setMobileOpen={setMobileOpen} />
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
      <ThemeProvider>
        <DashboardShell>{children}</DashboardShell>
      </ThemeProvider>
    </AuthProvider>
  );
}
