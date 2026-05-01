/**
 * Weekly Payout System
 * 
 * Processes Fleet Owner payouts every Friday:
 * - Aggregates all PENDING earnings per Fleet Owner
 * - Credits Fleet Owner wallet balance
 * - Marks earnings as CREDITED
 * - Creates payout batch record for auditing
 * - Idempotent: won't double-process earnings
 */

import * as db from "./db";
import { eq, and } from "drizzle-orm";
import { partnerEarnings, partnerCompanies } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

export interface PayoutSummary {
  fleetOwnerId: number;
  fleetOwnerName: string;
  totalEarnings: number;
  orderCount: number;
  earningIds: number[];
}

export interface PayoutBatchResult {
  success: boolean;
  batchDate: Date;
  payoutsSummary: PayoutSummary[];
  totalAmount: number;
  totalOrders: number;
  totalBlocked: number;
  totalVoided: number;
  errors: string[];
}

/**
 * Process weekly payouts for all Fleet Owners
 * Should be called every Friday (or manually for testing)
 */
export async function processWeeklyPayouts(): Promise<PayoutBatchResult> {
  console.log(`[Weekly Payout] 🚀 Starting weekly payout process...`);
  
  const database = await db.getDb();
  if (!database) {
    console.log(`[Weekly Payout] ❌ Database not available`);
    return {
      success: false,
      batchDate: new Date(),
      payoutsSummary: [],
      totalAmount: 0,
      totalOrders: 0,
      totalBlocked: 0,
      totalVoided: 0,
      errors: ["Database not available"],
    };
  }

  const batchDate = new Date();
  const payoutsSummary: PayoutSummary[] = [];
  const errors: string[] = [];
  let totalAmount = 0;
  let totalOrders = 0;
  let totalBlocked = 0;   // earnings skipped due to cancelled orders
  let totalVoided = 0;    // voided earnings encountered in pending set

  try {
    // Get all pending earnings grouped by Fleet Owner
    const pendingEarnings = await database
      .select()
      .from(partnerEarnings)
      .where(eq(partnerEarnings.status, "pending"));

    console.log(`[Weekly Payout] Found ${pendingEarnings.length} pending earnings`);

      if (pendingEarnings.length === 0) {
      console.log(`[Weekly Payout] ✅ No pending earnings to process`);
      console.log(`[Payout Summary] totalPaid=0.00, processed=0, blocked=0, voided=0`);
      try {
        await notifyOwner({
          title: `Weekly Payout Complete — ${batchDate.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
          content: `No pending earnings were found for this payout run.\n\nBatch Date: ${batchDate.toISOString()}\nTotal Paid Out: ₦0.00\nEarnings Processed: 0\nEarnings Blocked (cancelled orders): 0\nVoided Earnings Encountered: 0`,
        });
      } catch (notifyErr) {
        console.warn("[Weekly Payout] notifyOwner failed (non-fatal):", notifyErr);
      }
      return {
        success: true,
        batchDate,
        payoutsSummary: [],
        totalAmount: 0,
        totalOrders: 0,
        totalBlocked: 0,
        totalVoided: 0,
        errors: [],
      };
    }

    // Group earnings by Fleet Owner
    const earningsByFleetOwner = new Map<number, typeof pendingEarnings>();
    for (const earning of pendingEarnings) {
      const existing = earningsByFleetOwner.get(earning.partnerCompanyId) || [];
      existing.push(earning);
      earningsByFleetOwner.set(earning.partnerCompanyId, existing);
    }

    console.log(`[Weekly Payout] Processing payouts for ${earningsByFleetOwner.size} Fleet Owners`);

    // Process each Fleet Owner's earnings
    for (const [fleetOwnerId, earnings] of Array.from(earningsByFleetOwner.entries())) {
      try {
        // Get Fleet Owner details
        const fleetOwner = await db.getPartnerCompanyById(fleetOwnerId);
        if (!fleetOwner) {
          const error = `Fleet Owner ${fleetOwnerId} not found`;
          console.error(`[Weekly Payout] ❌ ${error}`);
          errors.push(error);
          continue;
        }

        // Filter out earnings linked to cancelled orders before calculating payout
        const validEarnings: typeof earnings = [];
        for (const earning of earnings) {
          if (!earning.orderId) {
            // No linked order — include as-is (legacy or manual earning)
            validEarnings.push(earning);
            continue;
          }
          const linkedOrder = await db.getOrderById(earning.orderId);
          if (!linkedOrder) {
            // Order record missing — skip defensively
            console.warn(`[Payout BLOCKED] Earning ${earning.id} has no linked order record (orderId=${earning.orderId}), skipping`);
            continue;
          }
          if (linkedOrder.status === "cancelled" || linkedOrder.cancelledAt) {
            console.log(`[Payout BLOCKED] Cancelled order ${earning.orderId} skipped from weekly payout (earningId=${earning.id}, fleetOwner=${fleetOwner.name})`);
            totalBlocked++;
            continue;
          }
          // Count voided earnings encountered in the pending set (should be rare)
          if ((earning as any).status === "voided") {
            totalVoided++;
          }
          validEarnings.push(earning);
        }

        if (validEarnings.length === 0) {
          console.log(`[Weekly Payout] Fleet Owner ${fleetOwner.name} (ID: ${fleetOwnerId}): all earnings linked to cancelled orders, skipping`);
          continue;
        }

        // Calculate total payout for this Fleet Owner (valid earnings only)
        const fleetOwnerTotal = validEarnings.reduce((sum: number, e: typeof earnings[0]) => {
          return sum + Number(e.partnerAmount);
        }, 0);

        console.log(`[Weekly Payout] Processing Fleet Owner ${fleetOwner.name} (ID: ${fleetOwnerId}): ${validEarnings.length} valid orders (${earnings.length - validEarnings.length} skipped), total: ₦${fleetOwnerTotal.toFixed(2)}`);

        // Credit Fleet Owner wallet
        await db.creditPartnerBalance(fleetOwnerId, fleetOwnerTotal);
        console.log(`[Weekly Payout] ✅ Credited ₦${fleetOwnerTotal.toFixed(2)} to ${fleetOwner.name}'s wallet`);

        // Mark only valid earnings as credited (cancelled-order earnings remain pending)
        const earningIds = validEarnings.map((e: typeof earnings[0]) => e.id);
        // Update each valid earning individually to avoid touching cancelled-order earnings
        for (const earningId of earningIds) {
          await database
            .update(partnerEarnings)
            .set({
              status: "credited",
              creditedAt: batchDate,
            })
            .where(
              and(
                eq(partnerEarnings.id, earningId),
                eq(partnerEarnings.status, "pending")
              )
            );
        }

        console.log(`[Weekly Payout] ✅ Marked ${earningIds.length} earnings as credited for ${fleetOwner.name}`);

        // Add to summary
        payoutsSummary.push({
          fleetOwnerId,
          fleetOwnerName: fleetOwner.name,
          totalEarnings: fleetOwnerTotal,
          orderCount: validEarnings.length,
          earningIds,
        });

        totalAmount += fleetOwnerTotal;
        totalOrders += validEarnings.length;
      } catch (error: any) {
        const errorMsg = `Failed to process Fleet Owner ${fleetOwnerId}: ${error.message}`;
        console.error(`[Weekly Payout] ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[Weekly Payout] ✅ Batch complete: ${payoutsSummary.length} Fleet Owners paid, total: ₦${totalAmount.toFixed(2)}`);
    console.log(`[Payout Summary] totalPaid=${totalAmount.toFixed(2)}, processed=${totalOrders}, blocked=${totalBlocked}, voided=${totalVoided}`);

    // Build per-owner breakdown for notification
    const ownerLines = payoutsSummary.length > 0
      ? payoutsSummary
          .map((s) => `  • ${s.fleetOwnerName}: ₦${s.totalEarnings.toFixed(2)} (${s.orderCount} order${s.orderCount !== 1 ? "s" : ""})`)
          .join("\n")
      : "  (none)";

    const notificationContent = [
      `Batch Date: ${batchDate.toISOString()}`,
      `Total Paid Out: ₦${totalAmount.toFixed(2)}`,
      `Earnings Processed: ${totalOrders}`,
      `Earnings Blocked (cancelled orders): ${totalBlocked}`,
      `Voided Earnings Encountered: ${totalVoided}`,
      `Fleet Owners Paid: ${payoutsSummary.length}`,
      errors.length > 0 ? `Errors: ${errors.length}` : null,
      "",
      "Per-Owner Breakdown:",
      ownerLines,
    ]
      .filter((line) => line !== null)
      .join("\n");

    try {
      await notifyOwner({
        title: `Weekly Payout Complete — ${batchDate.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        content: notificationContent,
      });
    } catch (notifyErr) {
      console.warn("[Weekly Payout] notifyOwner failed (non-fatal):", notifyErr);
    }

    return {
      success: true,
      batchDate,
      payoutsSummary,
      totalAmount,
      totalOrders,
      totalBlocked,
      totalVoided,
      errors,
    };
  } catch (error: any) {
    console.error(`[Weekly Payout] ❌ Fatal error:`, error);
    return {
      success: false,
      batchDate,
      payoutsSummary,
      totalAmount,
      totalOrders,
      totalBlocked,
      totalVoided,
      errors: [error.message],
    };
  }
}

/**
 * Get payout history for a specific Fleet Owner
 */
export async function getFleetOwnerPayoutHistory(fleetOwnerId: number) {
  const database = await db.getDb();
  if (!database) return [];

  // Get all credited earnings for this Fleet Owner, grouped by creditedAt date
  const earnings = await database
    .select()
    .from(partnerEarnings)
    .where(
      and(
        eq(partnerEarnings.partnerCompanyId, fleetOwnerId),
        eq(partnerEarnings.status, "credited")
      )
    )
    .orderBy(partnerEarnings.creditedAt);

  // Group by payout date (creditedAt)
  const payoutsByDate = new Map<string, typeof earnings>();
  for (const earning of earnings) {
    if (!earning.creditedAt) continue;
    const dateKey = earning.creditedAt.toISOString().split('T')[0]; // YYYY-MM-DD
    const existing = payoutsByDate.get(dateKey) || [];
    existing.push(earning);
    payoutsByDate.set(dateKey, existing);
  }

  // Convert to array of payout batches
  return Array.from(payoutsByDate.entries()).map(([date, earnings]) => ({
    payoutDate: date,
    orderCount: earnings.length,
    totalAmount: earnings.reduce((sum, e) => sum + Number(e.partnerAmount), 0),
    earnings,
  }));
}

/**
 * Get pending earnings for a specific Fleet Owner (not yet paid out)
 */
export async function getFleetOwnerPendingEarnings(fleetOwnerId: number) {
  const database = await db.getDb();
  if (!database) return { earnings: [], totalPending: 0 };

  const earnings = await database
    .select()
    .from(partnerEarnings)
    .where(
      and(
        eq(partnerEarnings.partnerCompanyId, fleetOwnerId),
        eq(partnerEarnings.status, "pending")
      )
    );

  const totalPending = earnings.reduce((sum, e) => sum + Number(e.partnerAmount), 0);

  return {
    earnings,
    totalPending,
  };
}
