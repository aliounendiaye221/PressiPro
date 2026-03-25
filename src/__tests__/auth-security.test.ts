import { describe, it, expect, beforeEach } from "vitest";
import { registerSchema, createUserSchema } from "@/lib/validators";
import { checkRateLimit, clearRateLimitBuckets } from "@/lib/rate-limit";

describe("password policy", () => {
  it("rejects weak password at register", () => {
    const result = registerSchema.safeParse({
      tenantName: "Pressing Test",
      tenantPhone: "+221770001111",
      tenantAddress: "Dakar",
      name: "Admin Test",
      email: "admin@test.sn",
      password: "azerty123",
    });

    expect(result.success).toBe(false);
  });

  it("accepts strong password at register", () => {
    const result = registerSchema.safeParse({
      tenantName: "Pressing Test",
      tenantPhone: "+221770001111",
      tenantAddress: "Dakar",
      name: "Admin Test",
      email: "admin@test.sn",
      password: "Secure#2026Pass",
    });

    expect(result.success).toBe(true);
  });

  it("enforces same strong policy for create user", () => {
    const weak = createUserSchema.safeParse({
      email: "agent@test.sn",
      password: "123456",
      name: "Agent Test",
      role: "AGENT",
    });

    const strong = createUserSchema.safeParse({
      email: "agent@test.sn",
      password: "Agent#Secure2026",
      name: "Agent Test",
      role: "AGENT",
    });

    expect(weak.success).toBe(false);
    expect(strong.success).toBe(true);
  });
});

describe("rate limit helper", () => {
  beforeEach(() => {
    clearRateLimitBuckets();
  });

  it("allows requests within the window limit", () => {
    const now = 1000;

    const first = checkRateLimit("login:ip:1.1.1.1", 2, 60_000, now);
    const second = checkRateLimit("login:ip:1.1.1.1", 2, 60_000, now + 1000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("blocks requests after the limit and provides retryAfter", () => {
    const now = 1000;

    checkRateLimit("login:ip:1.1.1.1", 2, 60_000, now);
    checkRateLimit("login:ip:1.1.1.1", 2, 60_000, now + 1000);
    const blocked = checkRateLimit("login:ip:1.1.1.1", 2, 60_000, now + 2000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after window expiration", () => {
    const now = 1000;

    checkRateLimit("login:email:test@test.sn", 1, 10_000, now);
    const afterWindow = checkRateLimit("login:email:test@test.sn", 1, 10_000, now + 10_001);

    expect(afterWindow.allowed).toBe(true);
  });
});
