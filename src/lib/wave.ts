import crypto from "crypto";

/**
 * Client minimal pour l'API Wave Checkout (https://docs.wave.com/checkout).
 *
 * Variables d'environnement :
 *  - WAVE_API_KEY             (obligatoire) clé API Wave Business (wave_sn_prod_...)
 *  - WAVE_API_SIGNING_SECRET  (optionnel)   secret de signature des requêtes, si activé sur la clé (wave_sn_AKS_...)
 *  - WAVE_WEBHOOK_SECRET      (obligatoire pour le webhook) secret de signature webhook (wave_sn_WHS_...)
 */

const WAVE_API_BASE = "https://api.wave.com";
const WAVE_TIMEOUT_MS = 15_000;

export type WaveCheckoutStatus = "open" | "complete" | "expired";
export type WavePaymentStatus = "processing" | "cancelled" | "succeeded";

export interface WaveCheckoutSession {
  id: string;
  amount: string;
  checkout_status: WaveCheckoutStatus;
  client_reference: string | null;
  currency: string;
  error_url: string;
  success_url: string;
  last_payment_error: { code: string; message: string } | null;
  business_name: string;
  payment_status: WavePaymentStatus;
  transaction_id?: string;
  wave_launch_url: string;
  when_completed?: string;
  when_created: string;
  when_expires: string;
}

export interface WaveWebhookEvent {
  id: string;
  type: string; // ex: checkout.session.completed, checkout.session.payment_failed
  data: WaveCheckoutSession;
}

export class WaveApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "WaveApiError";
  }
}

export function isWaveConfigured(): boolean {
  return !!process.env.WAVE_API_KEY;
}

function signRequestBody(body: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function waveRequest<T>(method: "GET" | "POST", path: string, payload?: unknown): Promise<T> {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) {
    throw new WaveApiError("WAVE_API_KEY n'est pas configurée sur le serveur.", 500, "missing-api-key");
  }

  const body = payload === undefined ? "" : JSON.stringify(payload);
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (payload !== undefined) headers["Content-Type"] = "application/json";

  // Signature des requêtes (uniquement si activée sur la clé API côté Wave)
  const signingSecret = process.env.WAVE_API_SIGNING_SECRET;
  if (signingSecret) headers["Wave-Signature"] = signRequestBody(body, signingSecret);

  let res: Response;
  try {
    res = await fetch(`${WAVE_API_BASE}${path}`, {
      method,
      headers,
      body: payload === undefined ? undefined : body,
      signal: AbortSignal.timeout(WAVE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new WaveApiError(`Impossible de joindre Wave (${reason}).`, 503, "network-error");
  }

  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const code = typeof data?.code === "string" ? data.code : undefined;
    const message =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error_message === "string" && data.error_message) ||
      `Erreur Wave (HTTP ${res.status})`;
    throw new WaveApiError(message, res.status, code);
  }

  return data as T;
}

/**
 * Crée une session de paiement Wave. Rediriger ensuite le client vers `wave_launch_url`.
 * Wave exige des URLs de retour en HTTPS.
 */
export async function createWaveCheckoutSession(params: {
  amount: number;
  clientReference: string;
  successUrl: string;
  errorUrl: string;
  restrictPayerMobile?: string;
}): Promise<WaveCheckoutSession> {
  const amount = Math.round(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WaveApiError("Montant invalide pour Wave.", 400, "invalid-amount");
  }
  if (!params.successUrl.startsWith("https://") || !params.errorUrl.startsWith("https://")) {
    throw new WaveApiError(
      "Wave exige des URLs de retour en HTTPS. Définissez NEXT_PUBLIC_APP_URL avec l'adresse publique HTTPS de l'application.",
      400,
      "https-required"
    );
  }

  return waveRequest<WaveCheckoutSession>("POST", "/v1/checkout/sessions", {
    amount: String(amount), // XOF : pas de décimales
    currency: "XOF",
    client_reference: params.clientReference,
    success_url: params.successUrl,
    error_url: params.errorUrl,
    ...(params.restrictPayerMobile ? { restrict_payer_mobile: params.restrictPayerMobile } : {}),
  });
}

export async function getWaveCheckoutSession(sessionId: string): Promise<WaveCheckoutSession> {
  return waveRequest<WaveCheckoutSession>("GET", `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export async function searchWaveCheckoutSessions(clientReference: string): Promise<WaveCheckoutSession[]> {
  const data = await waveRequest<{ result: WaveCheckoutSession[] }>(
    "GET",
    `/v1/checkout/sessions/search?client_reference=${encodeURIComponent(clientReference)}`
  );
  return data?.result || [];
}

/**
 * Vérifie l'en-tête `Wave-Signature` d'un webhook (HMAC-SHA256 de `timestamp + corps brut`).
 * Le corps doit être la chaîne brute reçue, jamais un JSON re-sérialisé.
 */
export function verifyWaveWebhookSignature(
  signatureHeader: string | null | undefined,
  rawBody: string,
  secret: string,
  options: { toleranceSeconds?: number; nowSeconds?: number } = {}
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",").map((p) => p.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;

  const tolerance = options.toleranceSeconds ?? 300;
  if (tolerance > 0) {
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > tolerance) return false;
  }

  const expected = Buffer.from(
    crypto.createHmac("sha256", secret).update(`${timestamp}${rawBody}`).digest("hex"),
    "utf8"
  );

  return signatures.some((sig) => {
    const candidate = Buffer.from(sig, "utf8");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  });
}
