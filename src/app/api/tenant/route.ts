import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";
import { z } from "zod";

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  waveNumber: z.string().max(20).optional().or(z.literal("")),
  omNumber: z.string().max(20).optional().or(z.literal("")),
  logoUrl: z.string().url().max(500).optional().or(z.literal("")),
  brandPrimaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{6})$/).optional().or(z.literal("")),
  brandAccentColor: z.string().regex(/^#(?:[0-9a-fA-F]{6})$/).optional().or(z.literal("")),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        waveNumber: true,
        omNumber: true,
        logoUrl: true,
        brandPrimaryColor: true,
        brandAccentColor: true,
      },
    });
    return successResponse(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const data = updateTenantSchema.parse(body);

    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        address: data.address || null,
        phone: data.phone || null,
        waveNumber: data.waveNumber || null,
        omNumber: data.omNumber || null,
        logoUrl: data.logoUrl || null,
        brandPrimaryColor: data.brandPrimaryColor || null,
        brandAccentColor: data.brandAccentColor || null,
      },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        waveNumber: true,
        omNumber: true,
        logoUrl: true,
        brandPrimaryColor: true,
        brandAccentColor: true,
      },
    });

    return successResponse(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
