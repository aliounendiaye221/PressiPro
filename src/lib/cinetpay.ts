import crypto from "crypto";
import { prisma } from "@/lib/db";

export interface CinetPayConfig {
  apiKey: string;
  siteId: string;
  secretKey?: string;
  isEnabled: boolean;
}

export interface InitiatePaymentParams {
  amount: number;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** Pass tenantId ONLY for tenant order payments; omit for PressiPro SaaS subscriptions */
  tenantId?: string;
  tenantName: string;
  returnUrl: string;
  notifyUrl: string;
  customToken?: string;
  transactionId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CinetPayInitResponse {
  success: boolean;
  paymentUrl?: string;
  paymentToken?: string;
  transactionId: string;
  isSimulated?: boolean;
  error?: string;
}

export interface CinetPayCheckResponse {
  success: boolean;
  status?: "ACCEPTED" | "REFUSED" | "PENDING" | "ERROR";
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  operatorId?: string;
  paymentDate?: string;
  transactionId?: string;
  metadata?: string;
  description?: string;
  error?: string;
}

export interface SimulatedTransaction {
  transactionId: string;
  amount: number;
  status: "ACCEPTED" | "REFUSED";
  paymentMethod: string;
  date: string;
  metadata?: Record<string, unknown>;
}

const simulatedTransactions = new Map<string, SimulatedTransaction>();

export function isSimulationAllowedInEnv(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.CINETPAY_SIMULATE === "true"
  );
}

export function registerSimulatedTransaction(data: SimulatedTransaction) {
  if (!isSimulationAllowedInEnv()) return;
  if (simulatedTransactions.size >= 1000) {
    const oldest = simulatedTransactions.keys().next().value;
    if (oldest) simulatedTransactions.delete(oldest);
  }
  simulatedTransactions.set(data.transactionId, data);
}

export function getSimulatedTransaction(txId: string): SimulatedTransaction | undefined {
  if (!isSimulationAllowedInEnv()) return undefined;
  return simulatedTransactions.get(txId);
}

function getBindingSecret(): string {
  return process.env.JWT_SECRET || "pressipro-tx-binding-fallback-dev-secret";
}

/**
 * Computes a deterministic 6-digit numeric HMAC tag binding a transaction to (tenantId, orderId).
 * Keeps transaction IDs strictly matching /^PPO-[A-Z0-9]+-\d+$/ and <= 26 chars for CinetPay v1/v2.
 */
export function computeOrderNumericTag(tenantId: string, orderId: string): string {
  const digest = crypto
    .createHmac("sha256", getBindingSecret())
    .update(`${tenantId}:${orderId}`)
    .digest();
  const num = digest.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, "0");
}

/**
 * Récupère la configuration CinetPay.
 * - Si `tenantId` est fourni (paiement commande pressing), utilise les clés du pressing ou fallback env.
 * - Si `tenantId` est omis (abonnement SaaS PressiPro), utilise exclusivement les clés plateforme.
 */
export async function getCinetPayConfig(tenantId?: string): Promise<CinetPayConfig> {
  let apiKey = process.env.CINETPAY_API_KEY || "";
  let siteId = process.env.CINETPAY_SITE_ID || "";
  let secretKey = process.env.CINETPAY_SECRET_KEY || process.env.CINETPAY_API_PASSWORD || "";
  let isEnabled = !!(apiKey && (siteId || secretKey || apiKey.startsWith("sk_")));

  if (tenantId && process.env.NODE_ENV !== "test") {
    try {
      const rows = (await prisma.$queryRaw`
        SELECT "cinetpayApiKey", "cinetpaySiteId", "cinetpaySecretKey", "cinetpayEnabled"
        FROM "Tenant"
        WHERE id = ${tenantId}
        LIMIT 1
      `) as Array<{
        cinetpayApiKey: string | null;
        cinetpaySiteId: string | null;
        cinetpaySecretKey: string | null;
        cinetpayEnabled: boolean | null;
      }>;

      const tenant = rows?.[0];

      if (tenant?.cinetpayApiKey) {
        apiKey = tenant.cinetpayApiKey;
        siteId = tenant.cinetpaySiteId || siteId;
        secretKey = tenant.cinetpaySecretKey || secretKey;
        isEnabled = tenant.cinetpayEnabled ?? true;
      } else if (tenant?.cinetpayEnabled !== undefined && tenant?.cinetpayEnabled !== null) {
        isEnabled = Boolean(tenant.cinetpayEnabled) && !!apiKey;
      }
    } catch {
      // Fallback silently to env variables
    }
  }

  return { apiKey, siteId, secretKey, isEnabled };
}

