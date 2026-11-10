import { describe, expect, it } from "vitest";
import {
  MAX_FCFA_AMOUNT,
  createExpenseSchema,
  createUserSchema,
  registerSchema,
  strongPasswordSchema,
  updateExpenseSchema,
} from "@/lib/validators";
import {
  activateSubscriptionFromCinetPay,
  subscriptionDaysFor,
  type SubscriptionPaymentRow,
} from "@/lib/subscription-billing";

describe("Dépenses, Facturation Abonnements Annuels & Politique de Mot de Passe", () => {
  it("valide les dépenses (catégories, dates valides et plafond FCFA)", () => {
    const valid = createExpenseSchema.safeParse({
      description: "Bidon lessive professionnelle 20L",
      amount: 18500,
      category: "PRODUITS",
      date: "2026-11-08",
      paymentMethod: "WAVE",
      supplier: "Dakar Chimie",
    });
    expect(valid.success).toBe(true);

    const defaulted = createExpenseSchema.safeParse({
      description: "Course livreur",
      amount: 1500,
    });
    expect(defaulted.success).toBe(true);
    if (defaulted.success) {
      expect(defaulted.data.category).toBe("AUTRE");
      expect(defaulted.data.paymentMethod).toBe("CASH");
    }

    expect(
      createExpenseSchema.safeParse({
        description: "Date corrompue",
        amount: 2000,
        date: "pas-une-date",
      }).success
    ).toBe(false);

    expect(
      createExpenseSchema.safeParse({
        description: "Montant excessif",
        amount: MAX_FCFA_AMOUNT + 500,
      }).success
    ).toBe(false);

    expect(updateExpenseSchema.safeParse({ amount: 2500 }).success).toBe(true);
  });

  it("accorde 365 jours aux forfaits annuels (dont BASIC 50 000 FCFA) et rejette les sous-paiements CinetPay", async () => {
    expect(subscriptionDaysFor("BASIC", 5000)).toBe(30);
    expect(subscriptionDaysFor("BASIC", 50000)).toBe(365);
    expect(subscriptionDaysFor("PRO", 10000)).toBe(30);
    expect(subscriptionDaysFor("PRO", 100000)).toBe(365);
    expect(subscriptionDaysFor("ENTERPRISE", 50000)).toBe(30);
    expect(subscriptionDaysFor("ENTERPRISE", 500000)).toBe(365);

    const pendingAnnualBasic: SubscriptionPaymentRow = {
      id: "sub-pay-1",
      tenantId: "tenant-1",
      plan: "BASIC",
      amount: 50000,
      transactionId: "SUB-BASIC-1731024000",
      status: "PENDING",
    };

    const alreadyDone = await activateSubscriptionFromCinetPay(
      { ...pendingAnnualBasic, status: "SUCCESS" },
      { success: true, status: "ACCEPTED", amount: 50000, currency: "XOF" },
      "webhook"
    );
    expect(alreadyDone).toEqual({ activated: false, reason: "already-processed" });

    const underpaid = await activateSubscriptionFromCinetPay(
      pendingAnnualBasic,
      { success: true, status: "ACCEPTED", amount: 5000, currency: "XOF" },
      "webhook"
    );
    expect(underpaid.activated).toBe(false);
    if (!underpaid.activated) {
      expect(underpaid.reason).toBe("mismatch");
    }

    const wrongCurrency = await activateSubscriptionFromCinetPay(
      pendingAnnualBasic,
      { success: true, status: "ACCEPTED", amount: 50000, currency: "USD" },
      "return"
    );
    expect(wrongCurrency.activated).toBe(false);
    if (!wrongCurrency.activated) {
      expect(wrongCurrency.reason).toBe("mismatch");
    }
  });

  it("applique uniformément la politique de mot de passe fort (10 à 100 caractères complexes)", () => {
    expect(strongPasswordSchema.safeParse("court1!A").success).toBe(false);
    expect(strongPasswordSchema.safeParse("sansmajuscule123!").success).toBe(false);
    expect(strongPasswordSchema.safeParse("SANSCHIFFRE!abc").success).toBe(false);
    expect(strongPasswordSchema.safeParse("SansSpecial1234").success).toBe(false);
    expect(strongPasswordSchema.safeParse(`Aa1!${"x".repeat(100)}`).success).toBe(false);

    expect(strongPasswordSchema.safeParse("Pressi#246810").success).toBe(true);

    expect(
      registerSchema.safeParse({
        tenantName: "Pressing Teranga",
        name: "Moussa Diop",
        email: "moussa@teranga.sn",
        password: "Pressi#246810",
      }).success
    ).toBe(true);

    expect(
      createUserSchema.safeParse({
        name: "Awa Fall",
        email: "awa@teranga.sn",
        role: "AGENT",
        password: "Pressi#975312",
      }).success
    ).toBe(true);
  });
});
