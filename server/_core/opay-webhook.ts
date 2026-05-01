/**
 * OPay Webhook Handler
 *
 * Endpoint: POST /api/webhooks/opay
 *
 * OPay sends a POST with JSON body and an Authorization header containing
 * an HMAC-SHA512 signature of the raw request body, signed with the merchant's
 * PUBLIC key (not secret key — this is OPay's convention for webhooks).
 *
 * This handler:
 * 1. Verifies the signature using verifyOpayWebhookSignature()
 * 2. Looks up the payment record by reference
 * 3. If status is SUCCESS and payment is not already credited → credits wallet
 * 4. Is fully idempotent — repeated deliveries are silently ignored
 *
 * The redirect-verify flow (trpc.payments.verifyOpay) continues to work
 * independently as a fallback for cases where the webhook is delayed or missed.
 */

import { Request, Response } from "express";
import { verifyOpayWebhookSignature, type OpayWebhookPayload } from "../opay";
import * as db from "../db";

/**
 * Handle OPay webhook events.
 * Must be registered BEFORE express.json() so we receive the raw body string.
 */
export async function handleOpayWebhook(req: Request, res: Response) {
  try {
    // Raw body is attached by the express.raw() middleware registered for this route
    const rawBody: Buffer | undefined = (req as any).rawBody;
    const payload = rawBody ? rawBody.toString("utf8") : JSON.stringify(req.body);

    console.log("[OPAY WEBHOOK] received");

    // OPay sends the signature in the Authorization header as "Bearer <base64sig>"
    const authHeader = req.headers["authorization"] as string | undefined;
    const signature = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : (req.headers["x-opay-signature"] as string | undefined) ?? "";

    if (!signature) {
      console.warn("[OPAY WEBHOOK] signature invalid — missing Authorization header");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Verify HMAC-SHA512 signature
    if (!verifyOpayWebhookSignature(payload, signature)) {
      console.warn("[OPAY WEBHOOK] signature invalid — HMAC mismatch");
      return res.status(401).json({ error: "Invalid signature" });
    }

    let event: OpayWebhookPayload;
    try {
      event = JSON.parse(payload) as OpayWebhookPayload;
    } catch {
      console.warn("[OPAY WEBHOOK] failed to parse JSON payload");
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { reference, status, amount } = event;

    if (!reference) {
      console.warn("[OPAY WEBHOOK] missing reference in payload");
      return res.status(400).json({ error: "Missing reference" });
    }

    // Look up the payment record
    const payment = await db.getPaymentByReference(reference);
    if (!payment) {
      console.warn(`[OPAY WEBHOOK] unknown reference: ${reference}`);
      // Return 200 so OPay does not keep retrying for unknown references
      return res.status(200).json({ message: "Reference not found — ignored" });
    }

    // Idempotency: if already successfully credited, skip
    if (payment.status === "success") {
      console.log(`[OPAY WEBHOOK] duplicate ignored — ${reference} already processed`);
      return res.status(200).json({ message: "Already processed" });
    }

    // Only credit on SUCCESS status
    if (status !== "SUCCESS") {
      console.log(`[OPAY WEBHOOK] non-success status "${status}" for ${reference} — no action`);
      // Update payment status to reflect the terminal state
      if (status === "FAIL" || status === "CLOSE") {
        await db.updatePayment(reference, {
          status: "failed",
          webhookVerified: true,
          webhookReceivedAt: new Date(),
        });
      }
      return res.status(200).json({ message: "Non-success status acknowledged" });
    }

    // Mark payment as successful
    await db.updatePayment(reference, {
      status: "success",
      webhookVerified: true,
      webhookReceivedAt: new Date(),
    });

    // Credit the wallet
    const wallet = await db.getWalletByUserId(payment.userId);
    if (wallet) {
      // OPay amount is in kobo (NGN * 100), same as Paystack
      const amountInNaira = amount / 100;
      await db.creditWallet(
        wallet.id,
        amountInNaira,
        `Wallet top-up via OPay (${reference})`,
        "payment",
        String(payment.id)
      );
      console.log(
        `[OPAY WEBHOOK] payment confirmed — credited wallet ${wallet.id} with ₦${amountInNaira} (ref: ${reference})`
      );
    } else {
      console.error(
        `[OPAY WEBHOOK] wallet not found for user ${payment.userId} (ref: ${reference})`
      );
    }

    return res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    console.error("[OPAY WEBHOOK] unhandled error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