/**
 * Génère un identifiant de transaction CinetPay/Wave unique et traçable.
 * Lorsque `binding` ({ tenantId, orderId }) est fourni, intègre un tag HMAC numérique à 6 chiffres
 * empêchant tout rejeu inter-commandes ou collision multi-tenant sur `P-00001`.
 */
export function generateTransactionId(
  orderCode: string,
  binding?: { tenantId: string; orderId: string }
): string {
  const cleanCode = orderCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  if (binding?.tenantId && binding?.orderId) {
    const tag6 = computeOrderNumericTag(binding.tenantId, binding.orderId);
    const ts4 = Date.now().toString().slice(-4);
    const rand3 = Math.floor(100 + Math.random() * 900);
    return `PPO-${cleanCode}-${tag6}${ts4}${rand3}`;
  }
  const rand = Math.floor(1000 + Math.random() * 9000);
  const timestamp = Date.now().toString().slice(-6);
  return `PPO-${cleanCode}-${timestamp}${rand}`;
}

/**
 * Vérifie qu'un identifiant `PPO-...` appartient bien à la commande `(tenantId, orderId, orderCode)`.
 */
export function verifyOrderTransactionBinding(
  transactionId: string,
  order: { id: string; tenantId: string; code: string },
  options: { allowLegacyUnbound?: boolean } = {}
): boolean {
  if (!transactionId || !transactionId.startsWith("PPO-")) {
    return false;
  }
  const parts = transactionId.split("-");
  if (parts.length !== 3) return false;

  const [, txCleanCode, suffix] = parts;
  const expectedCleanCode = order.code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  if (!txCleanCode || txCleanCode !== expectedCleanCode) {
    return false;
  }
  if (!/^\d+$/.test(suffix)) {
    return false;
  }

  // Bound 13-digit suffix: 6-digit HMAC + 4-digit timestamp + 3-digit nonce
  if (suffix.length === 13) {
    const expectedTag = computeOrderNumericTag(order.tenantId, order.id);
    return suffix.slice(0, 6) === expectedTag;
  }

  // Legacy 10-digit suffix compatibility for in-flight transactions at deploy time
  if (suffix.length === 10 && options.allowLegacyUnbound) {
    return true;
  }

  return false;
}

