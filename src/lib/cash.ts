/**
 * Cash register and financial integrity utilities for PressiPro
 */

export interface CashCategory {
  id: string;
  label: string;
  type: "CASH_IN" | "CASH_OUT";
  description: string;
}

export const CASH_CATEGORIES: CashCategory[] = [
  { id: "LESSIVE", label: "Détergents & Lessive", type: "CASH_OUT", description: "Lessive, javel, adoucissant, détachant" },
  { id: "EMBALLAGE", label: "Cintres & Emballages", type: "CASH_OUT", description: "Housses plastique, cintres métal/bois, étiquettes" },
  { id: "FOURNITURES", label: "Fournitures de bureau", type: "CASH_OUT", description: "Papier thermique, stylos, agrafes, petit matériel" },
  { id: "ENERGIE", label: "Électricité & Eau", type: "CASH_OUT", description: "Factures Senelec, Sénégalaise Des Eaux, gaz" },
  { id: "TRANSPORT", label: "Transport & Livraison", type: "CASH_OUT", description: "Carburant, course moto/taxi pour livraison client" },
  { id: "SALAIRE", label: "Avance sur salaire", type: "CASH_OUT", description: "Acompte ou avance agent pressing" },
  { id: "MAINTENANCE", label: "Maintenance & Réparation", type: "CASH_OUT", description: "Entretien machine à laver, fer à repasser, chaudière" },
  { id: "APPORT", label: "Apport de monnaie", type: "CASH_IN", description: "Réapprovisionnement de la caisse par le gérant" },
  { id: "AUTRE_DEPENSE", label: "Autre dépense", type: "CASH_OUT", description: "Dépense diverse justifiée" },
  { id: "AUTRE_ENTREE", label: "Autre entrée", type: "CASH_IN", description: "Autre rentrée de fonds" },
];

export function getCategoryLabel(categoryId: string): string {
  const found = CASH_CATEGORIES.find((c) => c.id === categoryId);
  return found ? found.label : categoryId;
}

export interface PaymentLike {
  amount: number;
  method: string;
}

export interface MovementLike {
  type: "CASH_IN" | "CASH_OUT";
  amount: number;
  category: string;
}

export interface SessionFinancialSummary {
  openingAmount: number;
  totalCashSales: number;
  totalWaveSales: number;
  totalOmSales: number;
  totalOtherSales: number;
  totalSales: number;
  salesCount: number;
  manualCashIn: number;
  manualCashOut: number;
  expectedCash: number;
  totalMovementsCount: number;
}

/**
 * Calculates real-time financial balance for a cash session
 */
export function calculateSessionTotals(
  openingAmount: number,
  payments: PaymentLike[],
  movements: MovementLike[]
): SessionFinancialSummary {
  let totalCashSales = 0;
  let totalWaveSales = 0;
  let totalOmSales = 0;
  let totalOtherSales = 0;

  for (const p of payments) {
    switch (p.method) {
      case "CASH":
        totalCashSales += p.amount;
        break;
      case "WAVE":
        totalWaveSales += p.amount;
        break;
      case "OM":
        totalOmSales += p.amount;
        break;
      default:
        totalOtherSales += p.amount;
        break;
    }
  }

  const totalSales = totalCashSales + totalWaveSales + totalOmSales + totalOtherSales;

  let manualCashIn = 0;
  let manualCashOut = 0;

  for (const m of movements) {
    if (m.type === "CASH_IN") {
      manualCashIn += m.amount;
    } else if (m.type === "CASH_OUT") {
      manualCashOut += m.amount;
    }
  }

  // Theoretical physical cash currently in the drawer:
  // Initial float + Cash sales + Manual Cash In - Manual Cash Out
  const expectedCash = openingAmount + totalCashSales + manualCashIn - manualCashOut;

  return {
    openingAmount,
    totalCashSales,
    totalWaveSales,
    totalOmSales,
    totalOtherSales,
    totalSales,
    salesCount: payments.length,
    manualCashIn,
    manualCashOut,
    expectedCash,
    totalMovementsCount: movements.length,
  };
}

/**
 * Calculates cash discrepancy during closing
 */
export function calculateDiscrepancy(actualCash: number, expectedCash: number) {
  const difference = actualCash - expectedCash;
  return {
    difference,
    isBalanced: difference === 0,
    isShortage: difference < 0,
    isSurplus: difference > 0,
    shortageAmount: difference < 0 ? Math.abs(difference) : 0,
    surplusAmount: difference > 0 ? difference : 0,
  };
}

/**
 * Generates official Z Report reference
 */
export function generateZReportNumber(sessionNumber: number, date: Date = new Date()): string {
  const year = date.getFullYear();
  return `Z-${year}-${String(sessionNumber).padStart(4, "0")}`;
}

/**
 * Formats an amount in FCFA with thousands separator
 */
export function formatFCFA(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}
