/**
 * Paystack Payment Integration Service
 * 
 * This module provides secure integration with Paystack for payment processing.
 * 
 * Environment variables required:
 *   PAYSTACK_SECRET_KEY - Your Paystack secret key (sk_live_xxx or sk_test_xxx)
 *   PAYSTACK_PUBLIC_KEY - Your Paystack public key (pk_live_xxx or pk_test_xxx)
 * 
 * SECURITY NOTES:
 * - Secret key is NEVER exposed to frontend code
 * - All payment verification happens server-side via webhook
 * - References are generated server-side to prevent tampering
 */

import crypto from "crypto";

// Types for Paystack API
export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: Record<string, any>;
    fees: number;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: Record<string, any>;
    };
  };
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: Record<string, any>;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
  };
}

/**
 * Get Paystack configuration from environment variables
 */
function getPaystackConfig() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY;
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  
  return { secretKey, publicKey, webhookSecret };
}

/**
 * Check if Paystack is configured
 */
export function isPaystackConfigured(): boolean {
  const config = getPaystackConfig();
  return !!config.secretKey;
}

/**
 * Get public key for frontend (safe to expose)
 */
export function getPublicKey(): string | null {
  const config = getPaystackConfig();
  return config.publicKey || null;
}

/**
 * Generate a unique payment reference
 */
export function generateReference(prefix: string = "API"): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Make authenticated request to Paystack API
 */
async function paystackFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getPaystackConfig();
  
  if (!config.secretKey) {
    throw new Error("Paystack not configured. Set PAYSTACK_SECRET_KEY environment variable.");
  }
  
  const url = `https://api.paystack.co${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.secretKey}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error(`Paystack API error: ${response.status}`, data);
    throw new Error(data.message || `Paystack API error: ${response.status}`);
  }
  
  return data as T;
}

/**
 * Initialize a payment transaction
 */
export async function initializePayment(params: {
  email: string;
  amount: number; // Amount in kobo (NGN * 100)
  reference?: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
}): Promise<PaystackInitializeResponse> {
  const reference = params.reference || generateReference();
  
  return paystackFetch<PaystackInitializeResponse>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      reference,
      metadata: params.metadata,
      callback_url: params.callbackUrl,
    }),
  });
}

/**
 * Verify a payment transaction
 */
export async function verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
  return paystackFetch<PaystackVerifyResponse>(`/transaction/verify/${reference}`);
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const config = getPaystackConfig();
  
  if (!config.secretKey) {
    console.error("Cannot verify webhook: Paystack not configured");
    return false;
  }
  
  const hash = crypto
    .createHmac("sha512", config.secretKey)
    .update(payload)
    .digest("hex");
  
  return hash === signature;
}

/**
 * Parse and validate webhook event
 */
export function parseWebhookEvent(
  payload: string,
  signature: string
): PaystackWebhookEvent | null {
  if (!verifyWebhookSignature(payload, signature)) {
    console.error("Invalid webhook signature");
    return null;
  }
  
  try {
    return JSON.parse(payload) as PaystackWebhookEvent;
  } catch (error) {
    console.error("Failed to parse webhook payload:", error);
    return null;
  }
}

/**
 * Health check for Paystack connection
 */
export async function checkPaystackHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  mode: "live" | "test" | "unknown";
  error?: string;
}> {
  const config = getPaystackConfig();
  
  if (!config.secretKey) {
    return {
      configured: false,
      connected: false,
      mode: "unknown",
      error: "Paystack not configured",
    };
  }
  
  // Determine mode from key prefix
  const mode = config.secretKey.startsWith("sk_live_") ? "live" : 
               config.secretKey.startsWith("sk_test_") ? "test" : "unknown";
  
  try {
    // Make a simple API call to verify connection
    await paystackFetch("/balance");
    return {
      configured: true,
      connected: true,
      mode,
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      mode,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
