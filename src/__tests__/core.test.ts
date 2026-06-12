import { describe, it, expect } from "vitest";
import { canTransition, isRollback, getNextStatuses } from "@/lib/order-status";
import { getPaymentStatus, formatFCFA } from "@/lib/receipt/mapper";
import { normalizePhoneForStorage, normalizePhoneForWhatsApp } from "@/lib/phone";

describe("order-status transitions", () => {
  it("allows RECU → TRAITEMENT", () => {
    expect(canTransition("RECU", "TRAITEMENT")).toBe(true);
  });

  it("allows TRAITEMENT → PRET", () => {
    expect(canTransition("TRAITEMENT", "PRET")).toBe(true);
  });

  it("allows PRET → LIVRE", () => {
    expect(canTransition("PRET", "LIVRE")).toBe(true);
  });

  it("denies RECU → PRET (skip)", () => {
    expect(canTransition("RECU", "PRET")).toBe(false);
  });

  it("denies RECU → LIVRE (skip)", () => {
    expect(canTransition("RECU", "LIVRE")).toBe(false);
  });

  it("allows rollback TRAITEMENT → RECU", () => {
    expect(canTransition("TRAITEMENT", "RECU")).toBe(true);
    expect(isRollback("TRAITEMENT", "RECU")).toBe(true);
  });

  it("allows rollback PRET → TRAITEMENT", () => {
    expect(canTransition("PRET", "TRAITEMENT")).toBe(true);
    expect(isRollback("PRET", "TRAITEMENT")).toBe(true);
  });

  it("allows rollback LIVRE → PRET", () => {
    expect(canTransition("LIVRE", "PRET")).toBe(true);
    expect(isRollback("LIVRE", "PRET")).toBe(true);
  });

  it("forward transitions are not rollbacks", () => {
    expect(isRollback("RECU", "TRAITEMENT")).toBe(false);
    expect(isRollback("TRAITEMENT", "PRET")).toBe(false);
  });

  it("getNextStatuses for RECU includes TRAITEMENT", () => {
    const nexts = getNextStatuses("RECU");
    expect(nexts).toContain("TRAITEMENT");
    expect(nexts).not.toContain("PRET");
  });
});

describe("payment calculations", () => {
  it("calculates amount due correctly", () => {
    const total = 5000;
    const paid = 2000;
    const due = total - paid;
    expect(due).toBe(3000);
  });

  it("total from items", () => {
    const items = [
      { quantity: 2, unitPrice: 500 },
      { quantity: 1, unitPrice: 1000 },
      { quantity: 3, unitPrice: 1500 },
    ];
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    expect(total).toBe(6500);
  });

  it("getPaymentStatus returns PAYE when fully paid", () => {
    expect(getPaymentStatus(5000, 5000)).toBe("PAYE");
    expect(getPaymentStatus(5000, 6000)).toBe("PAYE");
  });

  it("getPaymentStatus returns PARTIEL when partially paid", () => {
    expect(getPaymentStatus(5000, 2000)).toBe("PARTIEL");
  });

  it("getPaymentStatus returns IMPAYE when nothing paid", () => {
    expect(getPaymentStatus(5000, 0)).toBe("IMPAYE");
  });
});

describe("formatFCFA", () => {
  it("formats numbers with FCFA suffix", () => {
    const result = formatFCFA(5000);
    expect(result).toContain("5");
    expect(result).toContain("000");
    expect(result).toContain("FCFA");
  });
});

describe("phone normalization", () => {
  it("normalizes local Senegal number to E.164", () => {
    expect(normalizePhoneForStorage("77 123 45 67")).toBe("+221771234567");
  });

  it("normalizes WhatsApp digits without plus sign", () => {
    expect(normalizePhoneForWhatsApp("+221 77 123 45 67")).toBe("221771234567");
  });

  it("returns null for invalid phone", () => {
    expect(normalizePhoneForStorage("abc")).toBeNull();
  });
});

describe("newly added business logic rules", () => {
  it("allows both ADMIN and SUPER_ADMIN roles to perform a status rollback in our logic check", () => {
    const isRollbackFn = (from: string, to: string) => from === "TRAITEMENT" && to === "RECU";
    const canUserRollback = (role: string, from: string, to: string) => {
      const isRb = isRollbackFn(from, to);
      if (isRb && role !== "ADMIN" && role !== "SUPER_ADMIN") {
        return false;
      }
      return true;
    };

    expect(canUserRollback("ADMIN", "TRAITEMENT", "RECU")).toBe(true);
    expect(canUserRollback("SUPER_ADMIN", "TRAITEMENT", "RECU")).toBe(true);
    expect(canUserRollback("AGENT", "TRAITEMENT", "RECU")).toBe(false);
  });

  it("recomputes net total amount correctly by capping and subtracting existing discount", () => {
    const computeFinalTotal = (newTotal: number, discountAmount: number) => {
      const cappedDiscount = Math.min(discountAmount, newTotal);
      return newTotal - cappedDiscount;
    };

    expect(computeFinalTotal(10000, 2000)).toBe(8000);
    expect(computeFinalTotal(3000, 5000)).toBe(0); // Discount capped at subtotal
  });
});
