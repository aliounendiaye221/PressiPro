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
}

export interface CinetPayInitResponse {
  success: boolean;
  paymentUrl?: string;
  paymentToken?: string;
  transactionId: string;
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

/**
 * Récupère la configuration CinetPay pour un tenant donné
 * (priorité aux identifiants propres du pressing, sinon fallback sur les variables d'environnement globales)
 */
export async function getCinetPayConfig(tenantId?: string): Promise<CinetPayConfig> {
  let apiKey = process.env.CINETPAY_API_KEY || "";
  let siteId = process.env.CINETPAY_SITE_ID || "";
  let secretKey = process.env.CINETPAY_SECRET_KEY || "";
  let isEnabled = !!(apiKey && siteId);

  if (tenantId) {
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

      if (tenant?.cinetpayApiKey && tenant?.cinetpaySiteId) {
        apiKey = tenant.cinetpayApiKey;
        siteId = tenant.cinetpaySiteId;
        secretKey = tenant.cinetpaySecretKey || secretKey;
        isEnabled = tenant.cinetpayEnabled ?? true;
      } else if (tenant?.cinetpayEnabled !== undefined && tenant?.cinetpayEnabled !== null) {
        isEnabled = Boolean(tenant.cinetpayEnabled) && !!(apiKey && siteId);
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
 * Initialise un paiement CinetPay v2
 */
export async function initiateCinetPayPayment(
  params: InitiatePaymentParams
): Promise<CinetPayInitResponse> {
  const config = await getCinetPayConfig(params.tenantId);

  if (!config.apiKey) {
    return {
      success: false,
      transactionId: "",
      error: "Clé API CinetPay manquante. Veuillez la renseigner dans la configuration.",
    };
  }

  // Transaction ID
  const transactionId = generateTransactionId(params.orderCode);

  // Nettoyage du numéro de téléphone (au format international sénégalais ou local)
  let phone = (params.customerPhone || "").replace(/[^0-9]/g, "");
  if (phone.length === 9) {
    phone = `+221${phone}`;
  } else if (!phone.startsWith("+") && phone.length > 9) {
    phone = `+${phone}`;
  }

  const payload = {
    apikey: config.apiKey,
    site_id: config.siteId || "1", // Site ID par défaut si non spécifié
    transaction_id: transactionId,
    amount: Math.round(params.amount),
    currency: "XOF",
    description: `Paiement pressing ${params.tenantName} - Commande ${params.orderCode}`,
    notify_url: params.notifyUrl,
    return_url: params.returnUrl,
    channels: "ALL", // Wave, Orange Money, Free Money, Carte Bancaire
    metadata: JSON.stringify({
      orderId: params.orderId,
      orderCode: params.orderCode,
      tenantId: params.tenantId,
      token: params.customToken,
    }),
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
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || (data?.code !== "201" && data?.code !== "200" && data?.code !== 201)) {
      console.warn("[CinetPay Init Error Response]", data);
      return {
        success: false,
        transactionId,
        error: data?.description || data?.message || "Échec d'initialisation CinetPay",
      };
    }

    const paymentUrl = data?.data?.payment_url;
    const paymentToken = data?.data?.payment_token;

    if (!paymentUrl) {
      return {
        success: false,
        transactionId,
        error: "Aucune URL de paiement reçue de CinetPay",
      };
    }

    return {
      success: true,
      transactionId,
      paymentUrl,
      paymentToken,
    };
  } catch (error) {
    console.error("[CinetPay Network Error]", error);
    return {
      success: false,
      transactionId,
      error: error instanceof Error ? error.message : "Erreur de connexion CinetPay",
    };
  }
}

/**
 * Vérifie le statut d'une transaction directement auprès de CinetPay v2
 */
export async function checkCinetPayTransaction(
  transactionId: string,
  tenantId?: string
): Promise<CinetPayCheckResponse> {
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
    console.error("[CinetPay Check Error]", error);
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
