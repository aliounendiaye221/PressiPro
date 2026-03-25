import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { createUserSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/auth";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await requireAdmin();
    const users = await prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return successResponse(users);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const data = createUserSchema.parse(body);
    const normalizedEmail = data.email.trim().toLowerCase();

    const existing = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return errorResponse("Un utilisateur avec cet email existe déjà", 409);
    }

    const hashedPw = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        email: normalizedEmail,
        password: hashedPw,
        name: data.name,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return successResponse(user, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
