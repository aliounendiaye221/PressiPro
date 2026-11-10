import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret-key-at-least-32-chars-pressipro";
});

import { middleware } from "@/middleware";
import { COOKIE_NAME, createToken } from "@/lib/auth-shared";
import { createReceiptShareToken } from "@/lib/receipt-share";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Middleware — CSRF, routes publiques, simulation et isolation des tokens", () => {
  it("bloque les mutations API cross-origin (Origin, Referer ou Sec-Fetch-Site)", async () => {
    const evilOriginReq = new NextRequest("https://pressipro.vercel.app/api/orders", {
      method: "POST",
      headers: {
        origin: "https://evil-attacker.example",
        "content-type": "application/json",
      },
    });
    const resOrigin = await middleware(evilOriginReq);
    expect(resOrigin.status).toBe(403);

    const logoutCsrfReq = new NextRequest("https://pressipro.vercel.app/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://evil-attacker.example",
      },
    });
    const resLogout = await middleware(logoutCsrfReq);
    expect(resLogout.status).toBe(403);

    const crossSiteFetchReq = new NextRequest("https://pressipro.vercel.app/api/orders", {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
      },
    });
    const resSecFetch = await middleware(crossSiteFetchReq);
    expect(resSecFetch.status).toBe(403);

    const evilRefererReq = new NextRequest("https://pressipro.vercel.app/api/tenant", {
      method: "PUT",
      headers: {
        referer: "https://phishing.example/fake-form",
      },
    });
    const resReferer = await middleware(evilRefererReq);
    expect(resReferer.status).toBe(403);
  });

  it("autorise les origines légitimes (même domaine, Capacitor natif et webhooks entrants)", async () => {
    const validSessionJwt = await createToken({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "ADMIN",
      email: "patron@pressing.sn",
      name: "Patron Pressing",
    });

    const sameOriginReq = new NextRequest("https://pressipro.vercel.app/api/orders", {
      method: "POST",
      headers: {
        origin: "https://pressipro.vercel.app",
        cookie: `${COOKIE_NAME}=${validSessionJwt}`,
      },
    });
    const resSameOrigin = await middleware(sameOriginReq);
    expect(resSameOrigin.status).toBe(200);
    expect(resSameOrigin.headers.get("x-middleware-next")).toBe("1");

    const capacitorReq = new NextRequest("https://pressipro.vercel.app/api/orders", {
      method: "POST",
      headers: {
        origin: "capacitor://localhost",
        cookie: `${COOKIE_NAME}=${validSessionJwt}`,
      },
    });
    const resCapacitor = await middleware(capacitorReq);
    expect(resCapacitor.status).toBe(200);
    expect(resCapacitor.headers.get("x-middleware-next")).toBe("1");

    const webhookReq = new NextRequest("https://pressipro.vercel.app/api/webhooks/wave", {
      method: "POST",
      headers: {
        origin: "https://api.wave.com",
      },
    });
    const resWebhook = await middleware(webhookReq);
    expect(resWebhook.status).toBe(200);
    expect(resWebhook.headers.get("x-middleware-next")).toBe("1");
  });

  it("verrouille /api/cinetpay/simulate et /checkout/simulate en production par défaut", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CINETPAY_SIMULATE", "");

    const apiSimReq = new NextRequest("https://pressipro.vercel.app/api/cinetpay/simulate", {
      method: "POST",
      headers: { origin: "https://pressipro.vercel.app" },
    });
    const apiSimRes = await middleware(apiSimReq);
    expect(apiSimRes.status).toBe(404);

    const pageSimReq = new NextRequest("https://pressipro.vercel.app/checkout/simulate?tx=PPO-1");
    const pageSimRes = await middleware(pageSimReq);
    expect(pageSimRes.status).toBe(307);
    expect(pageSimRes.headers.get("location")).toContain("/dashboard");
  });

  it("autorise les pages publiques légales/hors-ligne mais empêche le bypass d'extensions sur /api/*", async () => {
    for (const publicPath of ["/privacy", "/terms", "/offline", "/favicon.svg", "/manifest.json"]) {
      const req = new NextRequest(`https://pressipro.vercel.app${publicPath}`);
      const res = await middleware(req);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }

    const fakeStaticApiReq = new NextRequest("https://pressipro.vercel.app/api/orders.png");
    const fakeStaticApiRes = await middleware(fakeStaticApiReq);
    expect(fakeStaticApiRes.status).toBe(401);

    const postManifestReq = new NextRequest("https://pressipro.vercel.app/manifest", {
      method: "POST",
    });
    const postManifestRes = await middleware(postManifestReq);
    expect(postManifestRes.status).toBe(307);
    expect(postManifestRes.headers.get("location")).toContain("/login");
  });

  it("rejette un token de reçu WhatsApp injecté comme cookie de session utilisateur", async () => {
    const receiptToken = await createReceiptShareToken({
      orderId: "order-123",
      tenantId: "tenant-1",
    });

    const forgedSessionReq = new NextRequest("https://pressipro.vercel.app/api/orders", {
      headers: {
        cookie: `${COOKIE_NAME}=${receiptToken}`,
      },
    });
    const res = await middleware(forgedSessionReq);
    expect(res.status).toBe(401);
  });
});
