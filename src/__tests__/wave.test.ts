import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import {
  createWaveCheckoutSession,
  getWaveCheckoutSession,
  verifyWaveWebhookSignature,
  WaveApiError,
} from "@/lib/wave";
import { subscriptionDaysFor } from "@/lib/subscription-billing";

const globalFetch = vi.fn();
global.fetch = globalFetch as unknown as typeof fetch;

describe("Wave Checkout Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAVE_API_KEY = "wave_sn_prod_mock_key_123";
  });

  describe("createWaveCheckoutSession", () => {
    it("should throw if amount is invalid", async () => {
      await expect(
        createWaveCheckoutSession({
          amount: 0,
          clientReference: "SUB-001",
          successUrl: "https://pressipro.tech/success",
          errorUrl: "https://pressipro.tech/error",
        })
      ).rejects.toThrow("Montant invalide");
    });

    it("should reject non-HTTPS URLs as required by Wave", async () => {
      await expect(
        createWaveCheckoutSession({
          amount: 15000,
          clientReference: "SUB-001",
          successUrl: "http://example.com/success",
          errorUrl: "https://example.com/error",
        })
      ).rejects.toThrow("Wave exige des URLs de retour en HTTPS");
    });

    it("should create a checkout session and return wave_launch_url", async () => {
      globalFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "cos-mock-123456",
            amount: "15000",
            checkout_status: "open",
            client_reference: "SUB-001",
            currency: "XOF",
            error_url: "https://pressipro.tech/error",
            success_url: "https://pressipro.tech/success",
            last_payment_error: null,
            business_name: "PressiPro",
            payment_status: "processing",
            wave_launch_url: "https://pay.wave.com/c/cos-mock-123456",
            when_created: "2026-10-06T12:00:00Z",
            when_expires: "2026-10-06T12:30:00Z",
          }),
      });

      const session = await createWaveCheckoutSession({
        amount: 15000,
        clientReference: "SUB-001",
        successUrl: "https://pressipro.tech/success",
        errorUrl: "https://pressipro.tech/error",
        restrictPayerMobile: "+221770000000",
      });

      expect(session.id).toBe("cos-mock-123456");
      expect(session.wave_launch_url).toBe("https://pay.wave.com/c/cos-mock-123456");
      expect(session.payment_status).toBe("processing");
      expect(globalFetch).toHaveBeenCalledTimes(1);

      const [url, init] = globalFetch.mock.calls[0];
      expect(url).toBe("https://api.wave.com/v1/checkout/sessions");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer wave_sn_prod_mock_key_123");
      const parsed = JSON.parse(init.body);
      expect(parsed.amount).toBe("15000");
      expect(parsed.currency).toBe("XOF");
      expect(parsed.restrict_payer_mobile).toBe("+221770000000");
    });

    it("should throw WaveApiError with server message if Wave returns an error", async () => {
      globalFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            code: "no-matching-api-key",
            message: "The key you provided doesn't exist in our system.",
          }),
      });

      await expect(
        createWaveCheckoutSession({
          amount: 20000,
          clientReference: "SUB-002",
          successUrl: "https://pressipro.tech/success",
          errorUrl: "https://pressipro.tech/error",
        })
      ).rejects.toThrow("The key you provided doesn't exist in our system.");
    });
  });

  describe("verifyWaveWebhookSignature", () => {
    const secret = "wave_sn_WHS_test_secret_abc123";
    const body = JSON.stringify({
      id: "AE_123",
      type: "checkout.session.completed",
      data: { id: "cos-123", amount: "1000", payment_status: "succeeded" },
    });

    it("should return true for a valid HMAC-SHA256 signature", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = `${timestamp}${body}`;
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const header = `t=${timestamp},v1=${sig}`;

      expect(verifyWaveWebhookSignature(header, body, secret)).toBe(true);
    });

    it("should reject tampered body", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = `${timestamp}${body}`;
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const header = `t=${timestamp},v1=${sig}`;

      expect(verifyWaveWebhookSignature(header, body + " ", secret)).toBe(false);
    });

    it("should reject expired timestamp (older than tolerance)", () => {
      const timestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const payload = `${timestamp}${body}`;
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const header = `t=${timestamp},v1=${sig}`;

      expect(verifyWaveWebhookSignature(header, body, secret, { toleranceSeconds: 300 })).toBe(false);
    });

    it("should reject missing or empty signature header", () => {
      expect(verifyWaveWebhookSignature(null, body, secret)).toBe(false);
      expect(verifyWaveWebhookSignature("", body, secret)).toBe(false);
    });
  });

  describe("subscriptionDaysFor", () => {
    it("should return 365 for yearly pricing", () => {
      expect(subscriptionDaysFor("BASIC", 50000)).toBe(365);
      expect(subscriptionDaysFor("PRO", 100000)).toBe(365);
    });

    it("should return 30 for monthly pricing", () => {
      expect(subscriptionDaysFor("BASIC", 5000)).toBe(30);
      expect(subscriptionDaysFor("PRO", 10000)).toBe(30);
    });
  });
});
