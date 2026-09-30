import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken, tokenCookieOptions } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

const MAX_REGISTER_PER_IP = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

const DEFAULT_SERVICES = [
  { name: "Chemise", price: 500, category: "Repassage", isQuickItem: true, sortOrder: 1 },
  { name: "Pantalon", price: 500, category: "Repassage", isQuickItem: true, sortOrder: 2 },
  { name: "Costume complet", price: 2000, category: "Lavage", isQuickItem: true, sortOrder: 3 },
  { name: "Robe simple", price: 1000, category: "Lavage", isQuickItem: true, sortOrder: 4 },
  { name: "Robe brodée", price: 2500, category: "Lavage", isQuickItem: true, sortOrder: 5 },
  { name: "Boubou homme", price: 1500, category: "Lavage", isQuickItem: true, sortOrder: 6 },
  { name: "Boubou femme", price: 2000, category: "Lavage", isQuickItem: true, sortOrder: 7 },
  { name: "Drap", price: 1000, category: "Lavage", isQuickItem: true, sortOrder: 8 },
  { name: "Couverture", price: 2000, category: "Lavage", isQuickItem: false, sortOrder: 9 },
  { name: "Lavage au kilo", price: 1500, category: "Lavage", pricingType: "PER_KG" as const, isQuickItem: true, sortOrder: 10 },
];

    // Create tenant + admin user + default services in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const p = tx as typeof prisma;
      const tenant = await p.tenant.create({
        data: {
          name: data.tenantName,
          phone: data.tenantPhone || null,
          address: data.tenantAddress || null,
        },
      });

      const hashedPw = await hashPassword(data.password);
      const user = await p.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          password: hashedPw,
          name: data.name,
          role: "ADMIN",
        },
      });

      await p.service.createMany({
        data: DEFAULT_SERVICES.map((s) => ({
          tenantId: tenant.id,
          name: s.name,
          price: s.price,
          category: s.category,
          pricingType: s.pricingType || "PER_ITEM",
          isQuickItem: s.isQuickItem,
          sortOrder: s.sortOrder,
          active: true,
        })),
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
