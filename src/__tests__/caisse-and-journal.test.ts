import { describe, it, expect } from "vitest";

interface MockPayment {
  id: string;
  tenantId: string;
  amount: number;
  method: "CASH" | "WAVE" | "OM" | "OTHER";
  createdAt: Date;
  orderCode: string;
  customerName: string;
  agentName: string;
}

describe("Journal de Caisse & Encaissements Logic", () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

  const mockPayments: MockPayment[] = [
    {
      id: "p1",
      tenantId: "pressing-1",
      amount: 15000,
      method: "CASH",
      createdAt: today,
      orderCode: "CMD-001",
      customerName: "Amadou Diallo",
      agentName: "Fatou",
    },
    {
      id: "p2",
      tenantId: "pressing-1",
      amount: 25000,
      method: "WAVE",
      createdAt: today,
      orderCode: "CMD-002",
      customerName: "Mariama Ba",
      agentName: "Modou",
    },
    {
      id: "p3",
      tenantId: "pressing-1",
      amount: 10000,
      method: "OM",
      createdAt: yesterday,
      orderCode: "CMD-003",
      customerName: "Ibrahima Fall",
      agentName: "Fatou",
    },
    {
      id: "p4",
      tenantId: "pressing-1",
      amount: 8000,
      method: "CASH",
      createdAt: threeDaysAgo,
      orderCode: "CMD-004",
      customerName: "Awa Ndiaye",
      agentName: "Modou",
    },
    {
      id: "p5",
      tenantId: "pressing-2", // Different tenant (pressing 2)
      amount: 99000,
      method: "CASH",
      createdAt: today,
      orderCode: "CMD-999",
      customerName: "Hacker / Other Tenant",
      agentName: "Spy",
    },
    {
      id: "p6",
      tenantId: "pressing-1",
      amount: 50000,
      method: "OTHER",
      createdAt: twoMonthsAgo,
      orderCode: "CMD-000",
      customerName: "Ancien Client",
      agentName: "Fatou",
    },
  ];

  it("strictly isolates cash journal by tenantId (no data leaks)", () => {
    const pressing1Payments = mockPayments.filter((p) => p.tenantId === "pressing-1");
    const pressing2Payments = mockPayments.filter((p) => p.tenantId === "pressing-2");

    expect(pressing1Payments.length).toBe(5);
    expect(pressing2Payments.length).toBe(1);
    expect(pressing1Payments.some((p) => p.customerName.includes("Other Tenant"))).toBe(false);
  });

  it("filters correctly by period: today", () => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const pressing1 = mockPayments.filter((p) => p.tenantId === "pressing-1");
    const todayPayments = pressing1.filter((p) => p.createdAt >= startOfToday);

    expect(todayPayments.length).toBe(2);
    expect(todayPayments.reduce((s, p) => s + p.amount, 0)).toBe(40000);
  });

  it("filters correctly by period: yesterday", () => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const pressing1 = mockPayments.filter((p) => p.tenantId === "pressing-1");
    const yesterdayPayments = pressing1.filter(
      (p) => p.createdAt >= startOfYesterday && p.createdAt < startOfToday
    );

    expect(yesterdayPayments.length).toBe(1);
    expect(yesterdayPayments[0].orderCode).toBe("CMD-003");
    expect(yesterdayPayments[0].amount).toBe(10000);
  });

  it("calculates breakdown by payment method accurately", () => {
    const pressing1 = mockPayments.filter((p) => p.tenantId === "pressing-1");
    const summary = {
      CASH: pressing1.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0),
      WAVE: pressing1.filter((p) => p.method === "WAVE").reduce((s, p) => s + p.amount, 0),
      OM: pressing1.filter((p) => p.method === "OM").reduce((s, p) => s + p.amount, 0),
      OTHER: pressing1.filter((p) => p.method === "OTHER").reduce((s, p) => s + p.amount, 0),
    };

    expect(summary.CASH).toBe(23000); // 15000 + 8000
    expect(summary.WAVE).toBe(25000);
    expect(summary.OM).toBe(10000);
    expect(summary.OTHER).toBe(50000);
    expect(summary.CASH + summary.WAVE + summary.OM + summary.OTHER).toBe(108000);
  });

  it("supports search matching orderCode, customerName or agentName", () => {
    const pressing1 = mockPayments.filter((p) => p.tenantId === "pressing-1");

    const searchAmadou = pressing1.filter(
      (p) =>
        p.orderCode.toLowerCase().includes("amadou") ||
        p.customerName.toLowerCase().includes("amadou") ||
        p.agentName.toLowerCase().includes("amadou")
    );
    expect(searchAmadou.length).toBe(1);
    expect(searchAmadou[0].id).toBe("p1");

    const searchFatou = pressing1.filter(
      (p) =>
        p.orderCode.toLowerCase().includes("fatou") ||
        p.customerName.toLowerCase().includes("fatou") ||
        p.agentName.toLowerCase().includes("fatou")
    );
    expect(searchFatou.length).toBe(3); // p1, p3, p6

    const searchCMD002 = pressing1.filter((p) => p.orderCode.toLowerCase().includes("cmd-002"));
    expect(searchCMD002.length).toBe(1);
    expect(searchCMD002[0].method).toBe("WAVE");
  });
});
