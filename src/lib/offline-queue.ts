const OFFLINE_QUEUE_KEY = "pressipro:offline-queue";
const OFFLINE_QUEUE_EVENT = "pressipro:offline-queue-updated";
const TEMP_CUSTOMER_PREFIX = "offline-customer";

export type OfflineQueueActionType =
  | "CREATE_CUSTOMER"
  | "CREATE_ORDER"
  | "ADD_PAYMENT"
  | "UPDATE_ORDER_STATUS"
  | "UPDATE_ORDER_FIELDS"
  | "DELETE_PAYMENT"
  | "DELETE_ORDER"
  | "UPDATE_TENANT";

export interface OfflineQueueItem {
  id: string;
  type: OfflineQueueActionType;
  createdAt: string;
  request: {
    url: string;
    method: "POST" | "PUT" | "DELETE";
    body: Record<string, unknown>;
  };
  meta?: {
    tempCustomerId?: string;
    tempEntityId?: string;
  };
  attempts?: number;
  lastError?: string;
}

interface FlushResult {
  processed: number;
  failed: number;
  remaining: number;
}

let activeFlush: Promise<FlushResult> | null = null;

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseBrowserStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

function emitQueueChange() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(OFFLINE_QUEUE_EVENT, {
      detail: { count: getOfflineQueueCount() },
    })
  );
}

function readCustomerMappings() {
  return readJson<Record<string, string>>("pressipro:offline-customer-map", {});
}

function writeCustomerMappings(mappings: Record<string, string>) {
  writeJson("pressipro:offline-customer-map", mappings);
}

function extractErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Synchronisation echouee";
}

async function findCustomerByPhone(phone: string) {
  const response = await fetch(`/api/customers?q=${encodeURIComponent(phone)}&limit=5`);
  if (!response.ok) {
    return null;
  }

  const customers = (await response.json()) as {
    customers?: Array<{ id: string; phone: string }>;
  };

  return customers.customers?.find((customer) => customer.phone === phone) ?? null;
}

async function replayQueueItem(
  item: OfflineQueueItem,
  customerMappings: Record<string, string>
): Promise<{ status: "processed" | "failed" | "blocked"; error?: string }> {
  const body = JSON.parse(JSON.stringify(item.request.body)) as Record<string, unknown>;

  if (item.type === "CREATE_ORDER") {
    const customerId = body.customerId;
    if (typeof customerId === "string" && customerId.startsWith(TEMP_CUSTOMER_PREFIX)) {
      const mappedCustomerId = customerMappings[customerId];
      if (!mappedCustomerId) {
        return { status: "blocked", error: "Client local en attente de synchronisation" };
      }
      body.customerId = mappedCustomerId;
    }
  }

  try {
    const response = await fetch(item.request.url, {
      method: item.request.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (item.type === "CREATE_CUSTOMER" && response.status === 409) {
        const phone = typeof body.phone === "string" ? body.phone : "";
        if (phone) {
          const existingCustomer = await findCustomerByPhone(phone);
          if (existingCustomer && item.meta?.tempCustomerId) {
            customerMappings[item.meta.tempCustomerId] = existingCustomer.id;
            writeCustomerMappings(customerMappings);
            return { status: "processed" };
          }
        }
      }

      const errorPayload = await response.json().catch(() => null);
      return { status: "failed", error: extractErrorMessage(errorPayload) };
    }

    const payload = await response.json().catch(() => null);
    if (item.type === "CREATE_CUSTOMER" && item.meta?.tempCustomerId && payload?.id) {
      customerMappings[item.meta.tempCustomerId] = payload.id as string;
      writeCustomerMappings(customerMappings);
    }

    return { status: "processed" };
  } catch {
    return { status: "failed", error: "Connexion indisponible" };
  }
}

export function createOfflineTempId(prefix: "customer" | "queue" = "queue") {
  return `offline-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readOfflineQueue() {
  return readJson<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, []);
}

export function getOfflineQueueCount() {
  return readOfflineQueue().length;
}

export function enqueueOfflineAction(
  item: Omit<OfflineQueueItem, "id" | "createdAt" | "attempts" | "lastError">
) {
  const nextItem: OfflineQueueItem = {
    ...item,
    id: createOfflineTempId(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  const queue = readOfflineQueue();
  queue.push(nextItem);
  writeJson(OFFLINE_QUEUE_KEY, queue);
  emitQueueChange();
  return nextItem;
}

export function subscribeOfflineQueue(listener: () => void) {
  if (!canUseBrowserStorage()) {
    return () => undefined;
  }

  const handler = () => listener();
  window.addEventListener(OFFLINE_QUEUE_EVENT, handler);
  return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, handler);
}

export async function flushOfflineQueue(): Promise<FlushResult> {
  if (!canUseBrowserStorage()) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  if (!navigator.onLine) {
    return { processed: 0, failed: 0, remaining: getOfflineQueueCount() };
  }

  if (activeFlush) {
    return activeFlush;
  }

  activeFlush = (async () => {
    const queue = readOfflineQueue();
    const customerMappings = readCustomerMappings();
    const nextQueue: OfflineQueueItem[] = [];
    let processed = 0;
    let failed = 0;

    for (const item of queue) {
      const result = await replayQueueItem(item, customerMappings);

      if (result.status === "processed") {
        processed += 1;
        continue;
      }

      failed += 1;
      nextQueue.push({
        ...item,
        attempts: (item.attempts ?? 0) + 1,
        lastError: result.error,
      });
    }

    writeJson(OFFLINE_QUEUE_KEY, nextQueue);
    emitQueueChange();
    return {
      processed,
      failed,
      remaining: nextQueue.length,
    };
  })();

  try {
    return await activeFlush;
  } finally {
    activeFlush = null;
  }
}

export function removeOfflineQueueItem(id: string) {
  const queue = readOfflineQueue().filter((item) => item.id !== id);
  writeJson(OFFLINE_QUEUE_KEY, queue);
  emitQueueChange();
}

export function findQueuedActionByTempEntityId(tempEntityId: string) {
  return readOfflineQueue().find((item) => item.meta?.tempEntityId === tempEntityId) ?? null;
}