import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { prisma } from "@/lib/db";
import { formatDate, getPaymentStatus, type ReceiptData } from "./mapper";
import { ReceiptPDF } from "./template";
import { generateQRDataURL } from "./qr";

const RECEIPT_CACHE_TTL_MS = 10 * 60 * 1000;
const RECEIPT_CACHE_MAX_ENTRIES = 40;

type OrderReceiptArgs = {
  tenantId: string;
  orderId: string;
  isDuplicate?: boolean;
};

export type OrderReceiptDataResult = {
  orderId: string;
  orderCode: string;
  receiptData: ReceiptData;
};

export type OrderReceiptPdfResult = {
  orderId: string;
  orderCode: string;
  pdfBuffer: Uint8Array;
  fromCache: boolean;
};

type ReceiptPdfCacheEntry = {
  fingerprint: string;
  buffer: Uint8Array;
  expiresAt: number;
};

const receiptPdfCache = new Map<string, ReceiptPdfCacheEntry>();

function cacheKey(tenantId: string, orderId: string, isDuplicate: boolean): string {
  return `${tenantId}:${orderId}:${isDuplicate ? "duplicate" : "standard"}`;
}

function purgeExpiredCacheEntries(now: number) {
  for (const [key, entry] of receiptPdfCache.entries()) {
    if (entry.expiresAt <= now) {
      receiptPdfCache.delete(key);
    }
  }
}

function enforceCacheLimit() {
  if (receiptPdfCache.size <= RECEIPT_CACHE_MAX_ENTRIES) {
    return;
  }

  const sortedEntries = Array.from(receiptPdfCache.entries()).sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt
  );
  const overflowCount = sortedEntries.length - RECEIPT_CACHE_MAX_ENTRIES;

  for (let index = 0; index < overflowCount; index += 1) {
    receiptPdfCache.delete(sortedEntries[index][0]);
  }
}

async function fetchOrderForReceipt(tenantId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, tenantId, deletedAt: null },
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
}

type OrderForReceipt = NonNullable<Awaited<ReturnType<typeof fetchOrderForReceipt>>>;

function buildFingerprint(order: OrderForReceipt, isDuplicate: boolean): string {
  return [
    order.updatedAt.getTime(),
    order.status,
    order.totalAmount,
    order.paidAmount,
    order.items.length,
    isDuplicate ? "duplicate" : "standard",
  ].join(":");
}

async function buildReceiptData(order: OrderForReceipt, isDuplicate: boolean): Promise<ReceiptData> {
  const amountDue = order.totalAmount - order.paidAmount;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrText = `${appUrl}/orders/${order.id}`;
  const qrDataUrl = await generateQRDataURL(qrText);

  return {
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
    promisedDate: order.promisedAt ? formatDate(order.promisedAt.toISOString()) : null,
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
    discountAmount: order.discountAmount,
    discountReason: order.discountReason,
    paidAmount: order.paidAmount,
    amountDue,
    paymentStatus: getPaymentStatus(order.totalAmount, order.paidAmount),
    qrDataUrl,
    isDuplicate,
  };
}

export async function getOrderReceiptData(args: OrderReceiptArgs): Promise<OrderReceiptDataResult | null> {
  const isDuplicate = args.isDuplicate ?? false;
  const order = await fetchOrderForReceipt(args.tenantId, args.orderId);

  if (!order) {
    return null;
  }

  const receiptData = await buildReceiptData(order, isDuplicate);

  return {
    orderId: order.id,
    orderCode: order.code,
    receiptData,
  };
}

export async function getOrderReceiptPdf(args: OrderReceiptArgs): Promise<OrderReceiptPdfResult | null> {
  const isDuplicate = args.isDuplicate ?? false;
  const order = await fetchOrderForReceipt(args.tenantId, args.orderId);

  if (!order) {
    return null;
  }

  const now = Date.now();
  const key = cacheKey(args.tenantId, args.orderId, isDuplicate);
  const fingerprint = buildFingerprint(order, isDuplicate);

  purgeExpiredCacheEntries(now);
  const cached = receiptPdfCache.get(key);

  if (cached && cached.expiresAt > now && cached.fingerprint === fingerprint) {
    return {
      orderId: order.id,
      orderCode: order.code,
      pdfBuffer: cached.buffer,
      fromCache: true,
    };
  }

  const receiptData = await buildReceiptData(order, isDuplicate);
  const receiptDocument = React.createElement(ReceiptPDF, {
    data: receiptData,
  }) as ReactElement<DocumentProps>;
  const pdfBuffer = new Uint8Array(
    await renderToBuffer(receiptDocument)
  );

  receiptPdfCache.set(key, {
    fingerprint,
    buffer: pdfBuffer,
    expiresAt: now + RECEIPT_CACHE_TTL_MS,
  });
  enforceCacheLimit();

  return {
    orderId: order.id,
    orderCode: order.code,
    pdfBuffer,
    fromCache: false,
  };
}

export async function warmOrderReceiptPdf(args: OrderReceiptArgs): Promise<boolean> {
  const result = await getOrderReceiptPdf(args);
  return Boolean(result);
}
