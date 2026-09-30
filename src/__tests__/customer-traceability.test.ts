import { describe, it, expect } from "vitest";
import { normalizePhoneForWhatsApp } from "@/lib/phone";

describe("Customer History & Traceability Logic", () => {
  const mockOrders = [
    {
      id: "ord-1",
      code: "CMD-001",
      status: "LIVRE" as const,
      totalAmount: 15000,
      paidAmount: 15000,
      createdAt: new Date("2026-09-20T10:00:00Z"),
      items: [
        { name: "Chemise", quantity: 3, total: 6000 },
        { name: "Pantalon", quantity: 2, total: 5000 },
        { name: "Veste", quantity: 1, total: 4000 },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 15000,
          method: "WAVE" as const,
          createdAt: new Date("2026-09-20T10:05:00Z"),
          createdBy: "user-1",
        },
      ],
    },
    {
      id: "ord-2",
      code: "CMD-002",
      status: "PRET" as const,
      totalAmount: 25000,
      paidAmount: 10000,
      createdAt: new Date("2026-09-28T14:30:00Z"),
      items: [
        { name: "Boubou 3 pièces", quantity: 1, total: 15000 },
        { name: "Chemise", quantity: 2, total: 4000 },
        { name: "Drap 2 places", quantity: 2, total: 6000 },
      ],
      payments: [
        {
          id: "pay-2",
          amount: 10000,
          method: "CASH" as const,
          createdAt: new Date("2026-09-28T14:35:00Z"),
          createdBy: "user-2",
        },
      ],
    },
  ];

  it("calculates customer financial stats accurately", () => {
    const totalOrders = mockOrders.length;
    const totalSpent = mockOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPaid = mockOrders.reduce((sum, o) => sum + o.paidAmount, 0);
    const totalDebt = Math.max(0, totalSpent - totalPaid);
    const activeOrdersCount = mockOrders.filter((o) => o.status !== "LIVRE").length;

    expect(totalOrders).toBe(2);
    expect(totalSpent).toBe(40000);
    expect(totalPaid).toBe(25000);
    expect(totalDebt).toBe(15000);
    expect(activeOrdersCount).toBe(1); // ord-2 is PRET
  });

  it("aggregates and sorts all payments chronologically across all orders", () => {
    const allPayments = mockOrders
      .flatMap((order) =>
        order.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          createdAt: p.createdAt,
          orderCode: order.code,
        }))
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    expect(allPayments.length).toBe(2);
    expect(allPayments[0].id).toBe("pay-2"); // More recent
    expect(allPayments[0].orderCode).toBe("CMD-002");
    expect(allPayments[1].id).toBe("pay-1");
  });

  it("calculates garment habits correctly", () => {
    const countMap = new Map<string, number>();
    mockOrders.forEach((o) => {
      o.items.forEach((item) => {
        countMap.set(item.name, (countMap.get(item.name) || 0) + item.quantity);
      });
    });

    expect(countMap.get("Chemise")).toBe(5); // 3 + 2
    expect(countMap.get("Pantalon")).toBe(2);
    expect(countMap.get("Boubou 3 pièces")).toBe(1);
    expect(countMap.get("Drap 2 places")).toBe(2);
  });

  it("formats WhatsApp contact links correctly for Senegalese numbers", () => {
    const rawPhone = "77 800 12 34";
    const cleanPhone = normalizePhoneForWhatsApp(rawPhone);
    expect(cleanPhone).toBe("221778001234");
  });
});
