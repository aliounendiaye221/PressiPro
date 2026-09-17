import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError } from "@/lib/api-utils";
import { getCategoryLabel } from "@/lib/cash";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const registerId = searchParams.get("registerId");

    const dateFilter: any = {};
    if (fromParam) {
      dateFilter.gte = new Date(fromParam);
    }
    if (toParam) {
      const toDate = new Date(toParam);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    // Query payments
    const paymentsWhere: any = { tenantId };
    if (Object.keys(dateFilter).length > 0) {
      paymentsWhere.createdAt = dateFilter;
    }

    // Query movements
    const movementsWhere: any = { tenantId };
    if (Object.keys(dateFilter).length > 0) {
      movementsWhere.createdAt = dateFilter;
    }
    if (registerId) {
      movementsWhere.session = { registerId };
    }

    const [payments, movements, users] = await Promise.all([
      prisma.payment.findMany({
        where: paymentsWhere,
        include: {
          order: {
            select: {
              code: true,
              customer: { select: { name: true } },
            },
          },
          session: {
            select: {
              sessionNumber: true,
              register: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      (prisma as any).cashMovement.findMany({
        where: movementsWhere,
        include: {
          session: {
            select: {
              sessionNumber: true,
              register: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Normalize operations
    interface OperationRow {
      date: Date;
      sessionNumber: string;
      registerName: string;
      type: string;
      ref: string;
      method: string;
      categoryOrReason: string;
      thirdParty: string;
      income: number;
      expense: number;
      operator: string;
    }

    const operations: OperationRow[] = [];

    for (const p of payments) {
      const sessionInfo = (p as any).session;
      operations.push({
        date: p.createdAt,
        sessionNumber: sessionInfo ? `#${sessionInfo.sessionNumber}` : "Hors vacation",
        registerName: sessionInfo?.register?.name || "Caisse Principale",
        type: "Encaissement Commande",
        ref: p.order?.code || "CMD",
        method: p.method,
        categoryOrReason: p.note ? `Règlement (${p.note})` : "Paiement prestation",
        thirdParty: p.order?.customer?.name || "Client",
        income: p.amount,
        expense: 0,
        operator: p.createdBy ? userMap.get(p.createdBy) || "Agent" : "Système",
      });
    }

    for (const m of movements) {
      const isOut = m.type === "CASH_OUT";
      operations.push({
        date: m.createdAt,
        sessionNumber: m.session ? `#${m.session.sessionNumber}` : "-",
        registerName: m.session?.register?.name || "Caisse Principale",
        type: isOut ? "Dépense Caisse" : "Apport Caisse",
        ref: m.receiptRef || "-",
        method: "CASH",
        categoryOrReason: `${getCategoryLabel(m.category)} — ${m.reason}`,
        thirdParty: m.beneficiary || "-",
        income: isOut ? 0 : m.amount,
        expense: isOut ? m.amount : 0,
        operator: m.createdById ? userMap.get(m.createdById) || "Agent" : "Système",
      });
    }

    // Sort chronologically
    operations.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Build CSV with semicolon separator (standard in Excel for French locale)
    const headers = [
      "Date & Heure",
      "Vacation N°",
      "Caisse",
      "Type d'opération",
      "Référence",
      "Mode de règlement",
      "Catégorie / Motif",
      "Client / Bénéficiaire",
      "Entrée (FCFA)",
      "Sortie (FCFA)",
      "Opérateur",
    ];

    function escapeCsv(str: string | number) {
      const text = String(str ?? "").replace(/"/g, '""');
      return `"${text}"`;
    }

    const rows = operations.map((op) => [
      escapeCsv(new Date(op.date).toLocaleString("fr-FR")),
      escapeCsv(op.sessionNumber),
      escapeCsv(op.registerName),
      escapeCsv(op.type),
      escapeCsv(op.ref),
      escapeCsv(op.method),
      escapeCsv(op.categoryOrReason),
      escapeCsv(op.thirdParty),
      escapeCsv(op.income),
      escapeCsv(op.expense),
      escapeCsv(op.operator),
    ]);

    // UTF-8 BOM for Excel
    const bom = "\uFEFF";
    const csvContent = bom + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");

    const filename = `journal-de-caisse-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
