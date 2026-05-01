/**
 * Order Settlement & Fleet Owner Earnings Calculation
 * 
 * Business Model:
 * - Fleet Owners earn the FULL trip revenue
 * - Apiamway deducts a commission for fleet management/dispatch/tracking/payments
 * - Fleet Owner Payout = Order Amount - Apiamway Commission
 * - Earnings are marked as PENDING_PAYOUT until Friday weekly payout
 * 
 * Handles automatic calculation and wallet crediting when order is DELIVERED.
 */

import * as db from "./db";
import { eq } from "drizzle-orm";
import { orders, partnerCompanies, partnerEarnings } from "../drizzle/schema";

export interface CommissionCalculation {
  grossAmount: number;
  apiamwayCommission: number;
  fleetOwnerPayout: number; // What Fleet Owner receives
  commissionType: "percentage" | "flat";
  commissionValue: number; // Apiamway's commission amount/percentage
}

/**
 * Calculate Fleet Owner payout and Apiamway commission
 * 
 * Business Model:
 * - Fleet Owner gets: Order Amount - Apiamway Commission
 * - Apiamway gets: Commission (percentage or flat)
 * 
 * Note: The commissionValue field in DB currently represents Fleet Owner's share (legacy).
 * We interpret it correctly here: if commissionValue=70%, Fleet Owner gets 70%, Apiamway gets 30%.
 */
export function calculateCommission(
  orderAmount: number,
  commissionType: "percentage" | "flat",
  commissionValue: number
): CommissionCalculation {
  let apiamwayCommission: number;
  let fleetOwnerPayout: number;

  if (commissionType === "percentage") {
    // Validate percentage bounds (0-100)
    if (commissionValue < 0 || commissionValue > 100) {
      throw new Error(`Invalid commission percentage: ${commissionValue}. Must be between 0 and 100.`);
    }
    
    // commissionValue represents Fleet Owner's share (e.g., 70%)
    // Fleet Owner gets commissionValue%, Apiamway gets the rest
    fleetOwnerPayout = (orderAmount * commissionValue) / 100;
    apiamwayCommission = orderAmount - fleetOwnerPayout;
  } else {
    // Flat commission - Apiamway takes fixed amount, Fleet Owner gets rest
    // Validate flat commission bounds (0 to order amount)
    if (commissionValue < 0 || commissionValue > orderAmount) {
      throw new Error(`Invalid flat commission: ${commissionValue}. Must be between 0 and ${orderAmount}.`);
    }
    
    apiamwayCommission = commissionValue;
    fleetOwnerPayout = orderAmount - commissionValue;
  }

  return {
    grossAmount: orderAmount,
    apiamwayCommission: Number(apiamwayCommission.toFixed(2)),
    fleetOwnerPayout: Number(fleetOwnerPayout.toFixed(2)),
    commissionType,
    commissionValue,
  };
}

/**
 * Process order settlement when order is marked as DELIVERED
 * 
 * Rules:
 * - Resolves partner ownership via assigned rider's partnerCompanyId
 * - Only runs if rider belongs to a partner (rider.partnerCompanyId exists)
 * - Only runs if payment is confirmed (paymentStatus = 'paid')
 * - Idempotent: won't double-credit (uses unique orderId constraint)
 * - Works even if partner is suspended (settlement still happens)
 */
