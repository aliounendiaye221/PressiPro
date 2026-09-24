import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";

const createTenantSchema = z.object({
  name: z.string().min(2, "Le nom du pressing doit contenir au moins 2 caractères").max(100),
  phone: z.string().max(30).optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  subscription: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]).default("FREE"),
  adminName: z.string().min(2, "Le nom de l'administrateur doit contenir au moins 2 caractères").max(100),
  adminEmail: z.string().email("Adresse email invalide"),
  adminPassword: z
    .string()
    .min(10, "Le mot de passe doit contenir au moins 10 caractères")
    .regex(/[a-z]/, "Au moins une minuscule")
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[0-9]/, "Au moins un chiffre")
    .regex(/[^A-Za-z0-9]/, "Au moins un caractère spécial"),
});

export async function POST(request: NextRequest) {
  try {
    const superAdminSession = await requireSuperAdmin();
    const body = await request.json();
    const data = createTenantSchema.parse(body);

    const normalizedEmail = data.adminEmail.toLowerCase().trim();

    // Check if admin email already exists globally
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return errorResponse("Un utilisateur avec cet email existe déjà", 409);
    }

    const hashedPassword = await hashPassword(data.adminPassword);

    const result = await prisma.$transaction(async (tx) => {
      const p = tx as typeof prisma;
      const tenant = await p.tenant.create({
        data: {
          name: data.name.trim(),
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          subscription: data.subscription,
          subscribedAt: data.subscription !== "FREE" ? new Date() : null,
          active: true,
        },
      });

      const user = await p.user.create({
        data: {
          tenantId: tenant.id,
          name: data.adminName.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: "ADMIN",
          active: true,
        },
      });

      return { tenant, user };
    });

    await auditLog({
      tenantId: result.tenant.id,
      userId: superAdminSession.userId,
      action: "TENANT_CREATED_BY_SUPERADMIN",
      entity: "Tenant",
      entityId: result.tenant.id,
      details: {
        tenantName: result.tenant.name,
        adminEmail: result.user.email,
        subscription: result.tenant.subscription,
      },
    });

    return successResponse(
      {
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          phone: result.tenant.phone,
          address: result.tenant.address,
          subscription: result.tenant.subscription,
          createdAt: result.tenant.createdAt,
        },
        admin: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
