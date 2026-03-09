export interface ReceiptData {
  // Tenant
  tenantName: string;
  tenantLogoUrl?: string | null;
  tenantPrimaryColor?: string | null;
  tenantAccentColor?: string | null;
  tenantAddress?: string | null;
  tenantPhone?: string | null;
  tenantWaveNumber?: string | null;
  tenantOmNumber?: string | null;

  // Order
  orderCode: string;
  orderDate: string;
  promisedDate?: string | null;

  // Customer
  customerName: string;
  customerPhone: string;

  // Items
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    weight?: number | null;
    pricingType?: string;
  }[];

  // Totals
  totalAmount: number;
  paidAmount: number;
  amountDue: number;

  // Payment status
  paymentStatus: "PAYE" | "PARTIEL" | "IMPAYE";

  // QR
  qrDataUrl?: string;

  // Reprint?
  isDuplicate: boolean;
}

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-SN", {
    style: "decimal",
    minimumFractionDigits: 0,
  }).format(amount) + " FCFA";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-SN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getPaymentStatus(
  total: number,
  paid: number
): "PAYE" | "PARTIEL" | "IMPAYE" {
  if (paid >= total) return "PAYE";
  if (paid > 0) return "PARTIEL";
  return "IMPAYE";
}
