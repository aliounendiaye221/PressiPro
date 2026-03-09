const CACHE_PREFIX = "pressipro:cache:";

interface CacheEnvelope<T> {
  data: T;
  updatedAt: string;
}

function getStorageKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

export function readOfflineCache<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
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
    const payload: CacheEnvelope<T> = {
      data,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(getStorageKey(key), JSON.stringify(payload));
  } catch {
  }
}

export function removeOfflineCache(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getStorageKey(key));
  } catch {
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