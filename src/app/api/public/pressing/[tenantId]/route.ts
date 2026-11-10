import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

const MAX_REQUESTS_PER_IP = 60;
const WINDOW_MS = 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit(
      `public:pressing:ip:${clientIp}`,
      MAX_REQUESTS_PER_IP,
      WINDOW_MS
    );

    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes. Veuillez patienter un instant." },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipLimit.retryAfterSeconds),
          },
        }
      );
    }

    const { tenantId } = await params;

    if (!tenantId || tenantId.trim().length === 0) {
      return errorResponse("Identifiant de pressing manquant", 400);
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        waveNumber: true,
        omNumber: true,
        logoUrl: true,
        brandPrimaryColor: true,
        brandAccentColor: true,
      },
    });

    if (!tenant) {
      return errorResponse("Pressing introuvable ou inactif", 404);
    }

    const services = await prisma.service.findMany({
      where: {
        tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        pricingType: true,
        category: true,
        isQuickItem: true,
        sortOrder: true,
      },
      orderBy: [
        { sortOrder: "asc" },
        { isQuickItem: "desc" },
        { name: "asc" },
      ],
    });

    const res = successResponse({
      tenant,
      services,
    });

    // Pas de mise en cache CDN agressive pour garantir la fraîcheur immédiate des tarifs et du logo
    res.headers.set(
      "Cache-Control",
      "no-cache, no-store, max-age=0, must-revalidate"
    );

    return res;
  } catch (error) {
    return handleApiError(error);
  }
}