export async function processOrderSettlement(orderId: number): Promise<{
  success: boolean;
  message: string;
  settlement?: CommissionCalculation;
}> {
  console.log(`[Settlement DEBUG] Starting settlement for order ${orderId}`);
  
  const database = await db.getDb();
  if (!database) {
    console.log(`[Settlement DEBUG] Database not available`);
    return { success: false, message: "Database not available" };
  }

  // Get the order
  const order = await db.getOrderById(orderId);
  if (!order) {
    console.log(`[Settlement DEBUG] Order ${orderId} not found`);
    return { success: false, message: "Order not found" };
  }
  
  console.log(`[Settlement DEBUG] Order ${orderId} data:`, {
    status: order.status,
    paymentStatus: order.paymentStatus,
    settlementStatus: order.settlementStatus,
    riderId: order.riderId,
    deviceId: order.deviceId,
    partnerCompanyId: order.partnerCompanyId,
    price: order.price
  });

  // GUARD 1: Block settlement for cancelled orders (status check)
  if (order.status === "cancelled") {
    console.log(`[Settlement BLOCKED] Order ${orderId} is cancelled — settlement will not run`);
    return { success: false, message: "Settlement blocked: order is cancelled" };
  }

  // GUARD 2: Block settlement if cancelledAt is set (timestamp check — defence-in-depth)
  if (order.cancelledAt) {
    console.log(`[Settlement BLOCKED] Order ${orderId} has cancelledAt=${order.cancelledAt.toISOString()} — settlement will not run`);
    return { success: false, message: "Settlement blocked: order has a cancellation timestamp" };
  }

  // Check if order is delivered
  if (order.status !== "delivered") {
    console.log(`[Settlement DEBUG] Order ${orderId} status is ${order.status}, not delivered`);
    return { success: false, message: "Order is not delivered yet" };
  }

  // Check if payment is confirmed
  if (order.paymentStatus !== "paid") {
    console.log(`[Settlement DEBUG] Order ${orderId} payment status is ${order.paymentStatus}, not paid`);
    return { success: false, message: "Payment not confirmed. Settlement blocked until payment is confirmed." };
  }

  // Check if already settled (idempotency)
  if (order.settlementStatus === "settled") {
    console.log(`[Settlement DEBUG] Order ${orderId} already settled`);
    return { success: false, message: "Order already settled" };
  }

  // CRITICAL: Resolve partner via assigned rider (not order.partnerCompanyId)
  // This ensures settlement works when rider is assigned to partner
  if (!order.riderId) {
    console.log(`[Settlement DEBUG] Order ${orderId} has no riderId assigned`);
    return { success: false, message: "No rider assigned to order. Cannot determine partner ownership." };
  }
  
  console.log(`[Settlement DEBUG] Order ${orderId} has riderId: ${order.riderId}`);

  // Get the assigned rider
  const rider = await db.getRiderById(order.riderId);
  if (!rider) {
    console.log(`[Settlement DEBUG] Rider ${order.riderId} not found in database`);
    return { success: false, message: "Assigned rider not found" };
  }
  
  console.log(`[Settlement DEBUG] Rider ${order.riderId} data:`, {
    id: rider.id,
    name: rider.name,
    partnerCompanyId: rider.partnerCompanyId,
    fleetType: rider.fleetType,
    status: rider.status
  });

  // Check if rider belongs to a partner
  if (!rider.partnerCompanyId) {
    console.log(`[Settlement DEBUG] Rider ${order.riderId} has no partnerCompanyId (Apiamway-owned)`);
    return { success: false, message: "Rider is Apiamway-owned. No partner settlement needed." };
  }
  
  console.log(`[Settlement DEBUG] Rider ${order.riderId} belongs to partner ${rider.partnerCompanyId}`);

  // Get partner company details via rider
  const partner = await db.getPartnerCompanyById(rider.partnerCompanyId);
  if (!partner) {
    console.log(`[Settlement DEBUG] Partner ${rider.partnerCompanyId} not found in database`);
    return { success: false, message: "Partner company not found" };
  }
  
  console.log(`[Settlement DEBUG] Partner ${rider.partnerCompanyId} data:`, {
    id: partner.id,
    name: partner.name,
    commissionType: partner.commissionType,
    commissionValue: partner.commissionValue,
    status: partner.status,
    balance: partner.balance
  });

  try {
    // Calculate commission
    const orderAmount = Number(order.price);
    const commissionValue = Number(partner.commissionValue);
    console.log(`[Settlement DEBUG] Calculating commission: orderAmount=${orderAmount}, type=${partner.commissionType}, value=${commissionValue}`);
    
    const calculation = calculateCommission(
      orderAmount,
      partner.commissionType,
      commissionValue
    );
    
    console.log(`[Settlement DEBUG] Commission calculated:`, calculation);

    // Check if settlement already exists (double-check for idempotency)
    const existingSettlement = await db.getPartnerEarningByOrderId(orderId);
    if (existingSettlement) {
      // IDEMPOTENCY WARNING: reaching here means status=delivered passed the top guards,
      // but cancelledAt could have been set between the guard check and this point
      // (race condition). Log a warning so ops can investigate; do NOT reverse.
      if (order.cancelledAt) {
        console.warn(`[Settlement WARNING] Cancelled order ${orderId} had prior settlement (earningId=${existingSettlement.id}). No reversal will occur — financial records preserved.`);
      } else {
        console.log(`[Settlement DEBUG] Settlement record already exists for order ${orderId}`);
      }
      return { success: false, message: "Settlement record already exists" };
    }
    
    console.log(`[Settlement DEBUG] No existing settlement found, proceeding to create...`);

    // Create Fleet Owner earning record (using rider's partner)
    // Status: pending_payout (will be paid out on Friday)
    console.log(`[Settlement DEBUG] Creating Fleet Owner earning record...`);
    await db.createPartnerEarning({
      partnerCompanyId: rider.partnerCompanyId,
      orderId: orderId,
      orderPrice: order.price,
      commissionPercentage: partner.commissionType === "percentage" ? partner.commissionValue : "0",
      partnerAmount: calculation.fleetOwnerPayout.toString(),
      apiamwayAmount: calculation.apiamwayCommission.toString(),
      status: "pending", // Changed from "credited" to "pending" (awaiting Friday payout)
      creditedAt: null, // Will be set when payout is processed
    });
    console.log(`[Settlement DEBUG] Fleet Owner earning record created with status=pending`);

    // DO NOT credit wallet immediately - earnings accumulate until Friday payout
    // The weekly payout job will aggregate all pending earnings and credit wallet
    console.log(`[Settlement DEBUG] Fleet Owner ${rider.partnerCompanyId} will receive ${calculation.fleetOwnerPayout} on Friday payout`);

    // Update order settlement status
    console.log(`[Settlement DEBUG] Updating order ${orderId} settlement status to 'settled'`);
    await database
      .update(orders)
      .set({ settlementStatus: "settled" })
      .where(eq(orders.id, orderId));
    console.log(`[Settlement DEBUG] Order settlement status updated`);

    console.log(`[Settlement DEBUG] ✅ Settlement completed successfully for order ${orderId}`);
    return {
      success: true,
      message: "Settlement completed successfully",
      settlement: calculation,
    };
  } catch (error: any) {
    console.error(`[Settlement DEBUG] ❌ Settlement failed for order ${orderId}:`, error);
    // Mark settlement as failed
    await database
      .update(orders)
      .set({ settlementStatus: "failed" })
      .where(eq(orders.id, orderId));

    return {
      success: false,
      message: `Settlement failed: ${error.message}`,
    };
  }
}

/**
 * Hook to be called when order status changes to DELIVERED
 * This should be called from the order status update endpoint
 */
export async function onOrderDelivered(orderId: number): Promise<void> {
  console.log(`[Settlement] 🔔 onOrderDelivered called for order ${orderId}`);
  const result = await processOrderSettlement(orderId);
  
  if (!result.success) {
    console.log(`[Settlement] Order ${orderId}: ${result.message}`);
  } else {
    console.log(`[Settlement] Order ${orderId} settled: Fleet Owner earns ${result.settlement?.fleetOwnerPayout}, Apiamway earns ${result.settlement?.apiamwayCommission}`);
  }
}
