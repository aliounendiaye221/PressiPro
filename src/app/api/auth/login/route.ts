import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createToken, tokenCookieOptions } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: { email: data.email, active: true },
      include: { tenant: { select: { id: true, name: true } } },
    });

    if (!user) {
      return errorResponse("Email ou mot de passe incorrect", 401);
    }

    const validPw = await verifyPassword(data.password, user.password);
    if (!validPw) {
      return errorResponse("Email ou mot de passe incorrect", 401);
    }

    const token = await createToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    const cookieStore = await cookies();
    const opts = tokenCookieOptions();
    cookieStore.set(opts.name, token, opts);

    return successResponse({
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
  } catch (error) {
    return handleApiError(error);
  }
}
