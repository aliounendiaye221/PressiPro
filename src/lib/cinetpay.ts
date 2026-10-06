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
  tenantId: string;
  tenantName: string;
  returnUrl: string;
  notifyUrl: string;
  customToken?: string;
  transactionId?: string;
  description?: string;
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
}

// Registre des paiements de simulation (utile en dev ou quand la passerelle externe est hors ligne)
const simulatedTransactions = new Map<string, SimulatedTransaction>();

export function registerSimulatedTransaction(data: SimulatedTransaction) {
  simulatedTransactions.set(data.transactionId, data);
}

export function getSimulatedTransaction(txId: string): SimulatedTransaction | undefined {
  return simulatedTransactions.get(txId);
}

/**
 * Récupère la configuration CinetPay pour un tenant donné
 * (priorité aux identifiants propres du pressing, sinon fallback sur les variables d'environnement globales)
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
 * Génère un identifiant de transaction CinetPay unique et traçable
 */
export function generateTransactionId(orderCode: string): string {
  // Format alphanumérique court et conforme CinetPay (ex: PPO-P00123-1712345678)
  const cleanCode = orderCode.replace(/[^a-zA-Z0-9]/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  const timestamp = Date.now().toString().slice(-6);
  return `PPO-${cleanCode}-${timestamp}${rand}`;
}

/**
 * Initialise un paiement CinetPay (avec support API moderne v1, API v2 legacy et passerelle de simulation)
 */
export async function initiateCinetPayPayment(
  params: InitiatePaymentParams
): Promise<CinetPayInitResponse> {
  const config = await getCinetPayConfig(params.tenantId);
  const isTest = process.env.NODE_ENV === "test";
  const forceLive = process.env.CINETPAY_FORCE_LIVE === "true" || process.env.CINETPAY_SIMULATE === "false";
  const isDev = process.env.NODE_ENV !== "production" && !isTest && !forceLive;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Identifiant de transaction unique
  const transactionId = params.transactionId || generateTransactionId(params.orderCode);

  const description =
    params.description || `Paiement pressing ${params.tenantName} - Commande ${params.orderCode}`;

  const buildSimulationUrl = () => {
    try {
      const url = new URL("/checkout/simulate", appUrl);
      url.searchParams.set("tx", transactionId);
      url.searchParams.set("amount", Math.round(params.amount).toString());
      url.searchParams.set("desc", description);
      url.searchParams.set("returnUrl", params.returnUrl);
      url.searchParams.set("notifyUrl", params.notifyUrl);
      url.searchParams.set("customerName", params.customerName || "Client");
      if (params.customerPhone) {
        url.searchParams.set("customerPhone", params.customerPhone);
      }
      return url.toString();
    } catch {
      return `/checkout/simulate?tx=${encodeURIComponent(transactionId)}&amount=${Math.round(params.amount)}&returnUrl=${encodeURIComponent(params.returnUrl)}&notifyUrl=${encodeURIComponent(params.notifyUrl)}`;
    }
  };

  // Clé manquante
  if (!config.apiKey) {
    if (isDev) {
      console.info("[CinetPay] Aucune clé API configurée. Utilisation du guichet de simulation local.");
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

  // Si la simulation n'est pas forcée et qu'on est en forceLive
  if (forceLive && config.apiKey.startsWith("sk_") && !config.secretKey) {
    return {
      success: false,
      transactionId,
      error: "Pour le mode opérationnel avec une clé CinetPay (sk_...), vous devez également renseigner le mot de passe d'API (CINETPAY_SECRET_KEY).",
    };
  }

  // Force simulation mode if flag is enabled
  if (process.env.CINETPAY_SIMULATE === "true") {
    return {
      success: true,
      transactionId,
      paymentUrl: buildSimulationUrl(),
      isSimulated: true,
    };
  }

  // Nettoyage du numéro de téléphone
  let phone = (params.customerPhone || "").replace(/[^0-9]/g, "");
  if (phone.length === 9) {
    phone = `+221${phone}`;
  } else if (!phone.startsWith("+") && phone.length > 9) {
    phone = `+${phone}`;
  }

  // 1. Essai avec l'API moderne CinetPay v1 (si clé de type sk_test_ ou sk_live_ avec secretKey et pas en test unitaire)
  const isModernKey = config.apiKey.startsWith("sk_test_") || config.apiKey.startsWith("sk_live_");
  const secretKey = config.secretKey || process.env.CINETPAY_SECRET_KEY || process.env.CINETPAY_API_PASSWORD;

  if (isModernKey && secretKey && !isTest) {
    const isLive = config.apiKey.startsWith("sk_live_");
    const v1Base = isLive ? "https://api.cinetpay.co" : "https://api.cinetpay.net";

    try {
      // Login OAuth
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
          client_email: params.customerEmail || "client@pressipro.tech",
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
      console.warn("[CinetPay v1 Network/Auth Warning]", v1Err instanceof Error ? v1Err.message : v1Err);
      // Fall through to legacy / simulation fallback
    }
  }

  // 2. Appel passerelle v2 / checkout standard (ou mock dans les tests unitaires)
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
        tenantId: params.tenantId,
        token: params.customToken,
      }
    ),
    customer_name: params.customerName.slice(0, 30),
    customer_surname: "Client",
    customer_phone_number: phone || "+221770000000",
    customer_email: params.customerEmail || "client@pressipro.tech",
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

  // 3. Fallback de résilience : si l'API externe est inaccessible (DNS ENOTFOUND, Timeout, ou Dev) et pas de forceLive
  if (!forceLive && (isDev || appUrl.includes("localhost") || appUrl.includes("127.0.0.1"))) {
    console.info(`[CinetPay] Redirection vers le guichet de simulation local (${transactionId})`);
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
    error: "Le service de paiement CinetPay est momentanément indisponible. Veuillez réessayer ou contacter le support.",
  };
}

/**
 * Vérifie le statut d'une transaction directement auprès de CinetPay ou du simulateur
 */
export async function checkCinetPayTransaction(
  transactionId: string,
  tenantId?: string
): Promise<CinetPayCheckResponse> {
  const isTest = process.env.NODE_ENV === "test";
  const forceLive = process.env.CINETPAY_FORCE_LIVE === "true" || process.env.CINETPAY_SIMULATE === "false";

  // 1. Vérifier si c'est une transaction simulée en mémoire (uniquement si pas forceLive)
  if (!forceLive) {
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

  // 2. Vérifier si l'enregistrement en base existe déjà avec statut SUCCESS (sauf en test unitaire)
  if (!isTest) {
    try {
      const isSub = transactionId.startsWith("SUB-");
      if (isSub) {
        const subRows = (await prisma.$queryRaw`
          SELECT status, "paymentMethod", "operatorId", amount FROM "SubscriptionPayment" WHERE "transactionId" = ${transactionId} LIMIT 1
        `) as Array<{ status: string; paymentMethod: string | null; operatorId: string | null; amount: number }>;

        if (subRows?.[0]?.status === "SUCCESS") {
          return {
            success: true,
            status: "ACCEPTED",
            amount: Number(subRows[0].amount),
            currency: "XOF",
            paymentMethod: subRows[0].paymentMethod || "WAVE",
            operatorId: subRows[0].operatorId || "SIM-DB",
            transactionId,
          };
        }
      }
    } catch {
      // Ignore DB error and continue to external check
    }
  }

  const config = await getCinetPayConfig(tenantId);

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
      transactionId: transactionId,
      metadata: txData?.metadata,
      description: txData?.description,
    };
  } catch (error) {
    console.warn("[CinetPay Check Error]", error instanceof Error ? error.message : error);

    // En environnement de test ou développement, si la vérification réseau échoue
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

/**
 * Mappe le code de méthode CinetPay vers le PaymentMethod de PressiPro
 */
export function mapCinetPayMethod(cinetMethod?: string): "WAVE" | "OM" | "OTHER" {
  if (!cinetMethod) return "OTHER";
  const m = cinetMethod.toUpperCase();
  if (m.includes("WAVE")) return "WAVE";
  if (m.includes("OM") || m.includes("ORANGE")) return "OM";
  return "OTHER";
}
