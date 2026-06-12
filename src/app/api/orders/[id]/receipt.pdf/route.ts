import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";
import { getOrderReceiptData, getOrderReceiptPdf } from "@/lib/receipt/pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isDuplicate = searchParams.get("duplicate") === "1";
    const isDownload = searchParams.get("download") === "1";
    const isPreview = searchParams.get("preview") === "1";
    const isJson = searchParams.get("json") === "1";

    if (isJson) {
      const receiptDataResult = await getOrderReceiptData({
        tenantId: session.tenantId,
        orderId: id,
        isDuplicate,
      });

      if (!receiptDataResult) {
        return errorResponse("Commande introuvable", 404);
      }

      return NextResponse.json(receiptDataResult.receiptData);
    }

    const receiptPdf = await getOrderReceiptPdf({
      tenantId: session.tenantId,
      orderId: id,
      isDuplicate,
    });

    if (!receiptPdf) {
      return errorResponse("Commande introuvable", 404);
    }

    if (!isPreview) {
      await auditLog({
        tenantId: session.tenantId,
        userId: session.userId,
        action: isDuplicate ? "RECEIPT_REPRINT" : "RECEIPT_PRINT",
        entity: "Order",
        entityId: receiptPdf.orderId,
        details: { code: receiptPdf.orderCode, isDuplicate },
      });
    }

    const pdfBytes = Uint8Array.from(receiptPdf.pdfBuffer);
    const pdfBlob = new Blob([pdfBytes], {
      type: "application/pdf",
    });

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="recu-${receiptPdf.orderCode}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
