/**
 * Device Status Synchronization
 * 
 * Automatically updates device status based on order lifecycle events.
 * Ensures devices reflect their real-world state (available vs in_transit).
 */

import { getDb } from "./db";
import { devices } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type OrderStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "delivered" | "failed" | "returned" | "cancelled";
type DeviceStatus = "available" | "in_transit" | "maintenance" | "inactive";

/**
 * Sync device status based on order status change.
 * 
 * Rules:
 * - ASSIGNED/PICKED_UP/IN_TRANSIT → device.status = "in_transit"
 * - DELIVERED/CANCELLED/FAILED → device.status = "available"
 * - Idempotent: skips update if device already has correct status
 * - Safe: skips if no deviceId
 * 
 * @param deviceId - Device ID from order (nullable)
 * @param newOrderStatus - New order status
 */
export async function syncDeviceStatus(deviceId: number | null, newOrderStatus: OrderStatus): Promise<void> {
  // Skip if no device assigned
  if (!deviceId) {
    console.log(`[DeviceSync] No deviceId provided, skipping status sync`);
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn(`[DeviceSync] Database not available, skipping status sync for device ${deviceId}`);
    return;
  }

  // Determine target device status based on order status
  let targetStatus: DeviceStatus | null = null;

  if (["assigned", "picked_up", "in_transit"].includes(newOrderStatus)) {
    targetStatus = "in_transit";
  } else if (["delivered", "cancelled", "failed"].includes(newOrderStatus)) {
    targetStatus = "available";
  }

  // No status change needed for pending/returned
  if (!targetStatus) {
    console.log(`[DeviceSync] Order status "${newOrderStatus}" does not require device status change`);
    return;
  }

  // Fetch current device status
  const deviceRows = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
  const device = deviceRows[0];

  if (!device) {
    console.warn(`[DeviceSync] Device ${deviceId} not found, skipping status sync`);
    return;
  }

  // Idempotent: skip if already correct
  if (device.status === targetStatus) {
    console.log(`[DeviceSync] Device ${deviceId} already has status "${targetStatus}", skipping update`);
    return;
  }

  // Update device status
  await db.update(devices).set({ status: targetStatus }).where(eq(devices.id, deviceId));
  console.log(`[DeviceSync] Device ${deviceId} status updated: "${device.status}" → "${targetStatus}" (order status: ${newOrderStatus})`);
}
