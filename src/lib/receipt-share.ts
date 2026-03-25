import { SignJWT, jwtVerify } from "jose";

const jwtSecretValue = process.env.JWT_SECRET;

if (!jwtSecretValue || jwtSecretValue.length < 32) {
  throw new Error("JWT_SECRET must be set and contain at least 32 characters");
}

const JWT_SECRET = new TextEncoder().encode(jwtSecretValue);
const RECEIPT_SHARE_TTL_SECONDS = 30 * 24 * 60 * 60;

export type ReceiptSharePayload = {
  orderId: string;
  tenantId: string;
  duplicate?: boolean;
};

export async function createReceiptShareToken(payload: ReceiptSharePayload) {
  const exp = Math.floor(Date.now() / 1000) + RECEIPT_SHARE_TTL_SECONDS;
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(JWT_SECRET);
}

export async function verifyReceiptShareToken(token: string): Promise<ReceiptSharePayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (
      typeof payload.orderId !== "string" ||
      typeof payload.tenantId !== "string"
    ) {
      return null;
    }

    return {
      orderId: payload.orderId,
      tenantId: payload.tenantId,
      duplicate: payload.duplicate === true,
    };
  } catch {
    return null;
  }
}
