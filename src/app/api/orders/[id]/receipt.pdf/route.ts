import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";
import { ReceiptPDF } from "@/lib/receipt/template";
import { formatDate, getPaymentStatus } from "@/lib/receipt/mapper";
import { generateQRDataURL } from "@/lib/receipt/qr";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isDuplicate = searchParams.get("duplicate") === "1";
    const isDownload = searchParams.get("download") === "1";
    const isPreview = searchParams.get("preview") === "1";

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        customer: true,
        items: true,
        tenant: {
          select: {
            name: true,
            address: true,
            phone: true,
            logoUrl: true,
            brandPrimaryColor: true,
            brandAccentColor: true,
            waveNumber: true,
            omNumber: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const amountDue = order.totalAmount - order.paidAmount;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const qrText = `${appUrl}/orders/${order.id}`;
    const qrDataUrl = await generateQRDataURL(qrText);

    const receiptData = {
      tenantName: order.tenant.name,
      tenantLogoUrl: order.tenant.logoUrl,
      tenantPrimaryColor: order.tenant.brandPrimaryColor,
      tenantAccentColor: order.tenant.brandAccentColor,
      tenantAddress: order.tenant.address,
      tenantPhone: order.tenant.phone,
      tenantWaveNumber: order.tenant.waveNumber,
      tenantOmNumber: order.tenant.omNumber,
      orderCode: order.code,
      orderDate: formatDate(order.createdAt.toISOString()),
      promisedDate: order.promisedAt
        ? formatDate(order.promisedAt.toISOString())
        : null,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      items: order.items.map((item: { name: string; quantity: number; unitPrice: number; total: number; weight: number | null; pricingType: string }) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        weight: item.weight,
        pricingType: item.pricingType,
      })),
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      amountDue,
      paymentStatus: getPaymentStatus(order.totalAmount, order.paidAmount),
      qrDataUrl,
      isDuplicate,
    };

    const pdfBuffer = await renderToBuffer(
      React.createElement(ReceiptPDF, { data: receiptData }) as any
    );

    if (!isPreview) {
      await auditLog({
        tenantId: session.tenantId,
        userId: session.userId,
        action: isDuplicate ? "RECEIPT_REPRINT" : "RECEIPT_PRINT",
        entity: "Order",
        entityId: order.id,
        details: { code: order.code, isDuplicate },
      });
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="recu-${order.code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
