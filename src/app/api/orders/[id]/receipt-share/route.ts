import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { createReceiptShareToken } from "@/lib/receipt-share";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true, tenantId: true },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const token = await createReceiptShareToken({
      orderId: order.id,
      tenantId: order.tenantId,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const shareUrl = `${appUrl}/share/receipt/${token}`;

    return successResponse({
      shareUrl,
      downloadUrl: `${shareUrl}?download=1`,
      inlineUrl: `${shareUrl}?inline=1`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
