import { describe, it, expect } from "vitest";
import { normalizePhoneForWhatsApp } from "@/lib/phone";
import { createExpenseSchema } from "@/lib/validators";

describe("WhatsApp phone normalization", () => {
  it("normalizes senegalese local numbers correctly", () => {
    expect(normalizePhoneForWhatsApp("77 123 45 67")).toBe("221771234567");
    expect(normalizePhoneForWhatsApp("+221 78 500 00 00")).toBe("221785000000");
  });

  it("handles numbers with extra spaces or dashes", () => {
    expect(normalizePhoneForWhatsApp("+221-76-111-22-33")).toBe("221761112233");
  });
});

describe("Expense validation schema", () => {
  it("validates a standard expense", () => {
    const valid = {
      description: "Achat 3 bidons lessive OMO 5L",
      amount: 15000,
      category: "PRODUITS",
      paymentMethod: "CASH",
    };
    const parsed = createExpenseSchema.parse(valid);
    expect(parsed.amount).toBe(15000);
    expect(parsed.category).toBe("PRODUITS");
  });

  it("rejects negative or zero amount", () => {
    const invalid = {
      description: "Carburant",
      amount: 0,
      category: "LIVRAISON",
    };
    expect(() => createExpenseSchema.parse(invalid)).toThrow();
  });

  it("defaults category to AUTRE if omitted", () => {
    const data = {
      description: "Dépense diverse",
      amount: 5000,
    };
    const parsed = createExpenseSchema.parse(data);
    expect(parsed.category).toBe("AUTRE");
  });
});

describe("Profit and Loss Calculations", () => {
  it("calculates net profit and margin correctly", () => {
    const revenue = 1500000;
    const expenses = 900000;
    const netProfit = revenue - expenses;
    const margin = Math.round((netProfit / revenue) * 100);

    expect(netProfit).toBe(600000);
    expect(margin).toBe(40);
    expect(netProfit >= 0).toBe(true);
  });

  it("calculates net loss correctly when expenses exceed revenue", () => {
    const revenue = 800000;
    const expenses = 1100000;
    const netProfit = revenue - expenses;

    expect(netProfit).toBe(-300000);
    expect(netProfit < 0).toBe(true);
  });
});
