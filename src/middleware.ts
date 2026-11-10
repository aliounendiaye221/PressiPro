import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth-shared";

const BASE_PUBLIC_PATHS = [
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/offline",
  "/p",
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
  "/share/receipt",
  "/api/public/receipt",
  "/api/public/pressing",
  "/api/webhooks",
];

const SIMULATE_PATHS = ["/checkout/simulate", "/api/cinetpay/simulate"];

const ALLOWED_CAPACITOR_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isSimulationAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.CINETPAY_SIMULATE === "true"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Block simulation endpoints in production unless explicitly enabled
  if (
    SIMULATE_PATHS.some((p) => matchesPathPrefix(pathname, p)) &&
    !isSimulationAllowed()
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // CSRF protection: verify Origin / Referer / Sec-Fetch-Site on mutating API requests (except incoming webhooks)
  if (
    pathname.startsWith("/api/") &&
    !matchesPathPrefix(pathname, "/api/webhooks") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    const requestHost = request.nextUrl.host;
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const secFetchSite = request.headers.get("sec-fetch-site");

    if (origin) {
      if (!ALLOWED_CAPACITOR_ORIGINS.has(origin)) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== requestHost) {
            return NextResponse.json(
              { error: "Requête cross-origin non autorisée" },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: "En-tête Origin invalide" },
            { status: 403 }
          );
        }
      }
    } else if (secFetchSite === "cross-site") {
      return NextResponse.json(
        { error: "Requête cross-site non autorisée" },
        { status: 403 }
      );
    } else if (referer) {
      try {
        const refererOrigin = new URL(referer);
        if (
          refererOrigin.host !== requestHost &&
          !ALLOWED_CAPACITOR_ORIGINS.has(refererOrigin.origin)
        ) {
          return NextResponse.json(
            { error: "En-tête Referer cross-origin non autorisé" },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "En-tête Referer invalide" },
          { status: 403 }
        );
      }
    }
  }

  // Allow public paths
  if (
    BASE_PUBLIC_PATHS.some((p) => matchesPathPrefix(pathname, p)) ||
    (isSimulationAllowed() &&
      SIMULATE_PATHS.some((p) => matchesPathPrefix(pathname, p)))
  ) {
    return NextResponse.next();
  }

  // Allow manifest, icons, SW, static verification/SEO files (never on /api/*)
  if (
    !pathname.startsWith("/api/") &&
    (method === "GET" || method === "HEAD") &&
    (pathname === "/" ||
      pathname.startsWith("/manifest") ||
      pathname.startsWith("/icon-") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/apple-touch-icon") ||
      pathname.startsWith("/sw.js") ||
      pathname.startsWith("/sitemap") ||
      pathname.startsWith("/robots") ||
      pathname.startsWith("/opengraph-image") ||
      pathname.endsWith(".png") ||
      pathname.endsWith(".svg") ||
      pathname.endsWith(".ico") ||
      pathname.endsWith(".webp") ||
      pathname.endsWith(".html") ||
      pathname.endsWith(".xml") ||
      pathname.endsWith(".txt"))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("pressipro-token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifyToken(token);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session expirée" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