export async function initiateCinetPayPayment(
  params: InitiatePaymentParams
): Promise<CinetPayInitResponse> {
  const isSubscription =
    (params.transactionId && params.transactionId.startsWith("SUB-")) ||
    params.metadata?.type === "SUBSCRIPTION";
  const effectiveTenantId = isSubscription ? undefined : params.tenantId;

  const config = await getCinetPayConfig(effectiveTenantId);
  const isTest = process.env.NODE_ENV === "test";
  const forceLive =
    process.env.CINETPAY_FORCE_LIVE === "true" ||
    process.env.CINETPAY_SIMULATE === "false";
  const isDev = process.env.NODE_ENV !== "production" && !isTest && !forceLive;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pressipro.vercel.app";

  const transactionId =
    params.transactionId ||
    generateTransactionId(
      params.orderCode,
      effectiveTenantId && params.orderId
        ? { tenantId: effectiveTenantId, orderId: params.orderId }
        : undefined
    );

  const description =
    params.description ||
    `Paiement pressing ${params.tenantName} - Commande ${params.orderCode}`;

  const buildSimulationUrl = () => {
    try {
      const url = new URL("/checkout/simulate", appUrl);
      url.searchParams.set("tx", transactionId);
      url.searchParams.set("amount", Math.round(params.amount).toString());
      url.searchParams.set("desc", description);
      url.searchParams.set("returnUrl", params.returnUrl);
      url.searchParams.set("customerName", params.customerName || "Client");
      if (params.customerPhone) {
        url.searchParams.set("customerPhone", params.customerPhone);
      }
      return url.toString();
    } catch {
      return `/checkout/simulate?tx=${encodeURIComponent(transactionId)}&amount=${Math.round(params.amount)}&returnUrl=${encodeURIComponent(params.returnUrl)}`;
    }
  };

  if (!config.apiKey) {
    if (isDev) {
      return {
        success: true,
        transactionId,
        paymentUrl: buildSimulationUrl(),
        isSimulated: true,
      };
    }
    return {
      success: false,
      transactionId: "",
      error: "Clé API CinetPay manquante. Veuillez renseigner CINETPAY_API_KEY dans vos paramètres.",
    };
  }

  if (forceLive && config.apiKey.startsWith("sk_") && !config.secretKey) {
    return {
      success: false,
      transactionId,
      error:
        "Pour le mode opérationnel avec une clé CinetPay (sk_...), vous devez également renseigner le mot de passe d'API (CINETPAY_SECRET_KEY).",
    };
  }

  if (process.env.CINETPAY_SIMULATE === "true") {
    return {
      success: true,
      transactionId,
      paymentUrl: buildSimulationUrl(),
      isSimulated: true,
    };
  }

  let phone = (params.customerPhone || "").replace(/[^0-9]/g, "");
  if (phone.length === 9) {
    phone = `+221${phone}`;
  } else if (!phone.startsWith("+") && phone.length > 9) {
    phone = `+${phone}`;
  }

  const isModernKey =
    config.apiKey.startsWith("sk_test_") || config.apiKey.startsWith("sk_live_");
  const secretKey =
    config.secretKey ||
    process.env.CINETPAY_SECRET_KEY ||
    process.env.CINETPAY_API_PASSWORD;

  if (isModernKey && secretKey && !isTest) {
    const isLive = config.apiKey.startsWith("sk_live_");
    const v1Base = isLive ? "https://api.cinetpay.co" : "https://api.cinetpay.net";

    try {
      const authRes = await fetch(`${v1Base}/v1/oauth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: config.apiKey,
          api_password: secretKey,
        }),
        signal: AbortSignal.timeout(6000),
      });

      const authData = await authRes.json().catch(() => null);

      if (authRes.ok && authData?.access_token) {
        const token = authData.access_token;
        const nameParts = (params.customerName || "Client PressiPro").trim().split(" ");
        const firstName = (nameParts[0] || "Client").slice(0, 30);
        const lastName = (nameParts.slice(1).join(" ") || "PressiPro").slice(0, 30);

        const v1Payload = {
          currency: "XOF",
          merchant_transaction_id: transactionId.slice(0, 30),
          amount: Math.round(params.amount),
          lang: "fr",
          designation: description.slice(0, 100),
          client_email: params.customerEmail || "client@pressipro.sn",
          client_first_name: firstName,
          client_last_name: lastName,
          client_phone_number: phone || "+221770000000",
          success_url: params.returnUrl,
          failed_url: params.returnUrl,
          notify_url: params.notifyUrl,
          channel: "PUSH",
        };

        const payRes = await fetch(`${v1Base}/v1/payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(v1Payload),
          signal: AbortSignal.timeout(8000),
        });

        const payData = await payRes.json().catch(() => null);

        if (payRes.ok && (payData?.payment_url || payData?.data?.payment_url)) {
          const paymentUrl = payData.payment_url || payData.data?.payment_url;
          return {
            success: true,
            transactionId,
            paymentUrl,
            paymentToken: payData.payment_token || payData.data?.payment_token,
          };
        }
      }
    } catch (v1Err) {
      console.warn(
        "[CinetPay v1 Network/Auth Warning]",
        v1Err instanceof Error ? v1Err.message : v1Err
      );
    }
  }

  const legacyPayload = {
    apikey: config.apiKey,
    site_id: config.siteId || "1",
    transaction_id: transactionId,
    amount: Math.round(params.amount),
    currency: "XOF",
    description,
    notify_url: params.notifyUrl,
    return_url: params.returnUrl,
    channels: "ALL",
    metadata: JSON.stringify(
      params.metadata || {
        orderId: params.orderId,
        orderCode: params.orderCode,
        tenantId: effectiveTenantId,
        token: params.customToken,
      }
    ),
    customer_name: params.customerName.slice(0, 30),
    customer_surname: "Client",
    customer_phone_number: phone || "+221770000000",
    customer_email: params.customerEmail || "client@pressipro.sn",
    customer_address: "Dakar",
    customer_city: "Dakar",
    customer_country: "SN",
    customer_state: "SN",
    customer_zip_code: "00221",
  };

  try {
    const res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(legacyPayload),
      signal: isTest ? undefined : AbortSignal.timeout(5000),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && (data?.code === "201" || data?.code === "200" || data?.code === 201)) {
      const paymentUrl = data?.data?.payment_url || data?.payment_url;
      const paymentToken = data?.data?.payment_token || data?.payment_token;

      if (paymentUrl) {
        return {
          success: true,
          transactionId,
          paymentUrl,
          paymentToken,
        };
      }
    }

    if (data?.description || data?.message) {
      console.warn("[CinetPay Error Response]", data);
    }
  } catch (error) {
    console.warn("[CinetPay Network Error]", error instanceof Error ? error.message : error);
  }

  if (!forceLive && (isDev || appUrl.includes("localhost") || appUrl.includes("127.0.0.1"))) {
    return {
      success: true,
      transactionId,
      paymentUrl: buildSimulationUrl(),
      isSimulated: true,
    };
  }

  return {
    success: false,
    transactionId,
    error:
      "Le service de paiement CinetPay est momentanément indisponible. Veuillez réessayer ou contacter le support.",
  };
}

