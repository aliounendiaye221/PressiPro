import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

const jwtSecretValue = process.env.JWT_SECRET;

if (!jwtSecretValue || jwtSecretValue.length < 32) {
  throw new Error("JWT_SECRET must be set and contain at least 32 characters");
}

const JWT_SECRET = new TextEncoder().encode(jwtSecretValue);

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
  name: string;
}

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
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
