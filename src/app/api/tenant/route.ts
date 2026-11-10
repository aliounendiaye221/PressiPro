import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { normalizeSafeWaveMerchantUrl } from "@/lib/order-payment-reconcile";
import { z } from "zod";

function isSafeExternalHttpsLogoUrl(value: string): boolean {
  if (value === "") return true;
  if (value.startsWith("data:image/")) {
    return value.length <= 500_000;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.)/.test(host) ||
      host === "[::1]"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isValidWaveTarget(value: string): boolean {
  if (value === "") return true;
  const trimmed = value.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.includes("/")
  ) {
    return normalizeSafeWaveMerchantUrl(trimmed) !== null;
  }
  // Sinon, doit être un numéro de téléphone (chiffres, espaces, +, -)
  return /^[+0-9\s()-]{6,30}$/.test(trimmed);
}

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  waveNumber: z
    .string()
    .max(500)
    .refine(isValidWaveTarget, "Numéro Wave ou lien https://pay.wave.com invalide")
    .optional()
    .or(z.literal("")),
  omNumber: z.string().max(100).optional().or(z.literal("")),
  logoUrl: z
    .string()
    .max(500_000)
    .refine(
      isSafeExternalHttpsLogoUrl,
      "L'URL du logo doit être une adresse HTTPS publique valide"
    )
    .optional()
    .or(z.literal("")),
  brandPrimaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{6})$/).optional().or(z.literal("")),
  brandAccentColor: z.string().regex(/^#(?:[0-9a-fA-F]{6})$/).optional().or(z.literal("")),
  cinetpaySiteId: z.string().max(100).optional().or(z.literal("")),
  cinetpayApiKey: z.string().max(200).optional().or(z.literal("")),
  cinetpaySecretKey: z.string().max(200).optional().or(z.literal("")),
  cinetpayEnabled: z.boolean().optional(),
  clearCinetpayKeys: z.boolean().optional(),
});

function maskGatewaySecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 6) return "••••••";
  return `••••••••${secret.slice(-4)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeTenantResponse(tenant: any) {
  if (!tenant) return null;
  const { cinetpayApiKey, cinetpaySecretKey, ...rest } = tenant;
  return {
    ...rest,
    // Ne jamais renvoyer les clés secrètes en clair vers le navigateur ni le cache localStorage
    cinetpayApiKey: "",
    cinetpaySecretKey: "",
    hasCinetpayApiKey: Boolean(cinetpayApiKey),
    hasCinetpaySecretKey: Boolean(cinetpaySecretKey),
    cinetpayApiKeyPreview: maskGatewaySecret(cinetpayApiKey),
  };
}

const TENANT_SELECT = {
  id: true,
  name: true,
  address: true,
  phone: true,
  waveNumber: true,
  omNumber: true,
  logoUrl: true,
  brandPrimaryColor: true,
  brandAccentColor: true,
  cinetpaySiteId: true,
  cinetpayApiKey: true,
  cinetpaySecretKey: true,
  cinetpayEnabled: true,
};

export async function GET() {
  try {
    const session = await requireAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = await (prisma.tenant as any).findUnique({
      where: { id: session.tenantId },
      select: TENANT_SELECT,
    });
    if (!tenant) {
      return errorResponse("Pressing introuvable", 404);
    }
    const res = successResponse(sanitizeTenantResponse(tenant));
    res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const data = updateTenantSchema.parse(body);

    // Construction d'une mise à jour partielle sûre : les champs omis ne sont jamais remis à null
    const updatePayload: Record<string, unknown> = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.address !== undefined) updatePayload.address = data.address || null;
    if (data.phone !== undefined) updatePayload.phone = data.phone || null;
    if (data.waveNumber !== undefined) {
      const safeUrl = normalizeSafeWaveMerchantUrl(data.waveNumber);
      updatePayload.waveNumber = safeUrl || (data.waveNumber.trim() || null);
    }
    if (data.omNumber !== undefined) updatePayload.omNumber = data.omNumber || null;
    if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl || null;
    if (data.brandPrimaryColor !== undefined) {
      updatePayload.brandPrimaryColor = data.brandPrimaryColor || null;
    }
    if (data.brandAccentColor !== undefined) {
      updatePayload.brandAccentColor = data.brandAccentColor || null;
    }
    if (data.cinetpaySiteId !== undefined) {
      updatePayload.cinetpaySiteId = data.cinetpaySiteId || null;
    }
    if (data.cinetpayEnabled !== undefined) {
      updatePayload.cinetpayEnabled = data.cinetpayEnabled;
    }

    if (data.clearCinetpayKeys === true) {
      updatePayload.cinetpayApiKey = null;
      updatePayload.cinetpaySecretKey = null;
    } else {
      // N'écrase les clés existantes que si une nouvelle clé réelle (non vide et non masquée) est fournie
      if (
        typeof data.cinetpayApiKey === "string" &&
        data.cinetpayApiKey.trim() !== "" &&
        !data.cinetpayApiKey.startsWith("••")
      ) {
        updatePayload.cinetpayApiKey = data.cinetpayApiKey.trim();
      }
      if (
        typeof data.cinetpaySecretKey === "string" &&
        data.cinetpaySecretKey.trim() !== "" &&
        !data.cinetpaySecretKey.startsWith("••")
      ) {
        updatePayload.cinetpaySecretKey = data.cinetpaySecretKey.trim();
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = await (prisma.tenant as any).update({
      where: { id: session.tenantId },
      data: updatePayload,
      select: TENANT_SELECT,
    });

    return successResponse(sanitizeTenantResponse(tenant));
  } catch (error) {
    return handleApiError(error);
  }
}
