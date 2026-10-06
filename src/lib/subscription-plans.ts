export type PlanKey = "FREE" | "BASIC" | "PRO" | "ENTERPRISE";
export type BillingCycle = "monthly" | "yearly";

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  badge?: string;
  description: string;
  monthlyPrice: number; // en FCFA
  yearlyPrice: number; // en FCFA
  popular?: boolean;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<PlanKey, PlanDefinition> = {
  FREE: {
    key: "FREE",
    name: "Essai Gratuit",
    description: "Pour tester et découvrir la puissance de PressiPro sans engagement.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Jusqu'à 50 commandes enregistrées",
      "Reçus numériques de base",
      "1 seul compte utilisateur",
      "Support standard par email",
    ],
  },
  BASIC: {
    key: "BASIC",
    name: "Plan Basic",
    badge: "Idéal Lancement",
    description: "Pour les pressings de quartier souhaitant professionnaliser leur gestion.",
    monthlyPrice: 5000,
    yearlyPrice: 50000, // 2 mois offerts
    features: [
      "Jusqu'à 300 commandes / mois",
      "Reçus certifiés avec QR code & logo",
      "Envoi instantané par WhatsApp",
      "Gestion de la caisse quotidienne",
      "Jusqu'à 3 comptes (Admin & Agents)",
      "Paiements Wave & Orange Money manuels",
      "Support WhatsApp réactif",
    ],
  },
  PRO: {
    key: "PRO",
    name: "Plan Pro",
    badge: "Le Plus Populaire",
    popular: true,
    description: "La solution complète pour développer votre chiffre d'affaires et fidéliser vos clients.",
    monthlyPrice: 10000,
    yearlyPrice: 100000, // 2 mois offerts
    features: [
      "Commandes & clients ILLIMITÉS",
      "Paiement direct Wave (App Mobile & QR)",
      "Graphiques modernes 2026 & bilans détaillés",
      "Comptes utilisateurs illimités",
      "Restriction de visibilité des gains pour les agents",
      "Personnalisation couleurs de marque du pressing",
      "Mode hors ligne PWA complet",
      "Support prioritaire 7j/7 VIP",
    ],
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    name: "Plan Enterprise",
    badge: "Multi-Pressings",
    description: "Pour les chaînes de pressing, blanchisseries industrielles et franchises.",
    monthlyPrice: 50000,
    yearlyPrice: 500000,
    features: [
      "Tout ce qui est inclus dans le Plan Pro",
      "Gestion multi-boutiques et succursales",
      "Export comptable automatisé Excel & PDF",
      "Formation personnalisée de votre équipe",
      "Intégrations matérielles POS & imprimantes",
      "Conseiller dédié PressiPro disponible 24/7",
    ],
  },
};

export function getPlanPrice(plan: PlanKey, cycle: BillingCycle = "monthly"): number {
  const def = SUBSCRIPTION_PLANS[plan];
  if (!def) return 0;
  return cycle === "yearly" ? def.yearlyPrice : def.monthlyPrice;
}
