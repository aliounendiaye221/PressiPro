import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { customerSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { parsePagination } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const { page, limit } = parsePagination(searchParams, { maxLimit: 50 });

    const where = {
      tenantId: session.tenantId,
      ...(search
        ? {
            OR: [
              { phone: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return successResponse({ customers, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const body = await request.json();
    const data = customerSchema.parse(body);

    // Check duplicate phone for this tenant
    const existing = await prisma.customer.findUnique({
      where: { tenantId_phone: { tenantId: session.tenantId, phone: data.phone } },
    });
    if (existing) {
      return errorResponse("Un client avec ce numéro existe déjà", 409);
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId: session.tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      },
    });

    return successResponse(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
