import { Request, Response } from "express";
import * as crypto from "crypto";
import * as db from "../db";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

/**
 * Verify Paystack webhook signature
 */
function verifyPaystackSignature(payload: string, signature: string): boolean {
  if (!PAYSTACK_SECRET_KEY) {
    console.error("[Paystack Webhook] PAYSTACK_SECRET_KEY not configured");
    return false;
  }

  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest("hex");

  return hash === signature;
}

/**
 * Handle Paystack webhook events
 */
export async function handlePaystackWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    
    if (!signature) {
      console.warn("[Paystack Webhook] Missing signature header");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Get raw body as string
    const payload = JSON.stringify(req.body);
    
    // Verify signature
    if (!verifyPaystackSignature(payload, signature)) {
      console.warn("[Paystack Webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;
    console.log(`[Paystack Webhook] Received event: ${event.event}`);

    // Handle charge.success event
    if (event.event === "charge.success") {
      const { reference, amount, customer } = event.data;
      
      // Get payment record
      const payment = await db.getPaymentByReference(reference);
      if (!payment) {
        console.warn(`[Paystack Webhook] Payment not found: ${reference}`);
        return res.status(404).json({ error: "Payment not found" });
      }

      // Check if already processed
      if (payment.status === "success") {
        console.log(`[Paystack Webhook] Payment already processed: ${reference}`);
        return res.status(200).json({ message: "Already processed" });
      }

      // Update payment status
      await db.updatePayment(reference, {
        status: "success",
        paystackTransactionId: event.data.id?.toString(),
        webhookVerified: true,
        webhookReceivedAt: new Date(),
      });

      // Credit wallet
      const wallet = await db.getWalletByUserId(payment.userId);
      if (wallet) {
        const amountInNaira = amount / 100; // Paystack amount is in kobo
        await db.creditWallet(
          wallet.id,
          amountInNaira,
          `Wallet top-up via Paystack (${reference})`,
          "payment",
          String(payment.id)
        );
        console.log(`[Paystack Webhook] Credited wallet ${wallet.id} with ₦${amountInNaira}`);
      } else {
        console.error(`[Paystack Webhook] Wallet not found for user ${payment.userId}`);
      }
    }

    return res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    console.error("[Paystack Webhook] Error processing webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
