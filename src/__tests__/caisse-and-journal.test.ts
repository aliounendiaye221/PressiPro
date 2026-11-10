import { describe, expect, it } from "vitest";
import { computeFinalTotal, computeOrderItems } from "@/lib/order-utils";
import {
  MAX_FCFA_AMOUNT,
  createOrderSchema,
  createPaymentSchema,
  updateOrderSchema,
} from "@/lib/validators";

describe("Caisse, Commandes & Journal Financier — Calculs réels et validations", () => {
  const serviceMap = new Map([
    [
      "svc-costume",
      {
        id: "svc-costume",
        name: "Costume 2 pièces",
        price: 3500,
        pricingType: "PER_ITEM" as const,
      },
    ],
    [
      "svc-kilo",
      {
        id: "svc-kilo",
        name: "Linge au kilo",
        price: 1200,
        pricingType: "PER_KG" as const,
      },
    ],
  ]);

  it("calcule exactement les totaux mixtes à la pièce et au kilo (avec arrondi au franc)", () => {
    const result = computeOrderItems(
      [
        { serviceId: "svc-costume", quantity: 2 },
        { serviceId: "svc-kilo", weight: 2.345 },
      ],
      serviceMap
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      serviceId: "svc-costume",
      quantity: 2,
      weight: null,
      total: 7000,
    });
    // 2.345 kg arrondi à 2.35 kg * 1200 = 2820 FCFA
    expect(result.items[1]).toMatchObject({
      serviceId: "svc-kilo",
      quantity: 1,
      weight: 2.35,
      total: 2820,
    });
    expect(result.itemsTotal).toBe(9820);
  });

  it("rejette les articles invalides (service inconnu, poids manquant/nul ou quantité fractionnaire)", () => {
    expect(() =>
      computeOrderItems([{ serviceId: "svc-inconnu", quantity: 1 }], serviceMap)
    ).toThrow(/Service introuvable/);

    expect(() =>
      computeOrderItems([{ serviceId: "svc-kilo", weight: 0 }], serviceMap)
    ).toThrow(/poids/i);

    expect(() =>
      computeOrderItems([{ serviceId: "svc-costume", quantity: 1.5 }], serviceMap)
    ).toThrow(/Quantité invalide/);
  });

  it("plafonne toujours la remise au sous-total pour éviter tout montant négatif", () => {
    expect(computeFinalTotal(10000, 2500)).toEqual({
      totalAmount: 7500,
      cappedDiscount: 2500,
    });

    expect(computeFinalTotal(5000, 12000)).toEqual({
      totalAmount: 0,
      cappedDiscount: 5000,
    });

    expect(computeFinalTotal(5000, -500)).toEqual({
      totalAmount: 5000,
      cappedDiscount: 0,
    });
  });

  it("valide l'idempotence clientRequestId, les dates promises et la borne INT4 FCFA", () => {
    const validPayment = createPaymentSchema.safeParse({
      amount: 5000,
      method: "WAVE",
      note: "Acompte réception",
      clientRequestId: "offline-queue-1731024000-abc123",
    });
    expect(validPayment.success).toBe(true);

    const overflowPayment = createPaymentSchema.safeParse({
      amount: MAX_FCFA_AMOUNT + 1,
      method: "CASH",
    });
    expect(overflowPayment.success).toBe(false);

    const zeroPayment = createPaymentSchema.safeParse({
      amount: 0,
      method: "CASH",
    });
    expect(zeroPayment.success).toBe(false);

    const invalidDateOrder = createOrderSchema.safeParse({
      customerId: "cust-1",
      items: [{ serviceId: "svc-costume", quantity: 1 }],
      promisedAt: "date-invalide-xyz",
    });
    expect(invalidDateOrder.success).toBe(false);

    const validOrder = createOrderSchema.safeParse({
      customerId: "cust-1",
      items: [{ serviceId: "svc-costume", quantity: 2 }],
      promisedAt: "2026-11-10T17:30",
      advanceAmount: 3000,
      advanceMethod: "OM",
      discountAmount: 500,
      clientRequestId: "req-pos-001",
    });
    expect(validOrder.success).toBe(true);

    const discountOnlyUpdate = updateOrderSchema.safeParse({
      discountAmount: 1000,
      discountReason: "Client fidèle",
      promisedAt: null,
    });
    expect(discountOnlyUpdate.success).toBe(true);
  });
});
