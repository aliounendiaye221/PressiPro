"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  customItems?: BreadcrumbItem[];
  className?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Tableau de bord",
  orders: "Commandes",
  new: "Nouveau dépôt",
  caisse: "Journal de Caisse",
  expenses: "Dépenses & Bilan",
  customers: "Clients",
  settings: "Paramètres",
  admin: "Admin SaaS",
  share: "Reçu partagé",
};

export function Breadcrumbs({ customItems, className = "" }: BreadcrumbsProps) {
  const pathname = usePathname();

  // If custom items provided, use them
  if (customItems && customItems.length > 0) {
    return (
      <nav aria-label="Fil d'Ariane" className={`flex items-center text-xs text-gray-500 dark:text-slate-400 mb-3 ${className}`}>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="sr-only sm:not-sr-only">Accueil</span>
        </Link>

        {customItems.map((item, index) => {
          const isLast = index === customItems.length - 1;
          return (
            <span key={index} className="flex items-center">
              <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-gray-400 dark:text-slate-600 shrink-0" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium truncate max-w-[140px] sm:max-w-none"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[160px] sm:max-w-none">
                  {item.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    );
  }

  // Auto-generate from pathname
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || pathname === "/dashboard") return null;

  const items: BreadcrumbItem[] = [];
  let accumulatedPath = "";

  segments.forEach((seg, idx) => {
    accumulatedPath += `/${seg}`;
    const isLast = idx === segments.length - 1;

    // Check if UUID or numeric ID
    const isId = seg.length > 20 || /^[0-9a-f-]{36}$/i.test(seg) || seg.startsWith("cm") || seg.startsWith("cl");
    const label = isId ? "Détail" : ROUTE_LABELS[seg] || seg;

    items.push({
      label,
      href: isLast ? undefined : accumulatedPath,
    });
  });

  return (
    <nav aria-label="Fil d'Ariane" className={`flex items-center text-xs text-gray-500 dark:text-slate-400 mb-3.5 ${className}`}>
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Accueil</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center">
            <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-gray-400 dark:text-slate-600 shrink-0" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium truncate max-w-[140px] sm:max-w-none"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[160px] sm:max-w-none">
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
