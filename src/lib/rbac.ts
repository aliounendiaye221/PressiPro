import { requireSession, type SessionPayload } from "./auth";
import type { Role } from "@prisma/client";

/**
 * Requires the user to have one of the specified roles.
 * SUPER_ADMIN always passes.
 */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role === "SUPER_ADMIN") return session;
  if (!roles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

/**
 * Requires ADMIN role (or SUPER_ADMIN).
 */
export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole("ADMIN");
}

/**
 * Requires SUPER_ADMIN role.
 */
export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "SUPER_ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}
