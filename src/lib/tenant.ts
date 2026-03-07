import { requireSession } from "./auth";

/**
 * Returns the tenantId from the current session.
 * Throws UNAUTHORIZED if no valid session.
 * This is THE single source of truth for tenant scoping in all API routes.
 */
export async function requireTenantId(): Promise<string> {
  const session = await requireSession();
  return session.tenantId;
}

/**
 * Returns full session with tenantId guaranteed.
 */
export async function requireTenantSession() {
  const session = await requireSession();
  return session;
}
