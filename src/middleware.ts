import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth-shared";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
  "/share/receipt",
  "/api/public/receipt",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow manifest, icons, SW, static verification/SEO files
  if (
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.endsWith(".html") ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".txt") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // CSRF protection: verify Origin header on mutating API requests
  const method = request.method.toUpperCase();
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    const origin = request.headers.get("origin");
    if (origin) {
      const requestHost = request.nextUrl.host;
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
