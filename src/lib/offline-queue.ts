import { getOfflineTenantScope } from "./offline-cache";

const LEGACY_OFFLINE_QUEUE_KEY = "pressipro:offline-queue";
const LEGACY_CUSTOMER_MAP_KEY = "pressipro:offline-customer-map";
const OFFLINE_QUEUE_PREFIX = "pressipro:offline-queue:t:";
const CUSTOMER_MAP_PREFIX = "pressipro:offline-customer-map:t:";
const OFFLINE_QUEUE_EVENT = "pressipro:offline-queue-updated";
const TEMP_CUSTOMER_PREFIX = "offline-customer";
const MAX_PERMANENT_FAILURE_ATTEMPTS = 5;

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
  tenantId?: string;
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
  permanentFailure?: boolean;
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
    // localStorage quota exceeded or unavailable — silent fail
  }
}

function resolveScopedQueueKey(tenantId: string | null): string | null {
  if (!tenantId) return null;
  return `${OFFLINE_QUEUE_PREFIX}${tenantId}`;
}

function resolveScopedCustomerMapKey(tenantId: string | null): string | null {
  if (!tenantId) return null;
  return `${CUSTOMER_MAP_PREFIX}${tenantId}`;
}

/**
 * Migration transparente et sans perte de la file historique non-scopée
 * vers le premier pressing authentifié sur le poste en production.
 */
function migrateLegacyQueueIfNeeded(tenantId: string) {
  if (!canUseBrowserStorage()) return;

  try {
    const scopedKey = `${OFFLINE_QUEUE_PREFIX}${tenantId}`;
    const legacyRaw = window.localStorage.getItem(LEGACY_OFFLINE_QUEUE_KEY);
    if (legacyRaw && !window.localStorage.getItem(scopedKey)) {
      const legacyItems = JSON.parse(legacyRaw) as OfflineQueueItem[];
      if (Array.isArray(legacyItems) && legacyItems.length > 0) {
        const tagged = legacyItems.map((item) => ({
          ...item,
          tenantId: item.tenantId ?? tenantId,
        }));
        window.localStorage.setItem(scopedKey, JSON.stringify(tagged));
      }
      window.localStorage.removeItem(LEGACY_OFFLINE_QUEUE_KEY);
    }

    const scopedMapKey = `${CUSTOMER_MAP_PREFIX}${tenantId}`;
    const legacyMapRaw = window.localStorage.getItem(LEGACY_CUSTOMER_MAP_KEY);
    if (legacyMapRaw && !window.localStorage.getItem(scopedMapKey)) {
      window.localStorage.setItem(scopedMapKey, legacyMapRaw);
      window.localStorage.removeItem(LEGACY_CUSTOMER_MAP_KEY);
    }
  } catch {
    // Ignore storage migration errors
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

export function notifyOfflineQueueScopeChanged() {
  const tenantId = getOfflineTenantScope();
  if (tenantId) {
    migrateLegacyQueueIfNeeded(tenantId);
  }
  emitQueueChange();
}

function readCustomerMappings(tenantId: string) {
  const key = resolveScopedCustomerMapKey(tenantId);
  if (!key) return {};
  return readJson<Record<string, string>>(key, {});
}

function writeCustomerMappings(tenantId: string, mappings: Record<string, string>) {
  const key = resolveScopedCustomerMapKey(tenantId);
  if (!key) return;
  writeJson(key, mappings);
}

function extractErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Synchronisation échouée";
}

async function findCustomerByPhone(phone: string) {
  const response = await fetch(`/api/customers?q=${encodeURIComponent(phone)}&limit=5`, {
    credentials: "include",
  });
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
  tenantId: string,
  customerMappings: Record<string, string>
): Promise<{
  status: "processed" | "failed" | "blocked" | "unauthorized";
  error?: string;
  isPermanent4xx?: boolean;
}> {
  const body = JSON.parse(JSON.stringify(item.request.body)) as Record<string, unknown>;

  // Injecter l'identifiant d'idempotence client pour éviter les doublons réseau
  if (
    (item.type === "CREATE_ORDER" || item.type === "ADD_PAYMENT") &&
    typeof body.clientRequestId !== "string"
  ) {
    body.clientRequestId = item.id;
  }

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
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": item.id,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { status: "unauthorized", error: "Session expirée, reconnexion requise" };
      }

      if (item.type === "CREATE_CUSTOMER" && response.status === 409) {
        const phone = typeof body.phone === "string" ? body.phone : "";
        if (phone) {
          const existingCustomer = await findCustomerByPhone(phone);
          if (existingCustomer && item.meta?.tempCustomerId) {
            customerMappings[item.meta.tempCustomerId] = existingCustomer.id;
            writeCustomerMappings(tenantId, customerMappings);
            return { status: "processed" };
          }
        }
      }

      const errorPayload = await response.json().catch(() => null);
      const isPermanent4xx =
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429;
      return {
        status: "failed",
        error: extractErrorMessage(errorPayload),
        isPermanent4xx,
      };
    }

    const payload = await response.json().catch(() => null);
    if (item.type === "CREATE_CUSTOMER" && item.meta?.tempCustomerId && payload?.id) {
      customerMappings[item.meta.tempCustomerId] = payload.id as string;
      writeCustomerMappings(tenantId, customerMappings);
    }

    return { status: "processed" };
  } catch {
    return { status: "failed", error: "Connexion indisponible" };
  }
}

