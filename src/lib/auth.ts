import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

const jwtSecretValue = process.env.JWT_SECRET;

if (!jwtSecretValue || jwtSecretValue.length < 32) {
  throw new Error("JWT_SECRET must be set and contain at least 32 characters");
}

const JWT_SECRET = new TextEncoder().encode(jwtSecretValue);

const COOKIE_NAME = "pressipro-token";

function resolveSessionTtlSeconds() {
  const rawDays = Number.parseInt(process.env.SESSION_TTL_DAYS || "30", 10);
  const days = Number.isFinite(rawDays) ? Math.min(90, Math.max(1, rawDays)) : 30;
  return days * 24 * 60 * 60;
}

const SESSION_TTL_SECONDS = resolveSessionTtlSeconds();

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
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

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  // Verify user still exists, is active, and belongs to the session tenant.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      active: true,
      tenantId: true,
      tenant: { select: { active: true } },
    },
  });

  if (!user || !user.active || user.tenantId !== session.tenantId) {
    throw new Error("UNAUTHORIZED");
  }

  // Tenant deactivation blocks all non-super-admin sessions on every protected route.
  if (session.role !== "SUPER_ADMIN" && !user.tenant.active) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
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

export { COOKIE_NAME };
