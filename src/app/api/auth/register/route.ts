import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken, tokenCookieOptions } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_REGISTER_PER_IP = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const candidates = vercelForwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (candidates.length > 0) return candidates[candidates.length - 1] || "unknown";
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidates = forwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (candidates.length > 0) return candidates[candidates.length - 1] || "unknown";
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // Rate limit: max 5 registrations per IP per hour
    const ipLimit = await checkRateLimit(
      `auth:register:ip:${clientIp}`,
      MAX_REGISTER_PER_IP,
      REGISTER_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives d'inscription. Réessayez plus tard." },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const data = registerSchema.parse(body);
    const normalizedEmail = data.email.trim().toLowerCase();

    // Check email uniqueness across all tenants (for login simplicity)
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      return errorResponse("Cet email est déjà utilisé", 409);
    }

    // Create tenant + admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.tenantName,
          phone: data.tenantPhone || null,
          address: data.tenantAddress || null,
        },
      });

      const hashedPw = await hashPassword(data.password);
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          password: hashedPw,
          name: data.name,
          role: "ADMIN",
        },
      });

      return { tenant, user };
    });

    const token = await createToken({
      userId: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
      email: normalizedEmail,
      name: result.user.name,
    });

    const opts = tokenCookieOptions();
    const response = successResponse({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
      },
    }, 201);

    response.cookies.set(opts.name, token, opts);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