export function createOfflineTempId(prefix: "customer" | "queue" = "queue") {
  return `offline-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readOfflineQueue(explicitTenantId?: string | null): OfflineQueueItem[] {
  const tenantId = explicitTenantId ?? getOfflineTenantScope();
  if (!tenantId) {
    return [];
  }

  migrateLegacyQueueIfNeeded(tenantId);
  const key = resolveScopedQueueKey(tenantId);
  if (!key) return [];
  return readJson<OfflineQueueItem[]>(key, []);
}

export function getOfflineQueueCount(explicitTenantId?: string | null) {
  return readOfflineQueue(explicitTenantId).length;
}

export function enqueueOfflineAction(
  item: Omit<OfflineQueueItem, "id" | "createdAt" | "attempts" | "lastError">,
  explicitTenantId?: string | null
) {
  const tenantId = explicitTenantId ?? getOfflineTenantScope();
  const nextItem: OfflineQueueItem = {
    ...item,
    tenantId: tenantId ?? undefined,
    id: createOfflineTempId(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  if (!tenantId) {
    return nextItem;
  }

  const key = resolveScopedQueueKey(tenantId);
  if (!key) return nextItem;

  const queue = readOfflineQueue(tenantId);
  queue.push(nextItem);
  writeJson(key, queue);
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

  const tenantId = getOfflineTenantScope();
  if (!tenantId) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  if (!navigator.onLine) {
    return { processed: 0, failed: 0, remaining: getOfflineQueueCount(tenantId) };
  }

  if (activeFlush) {
    return activeFlush;
  }

  activeFlush = (async () => {
    const queue = readOfflineQueue(tenantId);
    const key = resolveScopedQueueKey(tenantId);
    if (!key || queue.length === 0) {
      return { processed: 0, failed: 0, remaining: 0 };
    }

    const customerMappings = readCustomerMappings(tenantId);
    const nextQueue: OfflineQueueItem[] = [];
    let processed = 0;
    let failed = 0;
    let abortRemaining = false;

    for (const item of queue) {
      if (abortRemaining) {
        nextQueue.push(item);
        continue;
      }

      // Protection anti-boucle infinie sur erreurs 4xx permanentes (validation/droits)
      if (item.permanentFailure && (item.attempts ?? 0) >= MAX_PERMANENT_FAILURE_ATTEMPTS) {
        nextQueue.push(item);
        continue;
      }

      // Défense supplémentaire contre toute fuite inter-tenant
      if (item.tenantId && item.tenantId !== tenantId) {
        continue;
      }

      const result = await replayQueueItem(item, tenantId, customerMappings);

      if (result.status === "processed") {
        processed += 1;
        continue;
      }

      if (result.status === "unauthorized") {
        abortRemaining = true;
        nextQueue.push({
          ...item,
          lastError: result.error,
        });
        continue;
      }

      failed += 1;
      const nextAttempts = (item.attempts ?? 0) + 1;
      nextQueue.push({
        ...item,
        attempts: nextAttempts,
        lastError: result.error,
        permanentFailure: Boolean(
          result.isPermanent4xx && nextAttempts >= MAX_PERMANENT_FAILURE_ATTEMPTS
        ),
      });
    }

    writeJson(key, nextQueue);
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

export function removeOfflineQueueItem(id: string, explicitTenantId?: string | null) {
  const tenantId = explicitTenantId ?? getOfflineTenantScope();
  if (!tenantId) return;
  const key = resolveScopedQueueKey(tenantId);
  if (!key) return;
  const queue = readOfflineQueue(tenantId).filter((item) => item.id !== id);
  writeJson(key, queue);
  emitQueueChange();
}

export function findQueuedActionByTempEntityId(tempEntityId: string) {
  return readOfflineQueue().find((item) => item.meta?.tempEntityId === tempEntityId) ?? null;
}
