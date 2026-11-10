import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const TEST_SECRET = "test-jwt-secret-key-at-least-32-chars-pressipro";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret-key-at-least-32-chars-pressipro";
});

import { createToken, verifyToken } from "@/lib/auth-shared";
import {
  createReceiptShareToken,
  verifyReceiptShareToken,
} from "@/lib/receipt-share";
import {
  generateTransactionId,
  verifyOrderTransactionBinding,
} from "@/lib/cinetpay";
import {
  clearAllOfflineCaches,
  readOfflineCache,
  setOfflineTenantScope,
  writeOfflineCache,
} from "@/lib/offline-cache";
import {
  enqueueOfflineAction,
  getOfflineQueueCount,
  notifyOfflineQueueScopeChanged,
  readOfflineQueue,
} from "@/lib/offline-queue";

function createMemoryWindow() {
  const store = new Map<string, string>();
  const target = new EventTarget();

  const localStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };

  return {
    localStorage,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
}

describe("Isolation Multi-Tenant — JWT, transactions CinetPay/Wave et stockage hors-ligne", () => {
  describe("Séparation cryptographique Session vs Reçu public & rétrocompatibilité prod", () => {
    it("empêche toute confusion entre un JWT de session et un JWT de reçu partagé", async () => {
      const sessionToken = await createToken({
        userId: "u-alpha",
        tenantId: "tenant-alpha",
        role: "ADMIN",
        email: "alpha@pressing.sn",
        name: "Pressing Alpha",
      });

      const receiptToken = await createReceiptShareToken({
        orderId: "ord-alpha-99",
        tenantId: "tenant-alpha",
        duplicate: true,
      });

      expect(await verifyToken(sessionToken)).toMatchObject({
        userId: "u-alpha",
        tenantId: "tenant-alpha",
        role: "ADMIN",
      });
      expect(await verifyReceiptShareToken(sessionToken)).toBeNull();

      expect(await verifyReceiptShareToken(receiptToken)).toEqual({
        orderId: "ord-alpha-99",
        tenantId: "tenant-alpha",
        duplicate: true,
      });
      expect(await verifyToken(receiptToken)).toBeNull();
    });

    it("préserve les sessions et liens WhatsApp déjà en production (sans claim typ)", async () => {
      const encodedSecret = new TextEncoder().encode(TEST_SECRET);

      const legacyLiveSessionToken = await new SignJWT({
        userId: "u-live",
        tenantId: "tenant-live",
        role: "AGENT",
        email: "agent@live.sn",
        name: "Agent En Prod",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(encodedSecret);

      const legacyWhatsAppReceiptToken = await new SignJWT({
        orderId: "ord-live-42",
        tenantId: "tenant-live",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(encodedSecret);

      expect(await verifyToken(legacyLiveSessionToken)).toMatchObject({
        userId: "u-live",
        tenantId: "tenant-live",
        role: "AGENT",
      });
      expect(await verifyReceiptShareToken(legacyLiveSessionToken)).toBeNull();

      expect(await verifyReceiptShareToken(legacyWhatsAppReceiptToken)).toEqual({
        orderId: "ord-live-42",
        tenantId: "tenant-live",
        duplicate: false,
      });
      expect(await verifyToken(legacyWhatsAppReceiptToken)).toBeNull();
    });
  });

  describe("Anti-rejeu inter-commandes et anti-collision multi-tenant sur P-00001", () => {
    it("lie chaque transaction PPO-* au couple (tenantId, orderId) via tag HMAC numérique", () => {
      const txAlpha = generateTransactionId("P-00001", {
        tenantId: "tenant-alpha",
        orderId: "order-alpha-1",
      });

      expect(txAlpha).toMatch(/^PPO-P00001-\d{13}$/);
      expect(txAlpha.length).toBeLessThanOrEqual(26);

      // Valide uniquement pour la commande exacte du pressing Alpha
      expect(
        verifyOrderTransactionBinding(txAlpha, {
          id: "order-alpha-1",
          tenantId: "tenant-alpha",
          code: "P-00001",
        })
      ).toBe(true);

      // Rejeté si rejoué sur une autre commande du même pressing
      expect(
        verifyOrderTransactionBinding(txAlpha, {
          id: "order-alpha-2",
          tenantId: "tenant-alpha",
          code: "P-00002",
        })
      ).toBe(false);

      // Rejeté si un autre pressing Beta possède aussi le code P-00001 !
      expect(
        verifyOrderTransactionBinding(txAlpha, {
          id: "order-beta-1",
          tenantId: "tenant-beta",
          code: "P-00001",
        })
      ).toBe(false);

      // Compatibilité transitoire stricte pour les transactions legacy à 10 chiffres en vol
      const legacyInFlightTx = "PPO-P00001-1234567890";
      expect(
        verifyOrderTransactionBinding(legacyInFlightTx, {
          id: "order-alpha-1",
          tenantId: "tenant-alpha",
          code: "P-00001",
        })
      ).toBe(false);
      expect(
        verifyOrderTransactionBinding(
          legacyInFlightTx,
          { id: "order-alpha-1", tenantId: "tenant-alpha", code: "P-00001" },
          { allowLegacyUnbound: true }
        )
      ).toBe(true);
      expect(
        verifyOrderTransactionBinding(
          legacyInFlightTx,
          { id: "order-alpha-2", tenantId: "tenant-alpha", code: "P-00002" },
          { allowLegacyUnbound: true }
        )
      ).toBe(false);
    });
  });

  describe("Isolation par pressing du cache et de la file hors-ligne (PWA)", () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
      Object.defineProperty(globalThis, "window", {
        value: createMemoryWindow(),
        configurable: true,
        writable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
        writable: true,
      });
    });

    it("isole strictement les données en cache et la file d'attente entre deux pressings", () => {
      setOfflineTenantScope("tenant-dakar");
      writeOfflineCache("orders:list", [{ id: "ord-dkr-1", code: "P-00001" }]);
      enqueueOfflineAction({
        type: "CREATE_CUSTOMER",
        request: {
          url: "/api/customers",
          method: "POST",
          body: { name: "Client Dakar", phone: "+221771112233" },
        },
      });

      expect(readOfflineCache<Array<{ id: string }>>("orders:list")?.data).toHaveLength(1);
      expect(getOfflineQueueCount()).toBe(1);

      // Bascule sur un second pressing sur le même navigateur
      setOfflineTenantScope("tenant-thies");
      expect(readOfflineCache("orders:list")).toBeNull();
      expect(getOfflineQueueCount()).toBe(0);

      writeOfflineCache("orders:list", [{ id: "ord-ths-1", code: "P-00099" }]);
      expect(readOfflineCache<Array<{ id: string }>>("orders:list")?.data[0].id).toBe(
        "ord-ths-1"
      );

      // Retour sur le premier pressing : ses données hors-ligne sont intactes
      setOfflineTenantScope("tenant-dakar");
      expect(readOfflineCache<Array<{ id: string }>>("orders:list")?.data[0].id).toBe(
        "ord-dkr-1"
      );
      expect(readOfflineQueue()).toHaveLength(1);

      // Déconnexion : purge complète des caches applicatifs
      clearAllOfflineCaches();
      expect(readOfflineCache("orders:list")).toBeNull();
    });

    it("migre sans perte une file historique pressipro:offline-queue déjà en production", () => {
      window.localStorage.setItem(
        "pressipro:offline-queue",
        JSON.stringify([
          {
            id: "offline-queue-legacy-1",
            type: "ADD_PAYMENT",
            createdAt: "2026-11-08T08:00:00.000Z",
            request: {
              url: "/api/orders/ord-1/payments",
              method: "POST",
              body: { amount: 3500, method: "CASH" },
            },
          },
        ])
      );

      setOfflineTenantScope("tenant-prod-1");
      notifyOfflineQueueScopeChanged();

      expect(window.localStorage.getItem("pressipro:offline-queue")).toBeNull();
      const migrated = readOfflineQueue();
      expect(migrated).toHaveLength(1);
      expect(migrated[0].id).toBe("offline-queue-legacy-1");
      expect(migrated[0].tenantId).toBe("tenant-prod-1");

      // Un autre pressing ne voit jamais cette file migrée
      setOfflineTenantScope("tenant-prod-2");
      expect(readOfflineQueue()).toHaveLength(0);
    });
  });
});
