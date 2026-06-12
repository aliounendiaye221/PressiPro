import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

const jwtSecretValue = process.env.JWT_SECRET;
if (!jwtSecretValue || jwtSecretValue.length < 32) {
  throw new Error("JWT_SECRET must be set and contain at least 32 characters");
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretValue);

export const COOKIE_NAME = "pressipro-token";

export function resolveSessionTtlSeconds() {
  const rawDays = Number.parseInt(process.env.SESSION_TTL_DAYS || "30", 10);
  const days = Number.isFinite(rawDays) ? Math.min(90, Math.max(1, rawDays)) : 30;
  return days * 24 * 60 * 60;
}

export const SESSION_TTL_SECONDS = resolveSessionTtlSeconds();

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
  name: string;
}

export async function createToken(payload: SessionPayload): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function tokenCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
