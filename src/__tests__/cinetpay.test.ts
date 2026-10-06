import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTransactionId,
  mapCinetPayMethod,
  initiateCinetPayPayment,
  checkCinetPayTransaction,
  getCinetPayConfig,
  registerSimulatedTransaction,
} from "@/lib/cinetpay";

// Mock fetch globally
const globalFetch = vi.fn();
global.fetch = globalFetch as unknown as typeof fetch;

describe("CinetPay Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateTransactionId", () => {
    it("should generate a transaction id with prefix and sanitized code", () => {
      const id = generateTransactionId("P-00123");
      expect(id).toMatch(/^PPO-P00123-\d+$/);
    });

    it("should sanitize special characters in order code", () => {
      const id = generateTransactionId("CMD#99/A");
      expect(id).toMatch(/^PPO-CMD99A-\d+$/);
    });

    it("should generate unique transaction IDs on consecutive calls", () => {
      const id1 = generateTransactionId("P-001");
      const id2 = generateTransactionId("P-001");
      expect(id1).not.toBe(id2);
    });
  });

  describe("mapCinetPayMethod", () => {
    it("should map WAVE to WAVE", () => {
      expect(mapCinetPayMethod("WAVE")).toBe("WAVE");
      expect(mapCinetPayMethod("wave_sn")).toBe("WAVE");
    });

    it("should map Orange Money to OM", () => {
      expect(mapCinetPayMethod("OM")).toBe("OM");
      expect(mapCinetPayMethod("orange_money")).toBe("OM");
      expect(mapCinetPayMethod("ORANGE_SN")).toBe("OM");
    });

    it("should map other methods (Free Money, Card) to OTHER", () => {
      expect(mapCinetPayMethod("FREE_MONEY")).toBe("OTHER");
      expect(mapCinetPayMethod("CARD")).toBe("OTHER");
      expect(mapCinetPayMethod("VISA")).toBe("OTHER");
      expect(mapCinetPayMethod(undefined)).toBe("OTHER");
    });
  });

  describe("getCinetPayConfig", () => {
    it("should fallback to environment variables when tenant has no custom keys", async () => {
      process.env.CINETPAY_API_KEY = "sk_test_mock_key";
      process.env.CINETPAY_SITE_ID = "123456";

      const config = await getCinetPayConfig();
      expect(config.apiKey).toBe("sk_test_mock_key");
      expect(config.siteId).toBe("123456");
      expect(config.isEnabled).toBe(true);
    });
  });

  describe("initiateCinetPayPayment", () => {
    it("should fail gracefully when no API key is present", async () => {
      const origKey = process.env.CINETPAY_API_KEY;
      delete process.env.CINETPAY_API_KEY;

      const result = await initiateCinetPayPayment({
        amount: 5000,
        orderId: "order_123",
        orderCode: "P-001",
        customerName: "Amadou Diallo",
        tenantId: "tenant_non_existent",
        tenantName: "Pressing Test",
        notifyUrl: "https://example.com/notify",
        returnUrl: "https://example.com/return",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Clé API CinetPay manquante");

      process.env.CINETPAY_API_KEY = origKey;
    });

    it("should return paymentUrl and transactionId on success", async () => {
      process.env.CINETPAY_API_KEY = "sk_test_mock_key";
      process.env.CINETPAY_SITE_ID = "123456";

      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: "201",
          message: "CREATED",
          data: {
            payment_url: "https://checkout.cinetpay.com/pay/mock_token",
            payment_token: "mock_token_123",
          },
        }),
      });

      const result = await initiateCinetPayPayment({
        amount: 3500,
        orderId: "order_123",
        orderCode: "P-00145",
        customerName: "Fatou Sow",
        customerPhone: "771234567",
        tenantId: "tenant_abc",
        tenantName: "Pressing Dakar",
        notifyUrl: "https://pressipro.tech/api/webhooks/cinetpay",
        returnUrl: "https://pressipro.tech/share/receipt/xyz",
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe("https://checkout.cinetpay.com/pay/mock_token");
      expect(result.paymentToken).toBe("mock_token_123");
      expect(result.transactionId).toContain("P00145");
    });

    it("should route to simulation gateway when CINETPAY_SIMULATE is true", async () => {
      process.env.CINETPAY_API_KEY = "sk_test_mock_key";
      process.env.CINETPAY_SIMULATE = "true";

      const result = await initiateCinetPayPayment({
        amount: 15000,
        orderId: "sub_123",
        orderCode: "SUB-PRO",
        customerName: "Aliou Ndiaye",
        tenantId: "tenant_sim",
        tenantName: "Pressing Étoile",
        notifyUrl: "https://pressipro.tech/api/webhooks/cinetpay",
        returnUrl: "https://pressipro.tech/subscription?payment=return",
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.paymentUrl).toContain("/checkout/simulate");
      expect(result.paymentUrl).toContain("15000");

      delete process.env.CINETPAY_SIMULATE;
    });
  });

  describe("checkCinetPayTransaction", () => {
    it("should verify payment status with CinetPay API", async () => {
      process.env.CINETPAY_API_KEY = "sk_test_mock_key";
      process.env.CINETPAY_SITE_ID = "123456";

      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: "00",
          message: "SUCCES",
          data: {
            status: "ACCEPTED",
            amount: 3500,
            currency: "XOF",
            payment_method: "WAVE",
            operator_id: "WAVE_TX_987",
            payment_date: "2026-10-05 18:30:00",
          },
        }),
      });

      const check = await checkCinetPayTransaction("PPO-P00145-123456");
      expect(check.success).toBe(true);
      expect(check.status).toBe("ACCEPTED");
      expect(check.amount).toBe(3500);
      expect(check.paymentMethod).toBe("WAVE");
    });

    it("should return simulated transaction status immediately if registered", async () => {
      registerSimulatedTransaction({
        transactionId: "SUB-SIMULATED-TEST-99",
        amount: 15000,
        status: "ACCEPTED",
        paymentMethod: "OM",
        date: new Date().toISOString(),
      });

      const check = await checkCinetPayTransaction("SUB-SIMULATED-TEST-99");
      expect(check.success).toBe(true);
      expect(check.status).toBe("ACCEPTED");
      expect(check.amount).toBe(15000);
      expect(check.paymentMethod).toBe("OM");
    });
  });
});
