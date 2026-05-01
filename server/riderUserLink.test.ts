import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { riders } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Rider-User Linking", () => {
  let testRiderId: number;
  let testUserId: number;
  let anotherRiderId: number;
  let adminCaller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    // Create admin caller
    adminCaller = appRouter.createCaller({
      user: { id: 1, email: "admin@test.com", name: "Admin", role: "admin" },
    });

    // Create test rider
    const rider = await db.createRider({
      name: "Test Rider",
      phone: "08012345678",
      status: "active",
      assignedHub: "Enugu-Main",
    });
    testRiderId = rider.id;

    // Create another rider
    const anotherRider = await db.createRider({
      name: "Another Rider",
      phone: "08087654321",
      status: "active",
      assignedHub: "Enugu-Main",
    });
    anotherRiderId = anotherRider.id;

    // Create test user (assuming user with ID 2 exists)
    testUserId = 2;
  });

  afterAll(async () => {
    // Clean up
    const drizzle = await db.getDb();
    if (!drizzle) return;
    
    if (testRiderId) {
      await drizzle.delete(riders).where(eq(riders.id, testRiderId));
    }
    if (anotherRiderId) {
      await drizzle.delete(riders).where(eq(riders.id, anotherRiderId));
    }
  });

  it("should link user to rider", async () => {
    const result = await adminCaller.riders.linkUser({
      riderId: testRiderId,
      userId: testUserId,
    });

    expect(result.success).toBe(true);

    // Verify link
    const rider = await db.getRiderById(testRiderId);
    expect(rider?.userId).toBe(testUserId);
  });

  it("should prevent linking same user to multiple riders", async () => {
    // First link already done in previous test
    // Try to link same user to another rider
    await expect(
      adminCaller.riders.linkUser({
        riderId: anotherRiderId,
        userId: testUserId,
      })
    ).rejects.toThrow("already linked to another rider");
  });

  it("should unlink user from rider", async () => {
    const result = await adminCaller.riders.unlinkUser({
      riderId: testRiderId,
    });

    expect(result.success).toBe(true);

    // Verify unlink
    const rider = await db.getRiderById(testRiderId);
    expect(rider?.userId).toBeNull();
  });

  it("should allow re-linking after unlink", async () => {
    // Unlink first (already done in previous test)
    // Now link again
    const result = await adminCaller.riders.linkUser({
      riderId: testRiderId,
      userId: testUserId,
    });

    expect(result.success).toBe(true);

    const rider = await db.getRiderById(testRiderId);
    expect(rider?.userId).toBe(testUserId);

    // Clean up
    await adminCaller.riders.unlinkUser({ riderId: testRiderId });
  });

  it("should reject link for non-existent rider", async () => {
    await expect(
      adminCaller.riders.linkUser({
        riderId: 999999,
        userId: testUserId,
      })
    ).rejects.toThrow("Rider not found");
  });

  it("should enforce admin-only access", async () => {
    const userCaller = appRouter.createCaller({
      user: { id: 2, email: "user@test.com", name: "User", role: "user" },
    });

    await expect(
      userCaller.riders.linkUser({
        riderId: testRiderId,
        userId: testUserId,
      })
    ).rejects.toThrow();
  });
});
