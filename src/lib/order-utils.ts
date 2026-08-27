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
    const svc = serviceMap.get(item.serviceId)!;
    const isPerKg = svc.pricingType === "PER_KG";
    const quantity = isPerKg ? 1 : (item.quantity ?? 1);
    const weight = isPerKg ? (item.weight ?? 1) : null;
    const total = isPerKg
      ? Math.round(svc.price * (weight ?? 1))
      : svc.price * quantity;
    itemsTotal += total;

    return {
      serviceId: svc.id,
      name: svc.name,
      quantity,
      unitPrice: svc.price,
      weight,
      pricingType: svc.pricingType,
      total,
    };
  });

  return { items, itemsTotal };
}

/**
 * Compute the final total after applying discount (capped at itemsTotal).
 */
export function computeFinalTotal(
  itemsTotal: number,
  discountAmount: number
): { totalAmount: number; cappedDiscount: number } {
  const cappedDiscount = Math.min(discountAmount, itemsTotal);
  return {
    totalAmount: itemsTotal - cappedDiscount,
    cappedDiscount,
  };
}
