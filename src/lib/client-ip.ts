import { NextRequest } from "next/server";

/**
 * Extrait l'adresse IP réelle du client depuis les headers HTTP.
 * Priorise l'en-tête injecté par l'infrastructure Vercel (`x-vercel-forwarded-for`, non falsifiable côté client),
 * puis `x-real-ip`, puis le dernier hop de `x-forwarded-for`.
 */
export function getClientIp(request: NextRequest): string {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const candidates = vercelForwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (candidates.length > 0) {
      return candidates[candidates.length - 1] || "unknown";
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidates = forwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (candidates.length > 0) {
      return candidates[candidates.length - 1] || "unknown";
    }
  }

  return "unknown";
}
