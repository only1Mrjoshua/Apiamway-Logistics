import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { devices, orders, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Bike Maintenance Workflow", () => {
  let adminCaller: any;
  let dispatcherCaller: any;
  let testDeviceId: number;
  let testOrderId: number;
  let testRiderId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Create admin caller
    adminCaller = appRouter.createCaller({
      user: { id: 1, role: "admin", openId: "test-admin", name: "Test Admin" },
    });

    // Create dispatcher caller
    dispatcherCaller = appRouter.createCaller({
      user: { id: 2, role: "dispatcher", openId: "test-dispatcher", name: "Test Dispatcher" },
    });

    // Create test device
    const [device] = await db.insert(devices).values({
      traccarDeviceId: 99999,
      name: "Test Maintenance Bike",
      label: "TEST-MAINT-01",
      status: "available",
    }).$returningId();
    testDeviceId = device.id;

    // Create test rider
    const [rider] = await db.insert(users).values({
      openId: "test-rider-maint",
      name: "Test Rider Maintenance",
      role: "user",
    }).$returningId();
    testRiderId = rider.id;

    // Create test order
    const [order] = await db.insert(orders).values({
      trackingNumber: "AP-TEST-MAINT-001",
      customerName: "Test Customer",
      customerPhone: "08012345678",
      pickupAddress: "Test Pickup",
      deliveryAddress: "Test Delivery",
      packageDescription: "Test Package",
      price: "1000.00",
      status: "pending",
    }).$returningId();
    testOrderId = order.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Cleanup
    await db.delete(orders).where(eq(orders.id, testOrderId));
    await db.delete(devices).where(eq(devices.id, testDeviceId));
    await db.delete(users).where(eq(users.id, testRiderId));
  });

  it("should set bike to maintenance with reason", async () => {
    const result = await adminCaller.devices.update({
      id: testDeviceId,
      status: "maintenance",
      maintenanceReason: "Brake repair needed",
      maintenanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    });

    expect(result.success).toBe(true);

    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const [device] = await db.select().from(devices).where(eq(devices.id, testDeviceId));
    expect(device.status).toBe("maintenance");
    expect(device.maintenanceReason).toBe("Brake repair needed");
    expect(device.maintenanceUntil).toBeTruthy();
  });

  it("should prevent assigning maintenance bike to order", async () => {
    await expect(
      dispatcherCaller.orders.assignRider({
        orderId: testOrderId,
        riderId: testRiderId,
        deviceId: testDeviceId,
      })
    ).rejects.toThrow(/maintenance/i);
  });

  it("should mark bike as available and clear maintenance info", async () => {
    const result = await adminCaller.devices.update({
      id: testDeviceId,
      status: "available",
      maintenanceReason: null,
      maintenanceUntil: null,
    });

    expect(result.success).toBe(true);

    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const [device] = await db.select().from(devices).where(eq(devices.id, testDeviceId));
    expect(device.status).toBe("available");
    expect(device.maintenanceReason).toBeNull();
    expect(device.maintenanceUntil).toBeNull();
  });

  it("should allow assigning available bike to order", async () => {
    const result = await dispatcherCaller.orders.assignRider({
      orderId: testOrderId,
      riderId: testRiderId,
      deviceId: testDeviceId,
    });

    expect(result.success).toBe(true);

    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const [order] = await db.select().from(orders).where(eq(orders.id, testOrderId));
    expect(order.deviceId).toBe(testDeviceId);
    expect(order.riderId).toBe(testRiderId);
  });

  it("should prevent assigning inactive bike to order", async () => {
    // Set bike to inactive
    await adminCaller.devices.update({
      id: testDeviceId,
      status: "inactive",
    });

    await expect(
      dispatcherCaller.orders.assignRider({
        orderId: testOrderId,
        riderId: testRiderId,
        deviceId: testDeviceId,
      })
    ).rejects.toThrow(/inactive/i);

    // Restore to available for cleanup
    await adminCaller.devices.update({
      id: testDeviceId,
      status: "available",
    });
  });
});
