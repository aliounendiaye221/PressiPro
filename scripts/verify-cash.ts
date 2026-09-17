import {
  calculateSessionTotals,
  calculateDiscrepancy,
  generateZReportNumber,
  formatFCFA,
  getCategoryLabel,
} from "../src/lib/cash";
import {
  openSessionSchema,
  closeSessionSchema,
  cashMovementSchema,
  createCashRegisterSchema,
} from "../src/lib/validators";

console.log("[VERIFICATION] Testing calculateSessionTotals...");
const res = calculateSessionTotals(
  20000,
  [
    { amount: 5000, method: "CASH" },
    { amount: 10000, method: "WAVE" },
    { amount: 7500, method: "OM" },
  ],
  [
    { type: "CASH_OUT", amount: 3000, category: "LESSIVE" },
    { type: "CASH_IN", amount: 5000, category: "APPORT" },
  ]
);

if (res.totalCashSales !== 5000) throw new Error(`Expected 5000 cash sales, got ${res.totalCashSales}`);
if (res.totalWaveSales !== 10000) throw new Error(`Expected 10000 wave sales, got ${res.totalWaveSales}`);
if (res.totalSales !== 22500) throw new Error(`Expected 22500 total sales, got ${res.totalSales}`);
if (res.manualCashIn !== 5000) throw new Error(`Expected 5000 manual cash in, got ${res.manualCashIn}`);
if (res.manualCashOut !== 3000) throw new Error(`Expected 3000 manual cash out, got ${res.manualCashOut}`);
// 20000 + 5000 + 5000 - 3000 = 27000
if (res.expectedCash !== 27000) throw new Error(`Expected 27000 expected cash, got ${res.expectedCash}`);
console.log("  ✓ calculateSessionTotals PASSED (expectedCash: 27 000 FCFA)");

console.log("[VERIFICATION] Testing calculateDiscrepancy...");
const balanced = calculateDiscrepancy(27000, 27000);
if (balanced.difference !== 0 || !balanced.isBalanced) throw new Error("Balanced check failed");

const shortage = calculateDiscrepancy(25000, 27000);
if (shortage.difference !== -2000 || !shortage.isShortage || shortage.shortageAmount !== 2000) {
  throw new Error("Shortage check failed");
}

const surplus = calculateDiscrepancy(28500, 27000);
if (surplus.difference !== 1500 || !surplus.isSurplus || surplus.surplusAmount !== 1500) {
  throw new Error("Surplus check failed");
}
console.log("  ✓ calculateDiscrepancy PASSED (balanced, shortage, surplus)");

console.log("[VERIFICATION] Testing generateZReportNumber...");
const zNum = generateZReportNumber(14, new Date(2026, 8, 16));
if (zNum !== "Z-2026-0014") throw new Error(`Expected Z-2026-0014, got ${zNum}`);
console.log("  ✓ generateZReportNumber PASSED (Z-2026-0014)");

console.log("[VERIFICATION] Testing Zod schemas...");
const validOpen = openSessionSchema.safeParse({ registerId: "cs_1", openingAmount: 15000 });
if (!validOpen.success) throw new Error("openSessionSchema valid case failed");

const invalidOpen = openSessionSchema.safeParse({ registerId: "cs_1", openingAmount: -500 });
if (invalidOpen.success) throw new Error("openSessionSchema negative amount should fail");

const validClose = closeSessionSchema.safeParse({ actualCash: 27000, closingNote: "OK" });
if (!validClose.success) throw new Error("closeSessionSchema valid case failed");

const validMove = cashMovementSchema.safeParse({
  type: "CASH_OUT",
  amount: 4500,
  category: "LESSIVE",
  reason: "Achat lessive liquide 5L",
  beneficiary: "Boutique Touba",
  receiptRef: "FAC-88",
});
if (!validMove.success) throw new Error("cashMovementSchema valid case failed");

const invalidMove = cashMovementSchema.safeParse({
  type: "CASH_OUT",
  amount: 0,
  category: "LESSIVE",
  reason: "",
});
if (invalidMove.success) throw new Error("cashMovementSchema invalid case should fail");

console.log("  ✓ Zod schemas PASSED");

console.log("\n=========================================");
console.log("🎉 ALL CASH MANAGEMENT VERIFICATIONS PASSED!");
console.log("=========================================\n");
