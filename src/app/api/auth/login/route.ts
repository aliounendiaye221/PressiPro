import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createToken, tokenCookieOptions } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_LOGIN_ATTEMPTS_PER_IP = 30;
const MAX_LOGIN_ATTEMPTS_PER_EMAIL = 12;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_PASSWORD_ATTEMPTS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

function getClientIp(request: NextRequest): string {
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
      // Use the right-most hop as a safer fallback when multiple proxies are involved.
      return candidates[candidates.length - 1] || "unknown";
    }
  }

  return "unknown";
}

function tooManyRequestsResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Trop de tentatives. Réessayez plus tard." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);
    const normalizedEmail = data.email.trim().toLowerCase();
    const clientIp = getClientIp(request);

    const ipLimit = checkRateLimit(
      `auth:login:ip:${clientIp}`,
      MAX_LOGIN_ATTEMPTS_PER_IP,
      LOGIN_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return tooManyRequestsResponse(ipLimit.retryAfterSeconds);
    }

    const emailLimit = checkRateLimit(
      `auth:login:email:${normalizedEmail}`,
      MAX_LOGIN_ATTEMPTS_PER_EMAIL,
      LOGIN_WINDOW_MS
    );
    if (!emailLimit.allowed) {
      return tooManyRequestsResponse(emailLimit.retryAfterSeconds);
    }

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, active: true },
      include: { tenant: { select: { id: true, name: true, active: true } } },
    });

    if (!user) {
      return errorResponse("Email ou mot de passe incorrect", 401);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
      );
      return tooManyRequestsResponse(retryAfterSeconds);
    }

    // Block login if tenant is deactivated (except SUPER_ADMIN)
    if (!user.tenant.active && user.role !== "SUPER_ADMIN") {
      return errorResponse("Votre pressing a été désactivé. Contactez l'administrateur.", 403);
    }

    const validPw = await verifyPassword(data.password, user.password);
    if (!validPw) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_PASSWORD_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : failedAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null,
        },
      });
      return errorResponse("Email ou mot de passe incorrect", 401);
    }

    if (user.failedLoginAttempts !== 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const token = await createToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    const opts = tokenCookieOptions();
    const response = successResponse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
      },
    });

    response.cookies.set(opts.name, token, opts);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
