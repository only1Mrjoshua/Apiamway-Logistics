import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Users Router", () => {
  let testUserId: number;
  let testUserEmail: string;

  beforeAll(async () => {
    // Create a test user using upsertUser
    const openId = `test-users-openid-${Date.now()}`;
    const email = `test-users-${Date.now()}@example.com`;
    
    await db.upsertUser({
      name: "Test User for Users Section",
      email,
      openId,
    });
    
    // Get the user to retrieve the ID
    const testUser = await db.getUserByOpenId(openId);
    if (!testUser) throw new Error("Failed to create test user");
    
    testUserId = testUser.id;
    testUserEmail = testUser.email;
  });

  describe("users.getAll", () => {
    it("should return all users without filters", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getAll({
        search: "",
        accountType: "all",
        fleetOwnerStatus: "all",
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(typeof result.totalCount).toBe("number");
    });

    it("should filter users by search term", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getAll({
        search: testUserEmail,
        accountType: "all",
        fleetOwnerStatus: "all",
      });

      expect(result).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.some((u) => u.email === testUserEmail)).toBe(true);
    });

    it("should filter users by account type", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getAll({
        search: "",
        accountType: "shipper",
        fleetOwnerStatus: "all",
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("should require admin role", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, role: "user", name: "Test User", email: testUserEmail, openId: "test-openid" },
      });

      await expect(
        caller.users.getAll({
          search: "",
          accountType: "all",
          fleetOwnerStatus: "all",
        })
      ).rejects.toThrow();
    });
  });

  describe("users.getById", () => {
    it("should return user details by ID", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getById({ id: testUserId });

      expect(result).toBeDefined();
      expect(result?.id).toBe(testUserId);
      expect(result?.email).toBe(testUserEmail);
    });

    it("should return null for non-existent user", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getById({ id: 999999 });

      expect(result).toBeNull();
    });

    it("should require admin role", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, role: "user", name: "Test User", email: testUserEmail, openId: "test-openid" },
      });

      await expect(caller.users.getById({ id: testUserId })).rejects.toThrow();
    });
  });

  describe("users.getOrders", () => {
    it("should return empty array for user with no orders", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getOrders({ userId: testUserId });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should require admin role", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, role: "user", name: "Test User", email: testUserEmail, openId: "test-openid" },
      });

      await expect(caller.users.getOrders({ userId: testUserId })).rejects.toThrow();
    });
  });

  describe("users.getWalletTransactions", () => {
    it("should return wallet data for user", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getWalletTransactions({ userId: testUserId });

      expect(result).toBeDefined();
      expect(result.wallet).toBeDefined();
      expect(result.transactions).toBeDefined();
      expect(Array.isArray(result.transactions)).toBe(true);
    });

    it("should require admin role", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, role: "user", name: "Test User", email: testUserEmail, openId: "test-openid" },
      });

      await expect(caller.users.getWalletTransactions({ userId: testUserId })).rejects.toThrow();
    });
  });

  describe("users.getReferralStats", () => {
    it("should return referral data for user", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "admin-openid" },
      });

      const result = await caller.users.getReferralStats({ userId: testUserId });

      expect(result).toBeDefined();
      expect(result.referralCode).toBeDefined();
      expect(result.referrals).toBeDefined();
      expect(Array.isArray(result.referrals)).toBe(true);
      expect(result.totalBonus).toBeDefined();
      expect(typeof result.totalBonus).toBe("number");
    });

    it("should require admin role", async () => {
      const caller = appRouter.createCaller({
        user: { id: testUserId, role: "user", name: "Test User", email: testUserEmail, openId: "test-openid" },
      });

      await expect(caller.users.getReferralStats({ userId: testUserId })).rejects.toThrow();
    });
  });
});
