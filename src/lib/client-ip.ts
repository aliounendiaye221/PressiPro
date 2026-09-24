import { NextRequest } from "next/server";

/**
 * Extrait l'adresse IP réelle du client depuis les headers HTTP.
 * Supporte Vercel, nginx (x-real-ip) et les proxies standards (x-forwarded-for).
 * Utilise le hop le plus à droite comme source la plus fiable.
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

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

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidates = forwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (candidates.length > 0) {
      // Le hop le plus à droite est plus fiable en présence de plusieurs proxies.
      return candidates[candidates.length - 1] || "unknown";
    }
  }

  return "unknown";
}
