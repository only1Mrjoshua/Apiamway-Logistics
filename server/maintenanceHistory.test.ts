import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { devices, deviceMaintenanceEvents, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Maintenance History Log", () => {
  let adminCaller: any;
  let testDeviceId: number;
  let testAdminId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Create test admin user
    const [admin] = await db.insert(users).values({
      openId: "test-admin-history",
      name: "Test Admin History",
      role: "admin",
    }).$returningId();
    testAdminId = admin.id;

    // Create admin caller
    adminCaller = appRouter.createCaller({
      user: { id: testAdminId, role: "admin", openId: "test-admin-history", name: "Test Admin History" },
    });

    // Create test device
    const [device] = await db.insert(devices).values({
      traccarDeviceId: 88888,
      name: "Test History Bike",
      label: "TEST-HIST-01",
      status: "available",
    }).$returningId();
    testDeviceId = device.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Cleanup
    await db.delete(deviceMaintenanceEvents).where(eq(deviceMaintenanceEvents.deviceId, testDeviceId));
    await db.delete(devices).where(eq(devices.id, testDeviceId));
    await db.delete(users).where(eq(users.id, testAdminId));
  });

  it("should log event when setting bike to maintenance", async () => {
    await adminCaller.devices.update({
      id: testDeviceId,
      status: "maintenance",
      maintenanceReason: "Tire replacement needed",
      maintenanceUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    });

    const history = await adminCaller.devices.getMaintenanceHistory({ deviceId: testDeviceId });
    
    expect(history.length).toBeGreaterThan(0);
    const latestEvent = history[0];
    expect(latestEvent.actionType).toBe("set_maintenance");
    expect(latestEvent.reason).toBe("Tire replacement needed");
    expect(latestEvent.performedByUserId).toBe(testAdminId);
    expect(latestEvent.performedBy?.name).toBe("Test Admin History");
  });

  it("should log event when marking bike as available", async () => {
    await adminCaller.devices.update({
      id: testDeviceId,
      status: "available",
      maintenanceReason: null,
      maintenanceUntil: null,
    });

    const history = await adminCaller.devices.getMaintenanceHistory({ deviceId: testDeviceId });
    
    // Should have 2 events now: set_maintenance + mark_available
    expect(history.length).toBeGreaterThanOrEqual(1);
    // Find the mark_available event
    const markAvailableEvent = history.find(e => e.actionType === "mark_available");
    expect(markAvailableEvent).toBeDefined();
    if (markAvailableEvent) {
      expect(markAvailableEvent.reason).toBeNull();
      expect(markAvailableEvent.performedByUserId).toBe(testAdminId);
    }
  });

  it("should return history ordered by newest first (by id desc)", async () => {
    // Set to maintenance again to ensure we have a known latest event
    await adminCaller.devices.update({
      id: testDeviceId,
      status: "maintenance",
      maintenanceReason: "Ordering test maintenance",
    });

    const history = await adminCaller.devices.getMaintenanceHistory({ deviceId: testDeviceId });
    
    expect(history.length).toBeGreaterThanOrEqual(2);
    // Verify events are in descending order by id (newest first)
    // IDs are auto-incrementing so higher id = newer event
    for (let i = 0; i < history.length - 1; i++) {
      expect(history[i].id).toBeGreaterThan(history[i + 1].id);
    }
    // The most recent event should be the set_maintenance we just triggered
    expect(history[0].actionType).toBe("set_maintenance");
  });

  it("should return empty array for device with no history", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Create a new device without any maintenance history
    const [newDevice] = await db.insert(devices).values({
      traccarDeviceId: 77777,
      name: "Test No History Bike",
      status: "available",
    }).$returningId();

    const history = await adminCaller.devices.getMaintenanceHistory({ deviceId: newDevice.id });
    expect(history.length).toBe(0);

    // Cleanup
    await db.delete(devices).where(eq(devices.id, newDevice.id));
  });
});
