const CACHE_PREFIX = "pressipro:cache:";
const ACTIVE_TENANT_SCOPE_KEY = "pressipro:active-tenant-id";
const GLOBAL_CACHE_KEYS = new Set(["auth:me"]);

interface CacheEnvelope<T> {
  data: T;
  updatedAt: string;
}

export function getOfflineTenantScope(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const scope = window.localStorage.getItem(ACTIVE_TENANT_SCOPE_KEY)?.trim();
    if (scope) return scope;

    // Repli rétrocompatible si une session existante est déjà présente dans auth:me
    const rawAuth = window.localStorage.getItem(`${CACHE_PREFIX}auth:me`);
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth) as {
        data?: { tenant?: { id?: string | null } | null };
      };
      const fallbackTenantId = parsed?.data?.tenant?.id?.trim();
      if (fallbackTenantId) {
        window.localStorage.setItem(ACTIVE_TENANT_SCOPE_KEY, fallbackTenantId);
        return fallbackTenantId;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function setOfflineTenantScope(tenantId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const normalized = tenantId?.trim() || null;
    const previous = window.localStorage.getItem(ACTIVE_TENANT_SCOPE_KEY)?.trim() || null;

    if (!normalized) {
      window.localStorage.removeItem(ACTIVE_TENANT_SCOPE_KEY);
      return;
    }

    // Si l'utilisateur change de pressing sur le même navigateur, nettoyer les anciennes clés non scopées
    if (previous && previous !== normalized) {
      purgeLegacyUnscopedCacheKeys();
    }

    window.localStorage.setItem(ACTIVE_TENANT_SCOPE_KEY, normalized);
  } catch {
    // localStorage indisponible — échec silencieux
  }
}

function purgeLegacyUnscopedCacheKeys() {
  if (typeof window === "undefined") return;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(CACHE_PREFIX)) continue;
      const suffix = k.slice(CACHE_PREFIX.length);
      if (GLOBAL_CACHE_KEYS.has(suffix)) continue;
      if (!suffix.startsWith("t:")) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage errors
  }
}

function getStorageKey(key: string): string | null {
  if (GLOBAL_CACHE_KEYS.has(key)) {
    return `${CACHE_PREFIX}${key}`;
  }
  const tenantId = getOfflineTenantScope();
  if (!tenantId) {
    return null;
  }
  return `${CACHE_PREFIX}t:${tenantId}:${key}`;
}

export function readOfflineCache<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storageKey = getStorageKey(key);
    if (!storageKey) {
      return null;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function writeOfflineCache<T>(key: string, data: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = getStorageKey(key);
    if (!storageKey) {
      return;
    }

    const payload: CacheEnvelope<T> = {
      data,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // localStorage quota exceeded or unavailable (private browsing) — silent fail
  }
}

export function removeOfflineCache(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = getStorageKey(key);
    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // localStorage unavailable — silent fail
  }
}

/**
 * Purge l'ensemble des caches applicatifs du navigateur et du Service Worker
 * lors d'une déconnexion ou d'une sortie d'impersonation Super-Admin.
 */
export function clearAllOfflineCaches() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      window.localStorage.removeItem(k);
    }
    window.localStorage.removeItem(ACTIVE_TENANT_SCOPE_KEY);
  } catch {
    // Ignore storage errors
  }

  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_USER_CACHE" });
    }
  } catch {
    // Ignore SW messaging errors
  }
}

export function formatOfflineCacheTime(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    return new Date(value).toLocaleString("fr-SN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
