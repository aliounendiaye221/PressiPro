import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { verifyReceiptShareToken } from "@/lib/receipt-share";
import { ReceiptPDF } from "@/lib/receipt/template";
import { formatDate, getPaymentStatus } from "@/lib/receipt/mapper";
import { generateQRDataURL } from "@/lib/receipt/qr";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const payload = await verifyReceiptShareToken(token);

    if (!payload) {
      return errorResponse("Lien de reçu invalide ou expiré", 401);
    }

    const { searchParams } = new URL(request.url);
    const wantsMeta = searchParams.get("meta") === "1";
    const isDownload = searchParams.get("download") === "1";

    const order = await prisma.order.findFirst({
      where: {
        id: payload.orderId,
        tenantId: payload.tenantId,
      },
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
      return errorResponse("Reçu introuvable", 404);
    }

    const amountDue = order.totalAmount - order.paidAmount;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const qrText = `${appUrl}/share/receipt/${token}`;
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
      items: order.items.map((item) => ({
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
      isDuplicate: payload.duplicate === true,
    };

    if (wantsMeta) {
      return successResponse({
        orderCode: order.code,
        tenantName: order.tenant.name,
        customerName: order.customer.name,
        paymentStatus: receiptData.paymentStatus,
        amountDue,
      });
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(ReceiptPDF, { data: receiptData }) as never
    );

    await auditLog({
      tenantId: order.tenantId,
      action: "RECEIPT_SHARED_ACCESS",
      entity: "Order",
      entityId: order.id,
      details: { code: order.code },
    });

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
