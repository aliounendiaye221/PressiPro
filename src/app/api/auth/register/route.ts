import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken, tokenCookieOptions } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { handleApiError, successResponse } from "@/lib/api-utils";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check email uniqueness across all tenants (for login simplicity)
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email },
    });
    if (existingUser) {
      return successResponse({ error: "Cet email est déjà utilisé" }, 409);
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
          email: data.email,
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
      email: result.user.email,
      name: result.user.name,
    });

    const cookieStore = await cookies();
    const opts = tokenCookieOptions();
    cookieStore.set(opts.name, token, opts);

    return successResponse({
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
  } catch (error) {
    return handleApiError(error);
  }
}
