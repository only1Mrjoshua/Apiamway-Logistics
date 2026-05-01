import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { devices, riders, orders } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Device Status Sync", () => {
  let adminCaller: ReturnType<typeof appRouter.createCaller>;
  let testDeviceId: number;
  let testRiderId: number;
  let testOrderId: number;

  beforeAll(async () => {
    // Create admin context and caller
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-admin",
        name: "Test Admin",
        email: "admin@test.com",
        role: "admin",
        loginMethod: "oauth",
        createdAt: new Date(),
        updatedAt: new Date(),
        phone: null,
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    };
    adminCaller = appRouter.createCaller(ctx);

    // Create test rider
    const rider = await db.createRider({
      name: "Test Rider",
      phone: "08012345678",
      email: "rider@test.com",
      licenseNumber: "LIC123",
    });
    testRiderId = rider!.id;

    // Create test device
    const device = await db.createDevice({
      name: "Test Bike",
      traccarDeviceId: 99999,
      status: "available",
    });
    testDeviceId = device!.id;

    // Create test order
    const order = await db.createOrder({
      trackingNumber: "TEST-SYNC-001",
      customerName: "Test Customer",
      customerPhone: "08012345678",
      customerEmail: "customer@test.com",
      pickupAddress: "123 Test St",
      deliveryAddress: "456 Test Ave",
      serviceType: "intra-city",
      price: "1000",
      status: "pending",
    });
    testOrderId = order!.id;
  });

  afterAll(async () => {
    // Cleanup
    const dbInstance = await db.getDb();
    if (!dbInstance) return;

    if (testOrderId) {
      await dbInstance.delete(orders).where(eq(orders.id, testOrderId));
    }
    if (testDeviceId) {
      await dbInstance.delete(devices).where(eq(devices.id, testDeviceId));
    }
    if (testRiderId) {
      await dbInstance.delete(riders).where(eq(riders.id, testRiderId));
    }
  });

  it("should set device status to in_transit when order is assigned", async () => {
    // Assign rider and device to order
    await adminCaller.orders.assignRider({
      orderId: testOrderId,
      riderId: testRiderId,
      deviceId: testDeviceId,
    });

    // Check device status
    const device = await db.getDeviceById(testDeviceId);
    expect(device?.status).toBe("in_transit");
  });

  it("should set device status to in_transit when order status changes to picked_up", async () => {
    // Update order status to picked_up
    await adminCaller.orders.updateStatus({
      orderId: testOrderId,
      status: "picked_up",
    });

    // Check device status
    const device = await db.getDeviceById(testDeviceId);
    expect(device?.status).toBe("in_transit");
  });

  it("should set device status to in_transit when order status changes to in_transit", async () => {
    // Update order status to in_transit
    await adminCaller.orders.updateStatus({
      orderId: testOrderId,
      status: "in_transit",
    });

    // Check device status
    const device = await db.getDeviceById(testDeviceId);
    expect(device?.status).toBe("in_transit");
  });

  it("should set device status to available when order is delivered", async () => {
    // Update order status to delivered
    await adminCaller.orders.updateStatus({
      orderId: testOrderId,
      status: "delivered",
    });

    // Check device status
    const device = await db.getDeviceById(testDeviceId);
    expect(device?.status).toBe("available");
  });

  it("should set device status to available when order is cancelled", async () => {
    // First set back to in_transit
    await adminCaller.orders.updateStatus({
      orderId: testOrderId,
      status: "in_transit",
    });

    // Then cancel
    await adminCaller.orders.updateStatus({
      orderId: testOrderId,
      status: "failed",
    });

    // Check device status
    const device = await db.getDeviceById(testDeviceId);
    expect(device?.status).toBe("available");
  });

  it("should be idempotent - skip update if device already has correct status", async () => {
    // Set order to delivered (device should be available)
    await adminCaller.orders.updateStatus({
      orderId: testOrderId,
      status: "delivered",
    });

    const deviceBefore = await db.getDeviceById(testDeviceId);
    expect(deviceBefore?.status).toBe("available");

    // Update order status to delivered again (should not crash or error)
    await adminCaller.orders.updateStatus({
      orderId: testOrderId,
      status: "delivered",
    });

    const deviceAfter = await db.getDeviceById(testDeviceId);
    expect(deviceAfter?.status).toBe("available");
  });

  it("should handle orders without deviceId gracefully", async () => {
    // Create order without device
    const orderWithoutDevice = await db.createOrder({
      trackingNumber: "TEST-NO-DEVICE",
      customerName: "Test Customer",
      customerPhone: "08012345678",
      customerEmail: "customer@test.com",
      pickupAddress: "123 Test St",
      deliveryAddress: "456 Test Ave",
      serviceType: "intra-city",
      price: "1000",
      status: "pending",
    });

    // Update status (should not crash)
    await adminCaller.orders.updateStatus({
      orderId: orderWithoutDevice!.id,
      status: "delivered",
    });

    // Cleanup
    const dbInstance = await db.getDb();
    if (dbInstance) {
      await dbInstance.delete(orders).where(eq(orders.id, orderWithoutDevice!.id));
    }
  });
});
