/**
 * OPay Payment Integration Service
 *
 * Implements OPay's hosted/redirect checkout flow (transfer-focused).
 * The customer is redirected to OPay's hosted payment page — no credentials
 * are ever collected inside Apiamway.
 *
 * Environment variables (all optional — system falls back to Paystack-only when missing):
 *   OPAY_MERCHANT_ID    - Your OPay Merchant ID
 *   OPAY_PUBLIC_KEY     - Your OPay Public Key
 *   OPAY_SECRET_KEY     - Your OPay Secret Key (server-side only, never exposed to frontend)
 *   OPAY_BASE_URL       - API base URL (sandbox: https://sandboxapi.opayweb.com,
 *                         production: https://api.opayweb.com)
 *   OPAY_WEBHOOK_SECRET - Optional: webhook signing secret
 *
 * SECURITY NOTES:
 * - OPAY_SECRET_KEY is NEVER exposed to frontend code
 * - All payment verification happens server-side
 * - References are generated server-side to prevent tampering
 * - OPay authentication happens entirely on OPay's hosted page
 */

import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpayConfig {
  merchantId: string;
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  webhookSecret?: string;
}

export interface OpayInitializeParams {
  reference: string;
  amount: number; // Amount in kobo (NGN * 100)
  currency?: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface OpayInitializeResponse {
  code: string;
  message: string;
  data?: {
    cashierUrl: string;
    reference: string;
    orderNo?: string;
  };
}

export interface OpayVerifyResponse {
  code: string;
  message: string;
  data?: {
    reference: string;
    orderNo?: string;
    status: "SUCCESS" | "PENDING" | "FAIL" | "CLOSE";
    amount: number;
    currency: string;
    payChannel?: string;
    payTime?: string;
    failureReason?: string;
  };
}

export interface OpayWebhookPayload {
  reference: string;
  orderNo?: string;
  status: "SUCCESS" | "PENDING" | "FAIL" | "CLOSE";
  amount: number;
  currency: string;
  merchantId: string;
  payChannel?: string;
  payTime?: string;
  sign?: string;
}

export interface OpayHealthResult {
  configured: boolean;
  connected: boolean;
  mode: "sandbox" | "production" | "unknown";
  error?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Read OPay config from environment variables.
 * Returns null if any required key is missing.
 */
export function getOpayConfig(): OpayConfig | null {
  const merchantId = process.env.OPAY_MERCHANT_ID;
  const publicKey = process.env.OPAY_PUBLIC_KEY;
  const secretKey = process.env.OPAY_SECRET_KEY;
  const baseUrl = process.env.OPAY_BASE_URL;
  const webhookSecret = process.env.OPAY_WEBHOOK_SECRET;

  if (!merchantId || !publicKey || !secretKey || !baseUrl) {
    return null;
  }

  return { merchantId, publicKey, secretKey, baseUrl, webhookSecret };
}

/**
 * Check if OPay is fully configured and ready to use.
 */
export function isOpayConfigured(): boolean {
  return getOpayConfig() !== null;
}

/**
 * Get the OPay public key for frontend use (safe to expose).
 * Returns null if OPay is not configured.
 */
export function getOpayPublicKey(): string | null {
  return process.env.OPAY_PUBLIC_KEY || null;
}

// ─── Reference generation ─────────────────────────────────────────────────────

/**
 * Generate a unique OPay payment reference.
 */
export function generateOpayReference(prefix: string = "OPY"): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the OPay API.
 * OPay uses HMAC-SHA512 of the request body as the Authorization header.
 */
async function opayFetch<T>(
  config: OpayConfig,
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;
  const bodyStr = JSON.stringify(body);

  // OPay signature: HMAC-SHA512 of the JSON body, keyed by the secret key
  const signature = crypto
    .createHmac("sha512", config.secretKey)
    .update(bodyStr)
    .digest("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${signature}`,
      MerchantId: config.merchantId,
    },
    body: bodyStr,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`[OPay] API error: ${response.status}`, data);
    throw new Error(
      (data as { message?: string }).message ||
        `OPay API error: ${response.status}`
    );
  }

