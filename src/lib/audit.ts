import { prisma } from "./db";

export async function auditLog(params: {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to write audit log:", {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      error: error instanceof Error ? error.message : error,
    });

    if (process.env.AUDIT_LOG_STRICT === "1") {
      throw new Error("AUDIT_LOG_WRITE_FAILED");
    }
  }
}
