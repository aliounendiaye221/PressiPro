import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import {
  COOKIE_NAME,
  verifyToken,
  type SessionPayload,
  createToken,
  tokenCookieOptions,
  SESSION_TTL_SECONDS,
} from "./auth-shared";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
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

export {
  COOKIE_NAME,
  verifyToken,
  createToken,
  tokenCookieOptions,
  SESSION_TTL_SECONDS,
};
export type { SessionPayload };