  return data as T;
}

// ─── Core payment operations ──────────────────────────────────────────────────

/**
 * Initialize a hosted OPay checkout session.
 * Returns a cashierUrl to redirect the customer to.
 */
export async function initializeOpayPayment(
  params: OpayInitializeParams
): Promise<OpayInitializeResponse> {
  const config = getOpayConfig();
  if (!config) {
    throw new Error(
      "OPay not configured. Set OPAY_MERCHANT_ID, OPAY_PUBLIC_KEY, OPAY_SECRET_KEY, and OPAY_BASE_URL."
    );
  }

  const payload: Record<string, unknown> = {
    merchantId: config.merchantId,
    reference: params.reference,
    amount: params.amount,
    currency: params.currency || "NGN",
    userInfo: {
      userEmail: params.email,
      userMobile: params.phone || "",
      userName: [params.firstName, params.lastName].filter(Boolean).join(" ") || "",
    },
    callbackUrl: params.callbackUrl,
    returnUrl: params.callbackUrl,
    expireAt: 30, // minutes
    payMethods: [{ payMethod: "BankTransfer" }],
    product: {
      name: "Wallet Top-up",
      description: "Apiamway Wallet Top-up",
    },
    ...(params.metadata ? { ext: JSON.stringify(params.metadata) } : {}),
  };

  return opayFetch<OpayInitializeResponse>(
    config,
    "/api/cashier/initialize",
    payload
  );
}

/**
 * Verify an OPay transaction by reference.
 */
export async function verifyOpayPayment(
  reference: string
): Promise<OpayVerifyResponse> {
  const config = getOpayConfig();
  if (!config) {
    throw new Error("OPay not configured.");
  }

  return opayFetch<OpayVerifyResponse>(config, "/api/cashier/query", {
    merchantId: config.merchantId,
    reference,
  });
}

// ─── Webhook verification ─────────────────────────────────────────────────────

/**
 * Verify an incoming OPay webhook signature.
 * OPay signs the payload body with HMAC-SHA512 using the public key.
 */
export function verifyOpayWebhookSignature(
  payload: string,
  receivedSignature: string
): boolean {
  const config = getOpayConfig();
  if (!config) {
    console.error("[OPay] Cannot verify webhook: OPay not configured");
    return false;
  }

  // OPay webhook signature uses the public key (not secret key)
  const expectedSignature = crypto
    .createHmac("sha512", config.publicKey)
    .update(payload)
    .digest("base64");

  return expectedSignature === receivedSignature;
}

/**
 * Parse and validate an OPay webhook payload.
 * Returns null if signature verification fails.
 */
export function parseOpayWebhook(
  payload: string,
  signature: string
): OpayWebhookPayload | null {
  if (!verifyOpayWebhookSignature(payload, signature)) {
    console.error("[OPay] Invalid webhook signature");
    return null;
  }

  try {
    return JSON.parse(payload) as OpayWebhookPayload;
  } catch (err) {
    console.error("[OPay] Failed to parse webhook payload:", err);
    return null;
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * Check OPay configuration and connectivity.
 */
export async function checkOpayHealth(): Promise<OpayHealthResult> {
  const config = getOpayConfig();

  if (!config) {
    return {
      configured: false,
      connected: false,
      mode: "unknown",
      error: "OPay not configured — set OPAY_MERCHANT_ID, OPAY_PUBLIC_KEY, OPAY_SECRET_KEY, and OPAY_BASE_URL",
    };
  }

  const mode: OpayHealthResult["mode"] = config.baseUrl.includes("sandbox")
    ? "sandbox"
    : config.baseUrl.includes("sandboxapi")
    ? "sandbox"
    : "production";

  // Attempt a lightweight query to verify connectivity
  try {
    // Query a non-existent reference — OPay returns a structured error (not a network error)
    const result = await verifyOpayPayment("HEALTH-CHECK-PROBE");
    // Any structured response means the API is reachable
    const connected = typeof result.code === "string";
    return { configured: true, connected, mode };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      mode,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
