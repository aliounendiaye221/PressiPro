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
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

const MAX_PUBLIC_RECEIPT_REQUESTS_PER_IP = 30;
const PUBLIC_RECEIPT_WINDOW_MS = 60 * 1000;

function sanitizePdfLogoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:image/")) {
    return trimmed.length <= 500_000 ? trimmed : null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.)/.test(host) ||
      host === "[::1]"
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit(
      `public:receipt:ip:${clientIp}`,
      MAX_PUBLIC_RECEIPT_REQUESTS_PER_IP,
      PUBLIC_RECEIPT_WINDOW_MS
    );

    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes. Veuillez patienter un instant." },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipLimit.retryAfterSeconds),
          },
        }
      );
    }

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
        deletedAt: null,
        tenant: { active: true },
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

    const amountDue = Math.max(0, order.totalAmount - order.paidAmount);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const qrText = `${appUrl}/share/receipt/${token}`;
    const qrDataUrl = await generateQRDataURL(qrText);

    const receiptData = {
      tenantName: order.tenant.name,
      tenantLogoUrl: sanitizePdfLogoUrl(order.tenant.logoUrl),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: order.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        weight: item.weight,
        pricingType: item.pricingType,
      })),
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      discountReason: order.discountReason,
      paidAmount: order.paidAmount,
      amountDue,
      paymentStatus: getPaymentStatus(order.totalAmount, order.paidAmount),
      qrDataUrl,
      isDuplicate: payload.duplicate === true,
    };

    if (wantsMeta) {
      const [customerOrdersCount, statusHistory] = await Promise.all([
        prisma.order.count({
          where: {
            tenantId: order.tenantId,
            customerId: order.customerId,
            deletedAt: null,
          },
        }),
        prisma.orderStatusHistory.findMany({
          where: { orderId: order.id },
          orderBy: { createdAt: "asc" },
          select: { toStatus: true, createdAt: true },
        }),
      ]);

      const res = successResponse({
        orderId: order.id,
        orderCode: order.code,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        promisedAt: order.promisedAt ? order.promisedAt.toISOString() : null,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        discountReason: order.discountReason,
        paidAmount: order.paidAmount,
        amountDue,
        paymentStatus: receiptData.paymentStatus,
        items: receiptData.items,
        statusHistory: statusHistory.map((h) => ({
          status: h.toStatus,
          date: h.createdAt.toISOString(),
        })),
        tenant: {
          id: order.tenantId,
          name: order.tenant.name,
          phone: order.tenant.phone,
          address: order.tenant.address,
          waveNumber: order.tenant.waveNumber,
          omNumber: order.tenant.omNumber,
          logoUrl: receiptData.tenantLogoUrl,
          brandPrimaryColor: order.tenant.brandPrimaryColor,
          brandAccentColor: order.tenant.brandAccentColor,
        },
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
          ordersCount: customerOrdersCount,
          memberSince: order.customer.createdAt.toISOString(),
        },
        // Legacy flat fields for backward compatibility
        tenantId: order.tenantId,
        tenantName: order.tenant.name,
        tenantPhone: order.tenant.phone,
        tenantWaveNumber: order.tenant.waveNumber,
        tenantOmNumber: order.tenant.omNumber,
        customerName: order.customer.name,
      });
      res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
      return res;
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
        // Privé & non mis en cache CDN : protège les données personnelles et reflète immédiatement un paiement en ligne
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
