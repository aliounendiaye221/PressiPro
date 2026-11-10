import { SignJWT, jwtVerify } from "jose";

const shareSecretValue = process.env.RECEIPT_SHARE_SECRET || process.env.JWT_SECRET;

if (!shareSecretValue || shareSecretValue.length < 32) {
  throw new Error("JWT_SECRET must be set and contain at least 32 characters");
}

const RECEIPT_SECRET = new TextEncoder().encode(shareSecretValue);
const FALLBACK_JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET !== shareSecretValue
    ? new TextEncoder().encode(process.env.JWT_SECRET)
    : null;

const RECEIPT_SHARE_TTL_SECONDS = 30 * 24 * 60 * 60;

export type ReceiptSharePayload = {
  orderId: string;
  tenantId: string;
  duplicate?: boolean;
};

export async function createReceiptShareToken(payload: ReceiptSharePayload) {
  const exp = Math.floor(Date.now() / 1000) + RECEIPT_SHARE_TTL_SECONDS;
  return new SignJWT({
    ...(payload as unknown as Record<string, unknown>),
    typ: "receipt",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(RECEIPT_SECRET);
}

function extractReceiptPayload(payload: Record<string, unknown>): ReceiptSharePayload | null {
  // Prevent user session tokens from ever being parsed as receipt tokens
  if (payload.typ === "session" || payload.userId !== undefined) {
    return null;
  }
  if (
    typeof payload.orderId !== "string" ||
    typeof payload.tenantId !== "string" ||
    !payload.orderId ||
    !payload.tenantId
  ) {
    return null;
  }

  return {
    orderId: payload.orderId,
    tenantId: payload.tenantId,
    duplicate: payload.duplicate === true,
  };
}

export async function verifyReceiptShareToken(token: string): Promise<ReceiptSharePayload | null> {
  try {
    const { payload } = await jwtVerify(token, RECEIPT_SECRET, {
      algorithms: ["HS256"],
    });
    return extractReceiptPayload(payload as Record<string, unknown>);
  } catch {
    // Backward compatibility: if RECEIPT_SHARE_SECRET was recently added, still honor existing 30-day WhatsApp links signed with JWT_SECRET
    if (FALLBACK_JWT_SECRET) {
      try {
        const { payload } = await jwtVerify(token, FALLBACK_JWT_SECRET, {
          algorithms: ["HS256"],
        });
        return extractReceiptPayload(payload as Record<string, unknown>);
      } catch {
        return null;
      }
    }
    return null;
  }
}
