import { prisma } from "./db";

export async function auditLog(params: {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
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
}