export async function checkCinetPayTransaction(
  transactionId: string,
  tenantId?: string,
  options: { allowSubscriptionShortcut?: boolean } = {}
): Promise<CinetPayCheckResponse> {
  const isTest = process.env.NODE_ENV === "test";
  const forceLive =
    process.env.CINETPAY_FORCE_LIVE === "true" ||
    process.env.CINETPAY_SIMULATE === "false";
  const isSubscription = transactionId.startsWith("SUB-");

  // 1. Vérifier la transaction simulée uniquement hors production (ou si CINETPAY_SIMULATE === "true")
  if (!forceLive && isSimulationAllowedInEnv()) {
    const sim = getSimulatedTransaction(transactionId);
    if (sim) {
      return {
        success: true,
        status: sim.status,
        amount: sim.amount,
        currency: "XOF",
        paymentMethod: sim.paymentMethod,
        operatorId: "SIM-" + Date.now(),
        paymentDate: sim.date,
        transactionId,
      };
    }
  }

  // 2. Raccourci SubscriptionPayment réservé exclusivement aux vérifications d'abonnement (jamais sur une commande !)
  if (!isTest && isSubscription && options.allowSubscriptionShortcut) {
    try {
      const subRows = (await prisma.$queryRaw`
        SELECT status, "paymentMethod", "operatorId", amount
        FROM "SubscriptionPayment"
        WHERE "transactionId" = ${transactionId}
        LIMIT 1
      `) as Array<{
        status: string;
        paymentMethod: string | null;
        operatorId: string | null;
        amount: number;
      }>;

      if (subRows?.[0]?.status === "SUCCESS") {
        return {
          success: true,
          status: "ACCEPTED",
          amount: Number(subRows[0].amount),
          currency: "XOF",
          paymentMethod: subRows[0].paymentMethod || "WAVE",
          operatorId: subRows[0].operatorId || "SUB-DB",
          transactionId,
        };
      }
    } catch {
      // Continue to external check
    }
  }

  // Abonnements SaaS : toujours utiliser les clés plateforme (ignorer tenantId)
  const config = await getCinetPayConfig(isSubscription ? undefined : tenantId);

  if (!config.apiKey) {
    return {
      success: false,
      error: "Clé API CinetPay manquante pour la vérification",
    };
  }

  const payload = {
    apikey: config.apiKey,
    site_id: config.siteId || "1",
    transaction_id: transactionId,
  };

  try {
    const res = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: isTest ? undefined : AbortSignal.timeout(5000),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || (data?.code !== "00" && data?.code !== 0)) {
      return {
        success: false,
        status: data?.data?.status || "ERROR",
        error: data?.description || data?.message || "Transaction non validée",
      };
    }

    const txData = data.data;

    return {
      success: true,
      status: txData?.status as "ACCEPTED" | "REFUSED" | "PENDING",
      amount: txData?.amount ? Number(txData.amount) : undefined,
      currency: txData?.currency,
      paymentMethod: txData?.payment_method,
      operatorId: txData?.operator_id,
      paymentDate: txData?.payment_date,
      transactionId,
      metadata: txData?.metadata,
      description: txData?.description,
    };
  } catch (error) {
    console.warn("[CinetPay Check Error]", error instanceof Error ? error.message : error);

    if (process.env.NODE_ENV !== "production") {
      return {
        success: false,
        status: "PENDING",
        error: "Connexion CinetPay indisponible lors de la vérification",
      };
    }

    return {
      success: false,
      status: "ERROR",
      error: error instanceof Error ? error.message : "Erreur réseau lors du check CinetPay",
    };
  }
}

export function mapCinetPayMethod(cinetMethod?: string): "WAVE" | "OM" | "OTHER" {
  if (!cinetMethod) return "OTHER";
  const m = cinetMethod.toUpperCase();
  if (m.includes("WAVE")) return "WAVE";
  if (m.includes("OM") || m.includes("ORANGE")) return "OM";
  return "OTHER";
}
