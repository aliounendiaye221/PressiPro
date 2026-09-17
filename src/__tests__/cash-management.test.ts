import { describe, it, expect } from "vitest";
import {
  calculateSessionTotals,
  calculateDiscrepancy,
  generateZReportNumber,
  getCategoryLabel,
  formatFCFA,
} from "@/lib/cash";
import {
  openSessionSchema,
  closeSessionSchema,
  cashMovementSchema,
  createCashRegisterSchema,
} from "@/lib/validators";

describe("Cash Management — Financial Calculations", () => {
  it("computes physical cash in drawer accurately with initial float, sales, and movements", () => {
    const openingAmount = 25000;
    const payments = [
      { amount: 5000, method: "CASH" },
      { amount: 3000, method: "CASH" },
      { amount: 10000, method: "WAVE" },
      { amount: 7500, method: "OM" },
    ];
    const movements = [
      { type: "CASH_OUT" as const, amount: 4000, category: "LESSIVE" },
      { type: "CASH_OUT" as const, amount: 1500, category: "TRANSPORT" },
      { type: "CASH_IN" as const, amount: 10000, category: "APPORT" },
    ];

    const result = calculateSessionTotals(openingAmount, payments, movements);

    // Sales totals
    expect(result.totalCashSales).toBe(8000);
    expect(result.totalWaveSales).toBe(10000);
    expect(result.totalOmSales).toBe(7500);
    expect(result.totalSales).toBe(25500);
    expect(result.salesCount).toBe(4);

    // Movements
    expect(result.manualCashIn).toBe(10000);
    expect(result.manualCashOut).toBe(5500);

    // Theoretical physical cash: 25000 + 8000 (cash sales) + 10000 (manual in) - 5500 (expenses) = 37500
    expect(result.expectedCash).toBe(37500);
  });

  it("handles a session with zero float and no sales", () => {
    const result = calculateSessionTotals(0, [], []);
    expect(result.expectedCash).toBe(0);
    expect(result.totalSales).toBe(0);
    expect(result.manualCashIn).toBe(0);
    expect(result.manualCashOut).toBe(0);
  });

  it("calculates exact cash balance (discrepancy == 0)", () => {
    const expected = 35000;
    const actual = 35000;
    const disc = calculateDiscrepancy(actual, expected);

    expect(disc.difference).toBe(0);
    expect(disc.isBalanced).toBe(true);
    expect(disc.isShortage).toBe(false);
    expect(disc.isSurplus).toBe(false);
  });

  it("detects cash shortage (manquant de caisse)", () => {
    const expected = 50000;
    const actual = 48000;
    const disc = calculateDiscrepancy(actual, expected);

    expect(disc.difference).toBe(-2000);
    expect(disc.isBalanced).toBe(false);
    expect(disc.isShortage).toBe(true);
    expect(disc.isSurplus).toBe(false);
    expect(disc.shortageAmount).toBe(2000);
  });

  it("detects cash surplus (excédent de caisse)", () => {
    const expected = 50000;
    const actual = 51500;
    const disc = calculateDiscrepancy(actual, expected);

    expect(disc.difference).toBe(1500);
    expect(disc.isBalanced).toBe(false);
    expect(disc.isShortage).toBe(false);
    expect(disc.isSurplus).toBe(true);
    expect(disc.surplusAmount).toBe(1500);
  });
});

describe("Cash Management — Z Report and Utilities", () => {
  it("formats Z Report number with 4-digit zero padding and year", () => {
    const ref = generateZReportNumber(7, new Date(2026, 8, 16));
    expect(ref).toBe("Z-2026-0007");

    const refHigh = generateZReportNumber(142, new Date(2026, 0, 1));
    expect(refHigh).toBe("Z-2026-0142");
  });

  it("returns human-readable labels for categories", () => {
    expect(getCategoryLabel("LESSIVE")).toContain("Lessive");
    expect(getCategoryLabel("EMBALLAGE")).toContain("Cintres");
    expect(getCategoryLabel("APPORT")).toContain("Apport");
    expect(getCategoryLabel("CUSTOM_UNKNOWN")).toBe("CUSTOM_UNKNOWN");
  });

  it("formats currency in FCFA", () => {
    expect(formatFCFA(25000)).toBe("25 000 FCFA");
    expect(formatFCFA(0)).toBe("0 FCFA");
  });
});

describe("Cash Management — Zod Validation Schemas", () => {
  it("validates openSessionSchema", () => {
    const valid = openSessionSchema.safeParse({
      registerId: "cs_123",
      openingAmount: 20000,
      openingNote: "Remise billets",
    });
    expect(valid.success).toBe(true);

    const negative = openSessionSchema.safeParse({
      registerId: "cs_123",
      openingAmount: -500,
    });
    expect(negative.success).toBe(false);

    const missingRegister = openSessionSchema.safeParse({
      registerId: "",
      openingAmount: 10000,
    });
    expect(missingRegister.success).toBe(false);
  });

  it("validates closeSessionSchema", () => {
    const valid = closeSessionSchema.safeParse({
      actualCash: 35000,
      closingNote: "Rien à signaler",
    });
    expect(valid.success).toBe(true);

    const negative = closeSessionSchema.safeParse({
      actualCash: -100,
    });
    expect(negative.success).toBe(false);
  });

  it("validates cashMovementSchema", () => {
    const validExpense = cashMovementSchema.safeParse({
      type: "CASH_OUT",
      amount: 3000,
      category: "LESSIVE",
      reason: "Achat 2 bidons de javel",
      beneficiary: "Boutique Diallo",
    });
    expect(validExpense.success).toBe(true);

    const invalidZeroAmount = cashMovementSchema.safeParse({
      type: "CASH_OUT",
      amount: 0,
      category: "LESSIVE",
      reason: "Test",
    });
    expect(invalidZeroAmount.success).toBe(false);

    const invalidMissingReason = cashMovementSchema.safeParse({
      type: "CASH_IN",
      amount: 5000,
      category: "APPORT",
      reason: "",
    });
    expect(invalidMissingReason.success).toBe(false);
  });

  it("validates createCashRegisterSchema", () => {
    const valid = createCashRegisterSchema.safeParse({
      name: "Caisse Comptoir",
      code: "cs-02",
      isDefault: false,
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.code).toBe("CS-02");
    }

    const shortCode = createCashRegisterSchema.safeParse({
      name: "Caisse",
      code: "C",
    });
    expect(shortCode.success).toBe(false);
  });
});
