import type { PricingType } from "@prisma/client";

interface ServiceInput {
  id: string;
  name: string;
  price: number;
  pricingType: PricingType;
}

interface OrderItemInput {
  serviceId: string;
  quantity?: number;
  weight?: number;
}

export interface ComputedOrderItem {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  weight: number | null;
  pricingType: PricingType;
  total: number;
}

export interface ComputeOrderItemsResult {
  items: ComputedOrderItem[];
  itemsTotal: number;
}

/**
 * Compute order items with their totals from raw input + service definitions.
 * Shared between order creation (POST) and order editing (PUT).
 */
export function computeOrderItems(
  inputItems: OrderItemInput[],
  serviceMap: Map<string, ServiceInput>
): ComputeOrderItemsResult {
  let itemsTotal = 0;

  const items = inputItems.map((item) => {
    const svc = serviceMap.get(item.serviceId);
    if (!svc) {
      throw new Error("VALIDATION:Service introuvable ou inactif");
    }

    const isPerKg = svc.pricingType === "PER_KG";

    if (isPerKg) {
      const rawWeight = item.weight ?? item.quantity;
      if (rawWeight === undefined || !Number.isFinite(rawWeight) || rawWeight <= 0) {
        throw new Error(`VALIDATION:Le poids (en kg) est requis pour « ${svc.name} »`);
      }
      const weight = Math.round(rawWeight * 100) / 100;
      const total = Math.round(svc.price * weight);
      itemsTotal += total;
      return {
        serviceId: svc.id,
        name: svc.name,
        quantity: 1,
        unitPrice: svc.price,
        weight,
        pricingType: svc.pricingType,
        total,
      };
    }

    const quantity = item.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`VALIDATION:Quantité invalide pour « ${svc.name} »`);
    }
    const total = svc.price * quantity;
    itemsTotal += total;

    return {
      serviceId: svc.id,
      name: svc.name,
      quantity,
      unitPrice: svc.price,
      weight: null,
      pricingType: svc.pricingType,
      total,
    };
  });

  return { items, itemsTotal };
}

/**
 * Compute the final total after applying discount (capped at itemsTotal, never negative).
 */
export function computeFinalTotal(
  itemsTotal: number,
  discountAmount: number
): { totalAmount: number; cappedDiscount: number } {
  const safeDiscount = Math.max(0, Math.round(discountAmount));
  const cappedDiscount = Math.min(safeDiscount, Math.max(0, itemsTotal));
  return {
    totalAmount: Math.max(0, itemsTotal - cappedDiscount),
    cappedDiscount,
  };
}
