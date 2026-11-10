import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPhoneLookupCandidates,
  normalizePhoneForStorage,
  normalizePhoneForWhatsApp,
} from "@/lib/phone";
import { customerSchema } from "@/lib/validators";
import { SUBSCRIPTION_PLANS, getPlanPrice } from "@/lib/subscription-plans";
import {
  PLAN_QUOTA_LIMITS,
  isSaasQuotaEnforced,
} from "@/lib/subscription-limits";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Clients, Téléphones WhatsApp & Grille SaaS / Quotas", () => {
  it("normalise les numéros sénégalais et internationaux sans préfixe 221 dupliqué", () => {
    expect(normalizePhoneForStorage("77 123 45 67")).toBe("+221771234567");
    expect(normalizePhoneForStorage("078 603 79 13")).toBe("+221786037913");
    expect(normalizePhoneForStorage("00221 76 555 44 33")).toBe("+221765554433");

    // Numéros WhatsApp prêts pour wa.me/ (sans + et sans préfixer 221 sur un indicatif étranger)
    expect(normalizePhoneForWhatsApp("+221 78 603 79 13")).toBe("221786037913");
    expect(normalizePhoneForWhatsApp("+33 6 12 34 56 78")).toBe("33612345678");
    expect(normalizePhoneForWhatsApp("abc")).toBeNull();

    const candidates = buildPhoneLookupCandidates("77 123 45 67");
    expect(candidates).toContain("+221771234567");
    expect(candidates).toContain("221771234567");
    expect(candidates).toContain("771234567");
  });

  it("valide et normalise la création de fiche client via customerSchema", () => {
    const parsed = customerSchema.safeParse({
      name: "Fatou Ndiaye",
      phone: "77 888 99 00",
      email: "",
      address: "Mermoz, Dakar",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("+221778889900");
    }

    const invalid = customerSchema.safeParse({
      name: "Client Invalide",
      phone: "123",
    });
    expect(invalid.success).toBe(false);
  });

  it("aligne strictement les tarifs et quotas des 4 offres SaaS sans bloquer la prod par défaut", () => {
    expect(getPlanPrice("FREE", "monthly")).toBe(0);
    expect(getPlanPrice("BASIC", "monthly")).toBe(5000);
    expect(getPlanPrice("BASIC", "yearly")).toBe(50000);
    expect(getPlanPrice("PRO", "monthly")).toBe(10000);
    expect(getPlanPrice("PRO", "yearly")).toBe(100000);
    expect(getPlanPrice("ENTERPRISE", "monthly")).toBe(50000);
    expect(getPlanPrice("ENTERPRISE", "yearly")).toBe(500000);

    expect(Object.keys(SUBSCRIPTION_PLANS)).toEqual([
      "FREE",
      "BASIC",
      "PRO",
      "ENTERPRISE",
    ]);

    expect(PLAN_QUOTA_LIMITS.FREE).toMatchObject({
      maxOrdersTotal: 50,
      maxUsers: 1,
    });
    expect(PLAN_QUOTA_LIMITS.BASIC).toMatchObject({
      maxOrdersPerMonth: 300,
      maxUsers: 3,
    });
    expect(PLAN_QUOTA_LIMITS.PRO.maxOrdersTotal).toBeNull();
    expect(PLAN_QUOTA_LIMITS.PRO.maxOrdersPerMonth).toBeNull();
    expect(PLAN_QUOTA_LIMITS.PRO.maxUsers).toBeNull();

    // Par défaut en production, les quotas remontent des avertissements doux sans bloquer un pressing actif
    vi.stubEnv("ENFORCE_SAAS_QUOTAS", "");
    expect(isSaasQuotaEnforced()).toBe(false);

    vi.stubEnv("ENFORCE_SAAS_QUOTAS", "true");
    expect(isSaasQuotaEnforced()).toBe(true);
  });
});
